"""Read-only diagnosis, conservative sizing, and bounded integration probes."""

import math
from pathlib import Path
import re

from .hardware import collect
from .report import finding, report
from .transport import RuntimeFailure, decode_json

CHECKS = ("streaming", "json", "tools", "embeddings")
CHECK_TITLES = {
    "streaming": "Streaming",
    "json": "Structured JSON",
    "tools": "Tool calling",
    "embeddings": "Embeddings",
}
PROTOCOLS = ("ollama", "openai")


def validate_model(model):
    if (
        not isinstance(model, str)
        or not model.strip()
        or len(model) > 256
        or any(ord(char) < 32 for char in model)
    ):
        raise ValueError("Choose a non-empty model name of at most 256 characters")
    return model


def positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def inventory(client, protocol):
    data = client.json("/api/tags" if protocol == "ollama" else "/v1/models")
    models = data.get("models" if protocol == "ollama" else "data")
    if not isinstance(models, list) or any(not isinstance(item, dict) for item in models):
        raise RuntimeFailure("Runtime returned an invalid model inventory")
    result = []
    for item in models:
        name = item.get("name", item.get("model")) if protocol == "ollama" else item.get("id")
        if not isinstance(name, str) or not name:
            raise RuntimeFailure("Runtime inventory contains a model without a valid name")
        if not isinstance(item.get("details", {}), dict):
            raise RuntimeFailure("Runtime inventory contains invalid model details")
        # Return only useful metadata, not arbitrary provider fields.
        result.append(
            {
                "name": name,
                "size": item.get("size"),
                "digest": item.get("digest"),
                "details": item.get("details", {}),
                "remote_host": item.get("remote_host"),
            }
        )
    return result


def model_metadata(client, model, protocol):
    validate_model(model)
    models = inventory(client, protocol)
    selected = next((item for item in models if item["name"] == model), None)
    if selected is None:
        raise ValueError(
            "Model is not in this runtime's inventory. Select an exact installed name; no downloads are attempted."
        )
    details = client.json("/api/show", {"model": model}) if protocol == "ollama" else {}
    if (
        selected.get("remote_host")
        or details.get("remote_host")
        or details.get("remote_model")
        or re.search(r"(?:[:\-]cloud)(?::latest)?$", model, re.IGNORECASE)
    ):
        raise ValueError(
            "This model is advertised as remote/cloud. Choose a local model for readiness checks."
        )
    if not isinstance(details.get("model_info", {}), dict) or not isinstance(
        details.get("details", {}), dict
    ):
        raise RuntimeFailure("Runtime returned invalid model metadata")
    capabilities = details.get("capabilities")
    thinking = details.get("thinking")
    if thinking is not None and (
        not isinstance(thinking, dict) or not isinstance(thinking.get("values", []), list)
    ):
        raise RuntimeFailure("Runtime returned invalid thinking-control metadata")
    if capabilities is not None and (
        not isinstance(capabilities, list)
        or any(not isinstance(item, str) for item in capabilities)
    ):
        raise RuntimeFailure("Runtime returned invalid capability metadata")
    return selected, details


