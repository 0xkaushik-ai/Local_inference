"""Local benchmark runner for Ollama and the RunAnywhere desktop SDK."""

import argparse
import contextlib
import datetime
import hashlib
import html
import json
import math
import os
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time
import tempfile

BASE = "http://127.0.0.1:11434"
@contextlib.contextmanager
def api(path, payload=None, timeout=10):
    # curl also enforces a total deadline while waiting for a stalled stream.
    # Fixed loopback URL, no redirects/proxies, no shell interpretation.
    command = ["curl", "-sS", "--no-buffer", "--fail-with-body", "--noproxy", "*",
               "--max-time", str(timeout), "-H", "Content-Type: application/json"]
    if payload is not None:
        command += ["--data-binary", "@-"]
    command.append(BASE + path)
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=errors)
        try:
            if payload is not None:
                process.stdin.write(json.dumps(payload).encode())
            process.stdin.close()
            try:
                yield process.stdout
            except Exception:
                if process.poll() is not None and process.returncode:
                    errors.seek(0)
                    raise OSError(errors.read().decode(errors="replace")) from None
                raise
            code = process.wait(timeout=timeout + 2)
            if code:
                errors.seek(0)
                raise OSError(f"Local runtime request failed ({code}): " + errors.read().decode(errors="replace"))
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            process.stdout.close()


def read_json(path, payload=None):
    with api(path, payload) as response:
        return json.load(response)


def generate(model, prompt, max_tokens, seed, timeout):
    start = time.perf_counter()
    first = None
    parts = []
    final = None
    with api("/api/generate", {
        "model": model, "prompt": prompt, "stream": True,
        "keep_alive": "5m",
        "options": {"temperature": 0, "seed": seed, "num_predict": max_tokens},
    }, timeout) as response:
        for line in response:
            if time.perf_counter() - start > timeout:
                raise TimeoutError("Generation exceeded the configured time budget")
            if not line.strip():
                continue
            event = json.loads(line)
            if event.get("error"):
                raise RuntimeError(event["error"])
            content = event.get("response", "")
            if content:
                if first is None:
                    first = time.perf_counter() - start
                parts.append(content)
            if event.get("done"):
                final = event
                break
    if final is None:
        raise RuntimeError("Stream ended without a completion record")
    duration = final.get("eval_duration", 0)
    count = final.get("eval_count")
    return {
        "output": "".join(parts),
        "first_content_ms": None if first is None else first * 1000,
        "wall_ms": (time.perf_counter() - start) * 1000,
        "output_tokens": count,
        "decode_tokens_per_second": count / (duration / 1e9)
        if duration > 0 and isinstance(count, int) else None,
        "runtime_load_ms": final.get("load_duration", 0) / 1e6,
        "runtime_metrics": {k: final.get(k) for k in (
            "total_duration", "load_duration", "prompt_eval_count",
            "prompt_eval_duration", "eval_count", "eval_duration", "done_reason")},
    }


def percentile(values, quantile):
    return sorted(values)[max(0, math.ceil(len(values) * quantile) - 1)] if values else None


def summarize(rows, models):
    summaries = []
    for model in models:
        measured = [r for r in rows if r["model"] == model and r["phase"] == "measured"]
        valid = [r for r in measured if r["status"] == "ok"]
        item = {"model": model, "attempts": len(measured), "completed": len(valid),
                "errors": len(measured) - len(valid),
                "task_passes": sum(r["task_pass"] for r in valid)}
        for key in ("first_content_ms", "wall_ms", "decode_tokens_per_second", "generation_tokens_per_second", "runtime_load_ms"):
            values = [r[key] for r in valid if r.get(key) is not None]
            item[key] = {"median": statistics.median(values) if values else None,
                         "p95": percentile(values, .95), "samples": len(values)}
        summaries.append(item)
    return summaries


