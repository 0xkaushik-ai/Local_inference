"""RunAnywhere desktop-kit adapter; no PyPI package or HTTP service required."""

import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import time

SDK_VERSION = "0.20.38"


def inspect_model(value):
    path = Path(value).expanduser().resolve(strict=True)
    if not path.is_file():
        raise ValueError("RunAnywhere requires a local GGUF file")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        if stream.read(4) != b"GGUF":
            raise ValueError(f"Not a GGUF file: {path}")
        stream.seek(0)
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"name": str(path), "sha256": digest.hexdigest(), "size": path.stat().st_size}


def doctor(binary):
    path = Path(binary).resolve(strict=True)
    result = subprocess.run([str(path), "--version"], capture_output=True, text=True, timeout=10)
    if result.returncode:
        raise ValueError(f"RunAnywhere bridge failed: {result.stderr[-2000:]}")
    runtime = json.loads(result.stdout)
    if runtime.get("version") != SDK_VERSION:
        raise ValueError(f"Expected SDK {SDK_VERSION}, got {runtime.get('version')}")
    runtime.update(name="RunAnywhere", backend="llamacpp", gpu_layers=0,
                   bridge_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                   lifecycle="new process and model load per request")
    return runtime


def generate(binary, model, prompt, max_tokens, seed, timeout, threads):
    start = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="devicebench-ra-") as state:
        result = subprocess.run(
            [str(Path(binary).resolve()), model, str(max_tokens), str(seed), str(threads), state],
            input=prompt, text=True, encoding="utf-8", capture_output=True, timeout=timeout,
        )
    if result.returncode:
        raise RuntimeError(f"RunAnywhere bridge exited {result.returncode}: {result.stderr[-2000:]}")
    data = json.loads(result.stdout)
    required = ("output", "first_content_ms", "generation_ms", "runtime_load_ms", "output_tokens")
    if any(key not in data for key in required) or not isinstance(data["output"], str):
        raise ValueError("Incomplete RunAnywhere measurement record")
    for key in ("first_content_ms", "generation_ms", "runtime_load_ms", "output_tokens"):
        value = data[key]
        if key == "first_content_ms" and value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f"Invalid RunAnywhere metric: {key}")
    if not isinstance(data["output_tokens"], int):
        raise ValueError("RunAnywhere output token count must be an integer")
    # No separate decode duration is exposed by this streaming API. Keep it unavailable.
    return {"output": data["output"], "first_content_ms": data["first_content_ms"],
            "wall_ms": (time.perf_counter() - start) * 1000,
            "output_tokens": data["output_tokens"], "decode_tokens_per_second": None,
            "generation_tokens_per_second": data["output_tokens"] / (data["generation_ms"] / 1000)
            if data["generation_ms"] > 0 else None,
            "runtime_load_ms": data["runtime_load_ms"], "runtime_metrics": data,
            "measurement_scope": "First content excludes model load; wall time includes process startup, load, generation and teardown"}