def doctor(client, protocol="ollama", log_path=None):
    hardware = collect()
    findings = []
    models = []
    version = None
    connected = False
    try:
        models = inventory(client, protocol)
        connected = True
        findings.append(
            finding(
                "runtime",
                "Runtime connection",
                "pass",
                f"Connected using {'Ollama native' if protocol == 'ollama' else 'OpenAI-compatible'}; "
                f"{len(models)} {'model is' if len(models) == 1 else 'models are'} available.",
            )
        )
        if not models:
            findings.append(
                finding(
                    "inventory",
                    "Model inventory",
                    "warning",
                    "The runtime has no installed models.",
                    "Install a model in your runtime, then refresh. DeviceBench does not download models.",
                )
            )
    except RuntimeFailure as error:
        action = "Start the local runtime and confirm its port and protocol."
        if error.status == 401:
            action = "This endpoint requires authentication, which V1 does not support. Use a supported local endpoint."
        elif error.status == 404:
            action = "Check the selected API protocol. Ollama and OpenAI-compatible endpoints use different paths."
        findings.append(finding("runtime", "Runtime connection", "unavailable", str(error), action))
    if protocol == "ollama" and connected:
        try:
            data = client.json("/api/version")
            version = data.get("version")
            findings.append(
                finding(
                    "version",
                    "Runtime version",
                    "pass" if isinstance(version, str) else "warning",
                    f"Ollama {version}"
                    if isinstance(version, str)
                    else "Runtime did not report a version.",
                )
            )
        except RuntimeFailure:
            findings.append(
                finding(
                    "version",
                    "Runtime version",
                    "warning",
                    "Version endpoint unavailable; inventory remains usable.",
                )
            )
    loaded = []
    if protocol == "ollama" and connected:
        try:
            loaded = client.json("/api/ps").get("models")
            if not isinstance(loaded, list) or any(not isinstance(item, dict) for item in loaded):
                raise RuntimeFailure("Invalid running-model inventory")
            for index, item in enumerate(loaded):
                size, vram = item.get("size"), item.get("size_vram")
                known = (
                    positive_int(size)
                    and isinstance(vram, int)
                    and not isinstance(vram, bool)
                    and 0 <= vram <= size
                )
                detail = "Memory placement unavailable."
                if known:
                    detail = f"{vram / size:.0%} of reported model memory is GPU allocated; active context: {item.get('context_length', 'unavailable')}. This is allocation, not GPU utilization."
                status = "warning" if known and vram == 0 and hardware["gpus"] else "info"
                findings.append(
                    finding(
                        f"placement-{index}",
                        f"Loaded model: {item.get('name', 'unnamed')}",
                        status,
                        detail,
                        "Check runtime GPU discovery logs and whether the model fits available VRAM."
                        if status == "warning"
                        else None,
                    )
                )
            if not loaded:
                findings.append(
                    finding(
                        "placement",
                        "Model placement",
                        "info",
                        "No model is currently loaded. No inference was started to inspect placement.",
                    )
                )
        except RuntimeFailure:
            loaded = []
            findings.append(
                finding(
                    "placement",
                    "Model placement",
                    "warning",
                    "Runtime does not expose usable running-model information.",
                )
            )
    findings.append(
        finding(
            "hardware",
            "Hardware detection",
            "info",
            f"{hardware['system']} · {hardware['cpu']} · {hardware['logical_cpus']} logical CPUs",
            evidence=hardware,
        )
    )
    findings.append(
        finding(
            "gpu",
            "Accelerator memory",
            "info" if hardware["gpus"] else "warning",
            hardware["gpu_probe"],
            "Missing GPU telemetry does not mean no GPU is installed."
            if not hardware["gpus"]
            else None,
        )
    )
    if log_path is not None:
        findings.extend(diagnose_log(log_path))
    return report(
        "Local AI Doctor",
        client.endpoint,
        findings,
        protocol=protocol,
        hardware=hardware,
        models=models,
        runtime_version=version,
    )


def diagnose_log(path):
    # Logs are opt-in, bounded, and raw lines never enter reports.
    with Path(path).open("rb") as source:
        source.seek(0, 2)
        source.seek(max(0, source.tell() - 1024 * 1024))
        text = source.read(1024 * 1024).decode("utf-8", errors="replace").lower()
    patterns = (
        (
            "gpu-discovery",
            r"gpu discovery.*(?:fail|error)|no compatible gpus|failed to initialize (?:cuda|rocm)",
            "GPU discovery failed",
            "Check your driver and runtime GPU support; for containers, check GPU device access.",
        ),
        (
            "memory-error",
            r"out of memory|unable to allocate|cannot allocate memory",
            "Memory allocation failed",
            "Try a smaller model or context, and check available RAM/VRAM.",
        ),
        (
            "port-error",
            r"address already in use",
            "Runtime port already in use",
            "Check which local service owns the runtime port.",
        ),
        (
            "permissions",
            r"permission denied",
            "Permission error recorded",
            "Check the runtime user's access to the model files and GPU devices.",
        ),
    )
    matches = [
        finding(
            key,
            title,
            "warning",
            "A known diagnostic pattern matched the supplied log tail. Raw log content is excluded.",
            action,
        )
        for key, pattern, title, action in patterns
        if re.search(pattern, text)
    ]
    return matches or [
        finding(
            "logs",
            "Optional log inspection",
            "info",
            "No recognized diagnostic patterns in the last 1 MiB. This does not prove the runtime is healthy.",
        )
    ]