def render(report):
    esc = lambda value: html.escape(str(value), quote=True)
    number = lambda value: "unavailable" if value is None else f"{value:,.1f}"
    rows = "".join(
        f"<tr><td>{esc(s['model'])}</td><td>{s['completed']}/{s['attempts']}</td>"
        f"<td>{s['task_passes']}/{s['attempts']}</td>"
        f"<td>{number(s['first_content_ms']['median'])}</td>"
        f"<td>{number(s['decode_tokens_per_second']['median'])}</td>"
        f"<td>{number(s.get('generation_tokens_per_second', {}).get('median'))}</td>"
        f"<td>{s['errors']}</td></tr>" for s in report["summary"])
    return f"""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>DeviceBench — local evidence</title><style>
body{{background:#101819;color:#edf4ee;font:16px/1.65 system-ui;margin:0;padding:5vw}}
main{{max-width:1100px;margin:auto}}h1{{font-size:clamp(36px,7vw,72px);line-height:1.1}}
.eyebrow{{color:#b6ed90;letter-spacing:.15em}}section{{background:#1b2729;padding:24px;border-radius:14px;margin:24px 0}}
.table{{overflow:auto}}table{{width:100%;border-collapse:collapse;white-space:nowrap}}
td,th{{padding:14px;text-align:left;border-bottom:1px solid #3b4e4c}}p{{max-width:80ch}}
details{{margin-top:24px}}pre{{white-space:pre-wrap;overflow-wrap:anywhere}}small{{color:#b8cbc7}}
</style><main><div class="eyebrow">DEVICEBENCH / LOCAL EXPERIMENT</div>
<h1>Measurements you<br>can inspect.</h1><p>{esc(report['created_at'])} · {esc(report['runtime'].get('name', 'Ollama'))} {esc(report['runtime']['version'])}</p>
<small>{esc(report['device']['cpu'])} · {esc(report['device']['system'])}</small>
<section><b>Scope of this report</b><p>Single-host sequential smoke test. These results are not a model quality ranking or a cross-runtime comparison. Task pass means exact match on the recorded prompts. Errors remain in the denominator.</p></section>
<div class="table"><table><thead><tr><th>Model</th><th>Completed</th><th>Task checks</th><th>First content, median ms</th><th>Decode, median tok/s</th><th>Generation, median tok/s</th><th>Errors</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>First content measures generation start to the first non-empty output chunk. For RunAnywhere it excludes model loading; for Ollama it begins at the HTTP request. Decode speed requires separate runtime decode duration. Generation speed includes prefill and is a different metric. Warm-ups are excluded. RunAnywhere reloads the model in each request process; OS cache is uncontrolled. Small-sample p95 values are descriptive only.</p>
<details><summary>Inspect full evidence and configuration</summary><pre>{esc(json.dumps(report, indent=2))}</pre></details></main></html>"""


def device():
    cpu = platform.processor() or platform.machine()
    if Path("/proc/cpuinfo").exists():
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                cpu = line.split(":", 1)[1].strip()
                break
    return {"system": platform.platform(), "cpu": cpu, "logical_cpus": os.cpu_count(),
            "python": platform.python_version(), "accelerator": "not collected",
            "memory_bytes": os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
            if hasattr(os, "sysconf") and sys.platform == "linux" else None}


def load_suite(path):
    suite = json.loads(path.read_text())
    cases = suite.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("Suite requires at least one case")
    ids = set()
    for case in cases:
        if not all(isinstance(case.get(k), str) and case[k] for k in ("id", "prompt", "expected")):
            raise ValueError("Every case requires non-empty id, prompt, and expected strings")
        if case["id"] in ids:
            raise ValueError("Case IDs must be unique")
        ids.add(case["id"])
    return suite