def estimate_memory(info, weights, context):
    architecture = info.get("general.architecture")
    # Restrict the formula to known dense full-attention layouts. Hybrid,
    # recurrent, MoE, and sliding-window layouts need their own estimators.
    if architecture not in ("llama", "qwen2", "qwen3", "phi3") or any(
        "expert" in key or "sliding_window" in key for key in info
    ):
        return None

    def field(name):
        return info.get(f"{architecture}.{name}")

    layers, embedding, heads, kv_heads = (
        field(name)
        for name in (
            "block_count",
            "embedding_length",
            "attention.head_count",
            "attention.head_count_kv",
        )
    )
    if (
        not all(positive_int(value) for value in (layers, embedding, heads, kv_heads, weights))
        or embedding % heads
    ):
        return None
    if layers > 4096 or embedding > 1048576 or heads > 1048576 or weights > 2**60:
        return None
    key_dim = field("attention.key_length")
    value_dim = field("attention.value_length")
    key_dim = embedding // heads if key_dim is None else key_dim
    value_dim = embedding // heads if value_dim is None else value_dim
    if not all(positive_int(value) for value in (key_dim, value_dim)) or kv_heads > heads:
        return None
    if key_dim > 1048576 or value_dim > 1048576:
        return None
    kv = layers * kv_heads * (key_dim + value_dim) * context * 2
    overhead = max(512 * 1024**2, math.ceil(weights * 0.15))
    return {
        "weights_bytes": weights,
        "kv_cache_bytes": kv,
        "runtime_allowance_bytes": overhead,
        "estimated_total_bytes": weights + kv + overhead,
        "assumptions": [
            "One sequence; full-context FP16 key/value cache.",
            "Inventory file size approximates weight memory; it is not measured resident memory.",
            "Runtime allowance is a heuristic: greater of 512 MiB or 15% of weights.",
            "GPU offload, allocator details, batching, adapters, and runtime-specific buffers may change memory use.",
        ],
    }


def model_check(client, model, context=4096, protocol="ollama"):
    validate_model(model)
    if not positive_int(context) or context > 1048576:
        raise ValueError("Context must be an integer between 1 and 1048576 tokens")
    hardware = collect()
    findings = []
    try:
        selected, metadata = model_metadata(client, model, protocol)
    except RuntimeFailure as error:
        return report(
            "Model & Context Checker",
            client.endpoint,
            [
                finding(
                    "metadata",
                    "Model inspection",
                    "unavailable",
                    str(error),
                    "Check the endpoint and model inventory with Local AI Doctor.",
                )
            ],
            model=model,
            context=context,
            protocol=protocol,
        )
    details = metadata.get("details", selected.get("details", {}))
    info = metadata.get("model_info", {})
    architecture = info.get("general.architecture")
    maximum = info.get(f"{architecture}.context_length")
    findings.append(
        finding(
            "identity",
            "Selected model",
            "pass",
            f"{model} · {details.get('parameter_size', 'unknown size')} · {details.get('quantization_level', 'unknown quantization')}",
            evidence={
                "inventory": selected,
                "architecture": architecture,
                "capabilities": metadata.get("capabilities"),
            },
        )
    )
    if positive_int(maximum):
        findings.append(
            finding(
                "context",
                "Requested context",
                "pass" if context <= maximum else "fail",
                f"Requested {context:,} tokens; metadata declares {maximum:,} tokens. This is not the currently allocated context.",
                "Reduce the context to the declared limit." if context > maximum else None,
            )
        )
    else:
        findings.append(
            finding(
                "context",
                "Requested context",
                "warning",
                "The API does not expose a known model context limit; compatibility cannot be established from metadata.",
            )
        )
    estimate = estimate_memory(info, selected.get("size"), context)
    if estimate:
        required = estimate["estimated_total_bytes"]
        findings.append(
            finding(
                "estimate",
                "Memory estimate",
                "info",
                f"Approximately {required / 1024**3:.2f} GiB for weights, FP16 KV cache, and a heuristic runtime allowance. This is not proof that the model will load.",
                evidence=estimate,
            )
        )
        # Do not aggregate discrete GPUs or double-count unified memory.
        pools = [("System RAM", hardware["memory"].get("available_bytes"))] + [
            (gpu["name"], gpu.get("available_bytes")) for gpu in hardware["gpus"]
        ]
        for index, (name, available) in enumerate(pools):
            if not positive_int(available):
                findings.append(
                    finding(
                        f"pool-{index}",
                        name,
                        "warning",
                        "Available memory was not measured; no fit verdict is possible.",
                    )
                )
            else:
                budget = int(available * 0.85)
                fits = required <= budget
                findings.append(
                    finding(
                        f"pool-{index}",
                        name,
                        "info" if fits else "warning",
                        f"Estimate {'fits' if fits else 'exceeds'} a conservative budget of {budget / 1024**3:.2f} GiB (85% of currently available memory). This pool is assessed independently.",
                        "A GPU shortfall may still allow CPU or partial-offload execution; confirm through the runtime."
                        if not fits
                        else None,
                    )
                )
    else:
        findings.append(
            finding(
                "estimate",
                "Memory estimate",
                "warning",
                "Memory requirements cannot be estimated from the metadata available for this model and API.",
                "Use the runtime's actual loading behavior to establish memory requirements.",
            )
        )
    license_text = metadata.get("license")
    findings.append(
        finding(
            "license",
            "Recorded model license",
            "info" if isinstance(license_text, str) and license_text else "warning",
            "License text is included as supplied by the runtime; it is not independently verified."
            if license_text
            else "Runtime did not provide model license information.",
            evidence=license_text[:16000] if isinstance(license_text, str) else None,
        )
    )
    return report(
        "Model & Context Checker",
        client.endpoint,
        findings,
        model=model,
        context=context,
        protocol=protocol,
        hardware=hardware,
    )


def classify_failure(error):
    message = str(error).lower()
    if error.status in (404, 405, 501) or re.search(
        r"does not support|not supported|unsupported", message
    ):
        return "unsupported"
    if (
        error.status is not None
        and 400 <= error.status < 500
        and error.status not in (401, 403, 408, 429)
    ):
        return "fail"
    return "unavailable"