def import_captures(manifest_path, out):
    manifest = json.loads(manifest_path.read_text())
    rows = []
    for capture in manifest["captures"]:
        events = [json.loads(line) for line in (manifest_path.parent / capture["file"]).read_text().splitlines() if line.strip()]
        final = next((e for e in reversed(events) if e.get("done")), None)
        row = {k: capture[k] for k in ("model", "phase", "repeat", "case_id", "prompt", "expected")}
        if final is None or any(e.get("error") for e in events):
            row.update(status="error", error="Capture missing successful completion")
        elif final.get("model") != capture["model"]:
            raise ValueError("Capture model differs from manifest")
        else:
            duration = final.get("eval_duration", 0)
            count = final.get("eval_count")
            output = "".join(e.get("response", "") for e in events)
            row.update(status="ok", output=output, task_pass=output.strip() == capture["expected"],
                       first_content_ms=None, wall_ms=None, output_tokens=count,
                       decode_tokens_per_second=count / (duration / 1e9) if duration > 0 and isinstance(count, int) else None,
                       runtime_load_ms=final.get("load_duration", 0) / 1e6,
                       runtime_metrics={k: final.get(k) for k in ("total_duration", "load_duration", "eval_count", "eval_duration", "prompt_eval_count", "prompt_eval_duration")},
                       capture_sha256=hashlib.sha256((manifest_path.parent / capture["file"]).read_bytes()).hexdigest())
        rows.append(row)
    if not rows or not any(r["phase"] == "measured" for r in rows):
        raise ValueError("Manifest requires measured captures")
    report = {"schema_version": 1, "runner_version": "0.1.0", "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "runtime": manifest["runtime"], "device": manifest["device"], "models": manifest["models"],
              "config": manifest["config"], "provenance": "Imported runtime captures; manifest metadata supplied by collector, not independently attested",
              "summary": summarize(rows, list(dict.fromkeys(r["model"] for r in rows))), "runs": rows}
    out.mkdir(parents=True, exist_ok=False)
    (out / "report.json").write_text(json.dumps(report, indent=2))
    (out / "report.html").write_text(render(report))
    print(f"Report: {out / 'report.html'}")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["doctor", "run", "import"])
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--backend", choices=["ollama", "runanywhere"], default="ollama")
    parser.add_argument("--bridge", type=Path, default=Path("build/runanywhere/devicebench-runanywhere"))
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--models", nargs="+")
    parser.add_argument("--suite", type=Path, default=Path("suites/smoke.json"))
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--max-tokens", type=int, default=32)
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path("reports"))
    args = parser.parse_args()
    if args.repeats < 1 or args.warmups < 0 or args.max_tokens < 1 or not math.isfinite(args.timeout) or args.timeout <= 0 or args.threads < 1:
        parser.error("Use positive repeats, max-tokens, timeout and nonnegative warmups")
    try:
        if args.command == "import":
            if not args.manifest:
                parser.error("import requires --manifest")
            report = import_captures(args.manifest, args.out)
            measured = [r for r in report["runs"] if r["phase"] == "measured"]
            if any(r["status"] != "ok" for r in measured):
                sys.exit(2)
            if any(not r["task_pass"] for r in measured):
                sys.exit(1)
            return
        if args.backend == "runanywhere":
            from . import runanywhere as ra
            runtime = ra.doctor(args.bridge)
            available = [ra.inspect_model(m) for m in (args.models or [])]
            if args.models:
                args.models = [m["name"] for m in available]
        else:
            runtime = {"name": "Ollama", **read_json("/api/version")}
            available = read_json("/api/tags")["models"]
        if args.command == "doctor":
            print(json.dumps({"device": device(), "runtime": runtime,
                              "models": available}, indent=2))
            return
        if not args.models:
            parser.error("run requires --models with exact installed model names")
        models = list(dict.fromkeys(args.models))
        inventory = {m["name"]: m for m in available}
        missing = set(models) - inventory.keys()
        if missing:
            raise ValueError(f"Models not installed: {sorted(missing)}. No downloads were attempted.")
        suite = load_suite(args.suite)
        metadata = {m: ({"format": "GGUF", "gpu_layers": 0, "threads": args.threads,
                         "context_size": 2048, "template": "RunAnywhere llama.cpp backend default"}
                        if args.backend == "runanywhere" else read_json("/api/show", {"model": m})) for m in models}
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
        directory = args.out / stamp
        directory.mkdir(parents=True, exist_ok=False)
        rows = []
        with (directory / "runs.jsonl").open("x") as log:
            for model in models:
                for phase, count in (("warmup", args.warmups), ("measured", args.repeats)):
                    for repeat in range(count):
                        for case in suite["cases"]:
                            row = {"model": model, "phase": phase, "repeat": repeat,
                                   "case_id": case["id"], "prompt": case["prompt"],
                                   "expected": case["expected"]}
                            print(f"{model} / {phase} {repeat + 1} / {case['id']}", flush=True)
                            try:
                                if args.backend == "runanywhere":
                                    row.update(ra.generate(args.bridge, model, case["prompt"], args.max_tokens, args.seed, args.timeout, args.threads))
                                else:
                                    row.update(generate(model, case["prompt"], args.max_tokens, args.seed, args.timeout))
                                row.update(status="ok", task_pass=row["output"].strip() == case["expected"])
                            except Exception as error:
                                row.update(status="error", error=f"{type(error).__name__}: {error}")
                            rows.append(row)
                            log.write(json.dumps(row) + "\n")
                            log.flush()
        report = {"schema_version": 1, "runner_version": "0.1.0", "created_at": stamp,
                  "runtime": runtime, "device": device(),
                  "models": {m: {"inventory": inventory[m], "metadata": metadata[m]} for m in models},
                  "suite": suite, "suite_sha256": hashlib.sha256(args.suite.read_bytes()).hexdigest(),
                  "config": {"repeats": args.repeats, "warmups": args.warmups,
                             "backend": args.backend,
                             "model_residency": "reload per request" if args.backend == "runanywhere" else "runtime managed",
                             "max_tokens": args.max_tokens, "temperature": 0, "seed": args.seed,
                             "timeout_seconds": args.timeout, "order": "sequential by model",
                             "cache_state": "uncontrolled", "offline_verified": False},
                  "summary": summarize(rows, models), "runs": rows}
        (directory / "report.json").write_text(json.dumps(report, indent=2))
        (directory / "report.html").write_text(render(report))
        print(f"Report: {directory / 'report.html'}")
        measured = [r for r in rows if r["phase"] == "measured"]
        if any(r["status"] != "ok" for r in measured):
            sys.exit(2)
        if any(not r["task_pass"] for r in measured):
            sys.exit(1)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        parser.exit(2, f"devicebench: {error}\n")