def compatibility(
    client, model, checks=("streaming", "json"), protocol="ollama", embedding_model=None
):
    validate_model(model)
    checks = list(dict.fromkeys(checks))
    if not checks or any(item not in CHECKS for item in checks):
        raise ValueError("Select checks from streaming, json, tools, embeddings")
    try:
        _, metadata = model_metadata(client, model, protocol)
    except RuntimeFailure as error:
        return report(
            "App Compatibility Tester",
            client.endpoint,
            [finding(key, CHECK_TITLES[key], "unavailable", str(error)) for key in checks],
            model=model,
            protocol=protocol,
        )
    findings = []
    for key in checks:
        path, payload, data = None, None, None
        target = embedding_model or model if key == "embeddings" else model
        feature_metadata = metadata
        try:
            if target != model:
                _, feature_metadata = model_metadata(client, target, protocol)
            caps = feature_metadata.get("capabilities")
            required_cap = (
                "embedding" if key == "embeddings" else "tools" if key == "tools" else "completion"
            )
            if caps is not None and required_cap not in caps:
                findings.append(
                    finding(
                        key,
                        CHECK_TITLES[key],
                        "unsupported",
                        f"{target} does not advertise {required_cap} support. No inference request was made.",
                        "Choose a model that supports this feature.",
                        evidence={"capabilities": caps},
                    )
                )
                continue
            path, payload = probe_request(key, target, protocol, feature_metadata)
            data = client.request(path, payload)
            observation = validate_probe(key, data, protocol)
            findings.append(
                finding(
                    key,
                    CHECK_TITLES[key],
                    "pass",
                    observation,
                    evidence={
                        "model": target,
                        "request": {"path": path, "body": payload},
                        "response": data.decode("utf-8")[:65536],
                        "response_truncated": len(data.decode("utf-8")) > 65536,
                        "response_bytes": len(data),
                    },
                )
            )
        except RuntimeFailure as error:
            status = classify_failure(error)
            findings.append(
                finding(
                    key,
                    CHECK_TITLES[key],
                    status,
                    str(error),
                    "Check runtime health, model support, and the request example.",
                    evidence={"model": target, "request": {"path": path, "body": payload}}
                    if path
                    else None,
                )
            )
        except ValueError as error:
            findings.append(
                finding(
                    key,
                    CHECK_TITLES[key],
                    "fail",
                    str(error),
                    "Inspect the observed response and use a model that meets your app's requirement.",
                    evidence={
                        "model": target,
                        "request": {"path": path, "body": payload},
                        "response": data.decode("utf-8", errors="replace")[:65536],
                        "response_truncated": len(data.decode("utf-8", errors="replace")) > 65536,
                        "response_bytes": len(data),
                    }
                    if data is not None
                    else None,
                )
            )
    return report(
        "App Compatibility Tester",
        client.endpoint,
        findings,
        model=model,
        protocol=protocol,
        requested_checks=checks,
        scope="Small fixed integration probes, not a reliability benchmark. A pass establishes only the observed request. Tool calls are inspected and never executed; prompts and outputs are included in exports.",
    )


def probe_request(key, model, protocol, metadata):
    native = protocol == "ollama"
    if key == "embeddings":
        return (
            (
                "/api/embed",
                {
                    "model": model,
                    "input": ["DeviceBench integration check"],
                    "truncate": False,
                    "keep_alive": "5m",
                },
            )
            if native
            else ("/v1/embeddings", {"model": model, "input": ["DeviceBench integration check"]})
        )
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with READY."}],
        "stream": key == "streaming",
    }
    if native:
        payload.update(
            options={"temperature": 0, "num_predict": 128, "num_ctx": 2048}, keep_alive="5m"
        )
        if "thinking" in (metadata.get("capabilities") or []) and False in (
            metadata.get("thinking") or {}
        ).get("values", [False]):
            payload["think"] = False
    else:
        payload.update(temperature=0, max_tokens=128)
    if key == "json":
        schema = {
            "type": "object",
            "properties": {"ok": {"type": "boolean", "const": True}},
            "required": ["ok"],
            "additionalProperties": False,
        }
        payload["messages"][0]["content"] = 'Return exactly the JSON object {"ok":true}.'
        if native:
            payload["format"] = schema
        else:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "readiness", "strict": True, "schema": schema},
            }
    if key == "tools":
        payload["messages"][0]["content"] = (
            "Call get_weather with city Paris. Do not answer in text."
        )
        payload["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather for a city",
                    "parameters": {
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                },
            }
        ]
        if not native:
            payload["tool_choice"] = {"type": "function", "function": {"name": "get_weather"}}
    return ("/api/chat" if native else "/v1/chat/completions"), payload


def message_from(data, protocol):
    if protocol == "ollama":
        if data.get("done") is not True:
            raise ValueError("Response is missing a successful completion record")
        message = data.get("message")
    else:
        choices = data.get("choices")
        if (
            not isinstance(choices, list)
            or not choices
            or not isinstance(choices[0], dict)
            or not choices[0].get("finish_reason")
        ):
            raise ValueError("Response is missing a successful completion choice")
        message = choices[0].get("message")
    if not isinstance(message, dict):
        raise ValueError("Response is missing an assistant message")
    return message


def validate_probe(key, data, protocol):
    if key == "streaming":
        return validate_stream(data, protocol)
    parsed = decode_json(data)
    if key == "embeddings":
        if protocol == "ollama":
            vectors = parsed.get("embeddings")
        else:
            entries = parsed.get("data")
            vectors = (
                [item.get("embedding") for item in entries]
                if isinstance(entries, list) and all(isinstance(item, dict) for item in entries)
                else None
            )
        if (
            not isinstance(vectors, list)
            or len(vectors) != 1
            or not isinstance(vectors[0], list)
            or not vectors[0]
            or not all(
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and math.isfinite(value)
                for value in vectors[0]
            )
        ):
            raise ValueError("Expected one non-empty finite numeric embedding vector")
        return f"Received a valid {len(vectors[0])}-dimension embedding vector. Semantic quality was not tested."
    message = message_from(parsed, protocol)
    if key == "json":
        content = message.get("content")
        try:
            value = decode_json(content) if isinstance(content, str) else None
        except RuntimeFailure:
            value = None
        if value != {"ok": True}:
            raise ValueError('Response did not satisfy the requested schema {"ok":true}')
        # bool and int compare equal in Python; schema requires a real boolean.
        if value.get("ok") is not True:
            raise ValueError("The ok field must be the boolean true")
        return (
            "The generated object matched the requested schema, including types and allowed keys."
        )
    calls = message.get("tool_calls")
    if (
        not isinstance(calls, list)
        or len(calls) != 1
        or not isinstance(calls[0], dict)
        or not isinstance(calls[0].get("function"), dict)
    ):
        raise ValueError("Expected exactly one structured tool call")
    function = calls[0]["function"]
    arguments = function.get("arguments")
    if isinstance(arguments, str):
        try:
            arguments = decode_json(arguments)
        except RuntimeFailure:
            raise ValueError("Tool arguments were not a valid JSON object") from None
    if function.get("name") != "get_weather" or arguments != {"city": "Paris"}:
        raise ValueError("Tool name or arguments did not match the requested call")
    return "Observed the requested structured tool call and validated its arguments. No function was executed."


def validate_stream(data, protocol):
    try:
        text = data.decode("utf-8")
    except UnicodeError:
        raise ValueError("Stream contained invalid UTF-8") from None
    content = []
    events = 0
    completed = False
    finished = False
    for line in text.splitlines():
        if (
            not line.strip()
            or protocol == "openai"
            and (line.startswith(":") or line.startswith("event:"))
        ):
            continue
        if completed:
            raise ValueError("Stream contained data after its terminal record")
        if protocol == "openai":
            if not line.startswith("data:"):
                raise ValueError("Expected SSE data frames")
            line = line[5:].strip()
            if line == "[DONE]":
                completed = True
                continue
        event = decode_json(line)
        events += 1
        if protocol == "ollama":
            message = event.get("message")
            if not isinstance(message, dict):
                raise ValueError("Stream event is missing a message")
            piece = message.get("content", "")
            completed = event.get("done") is True
        else:
            choices = event.get("choices")
            if not isinstance(choices, list):
                raise ValueError("Stream event is missing choices")
            if not choices:  # Optional usage event.
                continue
            if not isinstance(choices[0], dict) or not isinstance(choices[0].get("delta"), dict):
                raise ValueError("Stream choice is missing a delta")
            piece = choices[0]["delta"].get("content", "")
            finished = finished or bool(choices[0].get("finish_reason"))
        if piece is not None and not isinstance(piece, str):
            raise ValueError("Stream content must be text")
        if piece:
            content.append(piece)
    if not completed or not content or events < 2 or protocol == "openai" and not finished:
        raise ValueError(
            "Stream lacked non-empty content, multiple frames, or a successful terminal record"
        )
    return f"Validated {events} framed stream records and completion. Incremental delivery timing was not measured."
