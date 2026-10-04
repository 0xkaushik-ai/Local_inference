"""Behavior tests for sizing, feature validation, and honest failure reporting."""

from html.parser import HTMLParser
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from devicebench.readiness.checks import (
    compatibility,
    diagnose_log,
    doctor,
    estimate_memory,
    model_check,
    validate_probe,
    validate_stream,
)
from devicebench.readiness.report import exit_code, export, finding, render, report
from devicebench.readiness.server import validate_request
from devicebench.readiness.transport import (
    LocalClient,
    RuntimeFailure,
    decode_json,
    validate_endpoint,
)

INFO = {
    "general.architecture": "llama",
    "llama.context_length": 8192,
    "llama.block_count": 16,
    "llama.embedding_length": 1024,
    "llama.attention.head_count": 16,
    "llama.attention.head_count_kv": 4,
}
HARDWARE = {
    "system": "Linux",
    "cpu": "Fixture CPU",
    "logical_cpus": 4,
    "memory": {"total_bytes": 8 * 1024**3, "available_bytes": 6 * 1024**3},
    "gpus": [],
    "gpu_probe": "GPU telemetry unavailable",
}


def encoded(value):
    return json.dumps(value).encode()


class FixtureClient:
    endpoint = "http://127.0.0.1:11434"

    def __init__(self, capabilities=None, info=None):
        self.capabilities = capabilities
        self.info = INFO if info is None else info
        self.requests = []

    def json(self, path, payload=None):
        self.requests.append((path, payload))
        if path == "/api/tags":
            return {
                "models": [
                    {
                        "name": "fixture:latest",
                        "size": 1024**3,
                        "details": {"quantization_level": "Q4_K_M"},
                    }
                ]
            }
        if path == "/api/show":
            data = {"model_info": self.info, "details": {}, "license": "Synthetic fixture license"}
            if self.capabilities is not None:
                data["capabilities"] = self.capabilities
            return data
        if path == "/api/version":
            return {"version": "fixture"}
        if path == "/api/ps":
            return {"models": []}
        raise RuntimeFailure("Unexpected fixture path")

    def request(self, path, payload):
        self.requests.append((path, payload))
        if payload.get("stream"):
            return b' {"message":{"content":"READY"},"done":false}\n{"message":{"content":""},"done":true}\n'
        if payload.get("format"):
            return encoded({"message": {"content": '{"ok":true}'}, "done": True})
        if payload.get("tools"):
            return encoded(
                {
                    "message": {
                        "tool_calls": [
                            {"function": {"name": "get_weather", "arguments": {"city": "Paris"}}}
                        ]
                    },
                    "done": True,
                }
            )
        return encoded({"embeddings": [[0.1, 0.2, 0.3]]})


class ReadinessTests(unittest.TestCase):
    def test_endpoint_normalizes_localhost_without_dns(self):
        self.assertEqual(
            validate_endpoint("http://localhost:1234/"),
            ("127.0.0.1", 1234, "http://127.0.0.1:1234"),
        )
        self.assertEqual(validate_endpoint("http://[::1]:1234")[0], "::1")

    def test_endpoint_rejects_remote_credentials_and_nonroot_paths(self):
        for value in (
            "https://localhost",
            "http://example.com",
            "http://0.0.0.0",
            "http://169.254.169.254",
            "http://user:pass@localhost",
            "http://localhost/v1",
            "http://localhost?key=secret",
            "http://localhost:0",
            "http://127.0.0.1.example.com",
            "file:///tmp/model",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_endpoint(value)

    def test_invalid_timeouts_are_rejected(self):
        for value in (0, -1, float("nan"), float("inf"), 121, True):
            with self.assertRaises(ValueError):
                LocalClient(timeout=value)

    def test_duplicate_json_keys_are_rejected(self):
        with self.assertRaises(RuntimeFailure):
            decode_json(b'{"ok":false,"ok":true}')

    def test_huge_model_metadata_is_not_used_for_a_fit_estimate(self):
        self.assertIsNone(estimate_memory(INFO, 10**400, 4096))

    def test_missing_optional_hardware_tools_do_not_crash_other_platforms(self):
        from devicebench.readiness.hardware import collect

        for system in ("Darwin", "Windows", "Unknown"):
            with (
                patch("devicebench.readiness.hardware.platform.system", return_value=system),
                patch("devicebench.readiness.hardware.command", return_value=None),
                patch("devicebench.readiness.hardware.shutil.which", return_value=None),
            ):
                result = collect()
                self.assertEqual(result["system"], system)
                self.assertEqual(result["gpus"], [])

    def test_json_rejects_nan_arrays_and_runtime_errors(self):
        for data in (b'{"value":NaN}', b"[]", b'{"error":"memory failure"}', b"not json"):
            with self.assertRaises(RuntimeFailure):
                decode_json(data)

    def test_dense_kv_estimate_uses_gqa_dimensions_and_requested_context(self):
        result = estimate_memory(INFO, 1024**3, 4096)
        self.assertEqual(result["kv_cache_bytes"], 16 * 4 * (64 + 64) * 4096 * 2)
        self.assertEqual(result["runtime_allowance_bytes"], 512 * 1024**2)

    def test_unsupported_memory_layouts_are_not_scored(self):
        for info in (
            {},
            {**INFO, "general.architecture": "unknown"},
            {**INFO, "llama.expert_count": 8},
            {**INFO, "llama.attention.sliding_window": 2048},
            {**INFO, "llama.attention.head_count": 0},
            {**INFO, "llama.attention.head_count_kv": 100},
        ):
            self.assertIsNone(estimate_memory(info, 1024**3, 4096))

    @patch("devicebench.readiness.checks.collect", return_value=HARDWARE)
    def test_context_exceeding_declared_limit_fails_without_loading(self, _collect):
        client = FixtureClient()
        result = model_check(client, "fixture:latest", 16384)
        self.assertEqual(
            next(item for item in result["findings"] if item["id"] == "context")["status"], "fail"
        )
        self.assertFalse(any(path in ("/api/chat", "/api/generate") for path, _ in client.requests))

    @patch("devicebench.readiness.checks.collect", return_value=HARDWARE)
    def test_model_fit_is_an_estimate_not_a_pass_verdict(self, _collect):
        result = model_check(FixtureClient(), "fixture:latest")
        estimate = next(item for item in result["findings"] if item["id"] == "estimate")
        self.assertEqual(estimate["status"], "info")
        self.assertIn("not proof", estimate["detail"])

    @patch(
        "devicebench.readiness.checks.collect",
        return_value={**HARDWARE, "memory": {"available_bytes": None}},
    )
    def test_unknown_available_memory_does_not_use_total_as_free(self, _collect):
        result = model_check(FixtureClient(), "fixture:latest")
        pool = next(item for item in result["findings"] if item["id"] == "pool-0")
        self.assertEqual(pool["status"], "warning")

    @patch("devicebench.readiness.checks.collect", return_value=HARDWARE)
    def test_unavailable_runtime_produces_report_and_action(self, _collect):
        client = FixtureClient()
        client.json = lambda *_args: (_ for _ in ()).throw(RuntimeFailure("connection refused"))
        result = doctor(client)
        self.assertEqual(exit_code(result), 2)
        self.assertTrue(result["findings"][0]["action"])

    @patch("devicebench.readiness.checks.collect", return_value=HARDWARE)
    def test_missing_gpu_probe_is_not_no_gpu_claim(self, _collect):
        result = doctor(FixtureClient())
        self.assertIn(
            "does not mean no GPU",
            next(item for item in result["findings"] if item["id"] == "gpu")["action"],
        )

    def test_older_runtime_without_capabilities_is_actually_probed(self):
        result = compatibility(
            FixtureClient(), "fixture:latest", ("streaming", "json", "tools", "embeddings")
        )
        self.assertTrue(all(item["status"] == "pass" for item in result["findings"]))

    def test_declared_unsupported_capability_does_not_trigger_inference(self):
        client = FixtureClient(["completion"])
        result = compatibility(client, "fixture:latest", ("tools", "embeddings"))
        self.assertTrue(all(item["status"] == "unsupported" for item in result["findings"]))
        self.assertFalse(any(path in ("/api/chat", "/api/embed") for path, _ in client.requests))

    def test_malformed_thinking_metadata_returns_unavailable_instead_of_crashing(self):
        client = FixtureClient(["completion", "thinking"])
        original = client.json

        def response(path, payload=None):
            value = original(path, payload)
            if path == "/api/show":
                value["thinking"] = {"values": "invalid"}
            return value

        client.json = response
        result = compatibility(client, "fixture:latest", ("json",))
        self.assertEqual(result["findings"][0]["status"], "unavailable")

    def test_missing_model_is_not_downloaded(self):
        with self.assertRaisesRegex(ValueError, "not in"):
            compatibility(FixtureClient(), "missing:latest")

    def test_model_advertised_as_cloud_is_not_probed(self):
        client = FixtureClient()
        original = client.json

        def response(path, payload=None):
            value = original(path, payload)
            if path == "/api/show":
                value["remote_host"] = "https://fixture.invalid"
            return value

        client.json = response
        with self.assertRaisesRegex(ValueError, "remote/cloud"):
            compatibility(client, "fixture:latest")

    def test_unsupported_endpoint_and_infrastructure_failure_are_distinct(self):
        for status, expected in (
            (404, "unsupported"),
            (503, "unavailable"),
            (401, "unavailable"),
            (400, "fail"),
        ):
            client = FixtureClient()
            client.request = lambda *_args, status=status: (_ for _ in ()).throw(
                RuntimeFailure("Fixture error", status)
            )
            result = compatibility(client, "fixture:latest", ("json",))
            self.assertEqual(result["findings"][0]["status"], expected)

    def test_bad_generated_json_is_failure_and_preserves_response(self):
        client = FixtureClient()
        client.request = lambda *_args: encoded({"message": {"content": "not json"}, "done": True})
        result = compatibility(client, "fixture:latest", ("json",))
        self.assertEqual(result["findings"][0]["status"], "fail")
        self.assertIn("not json", result["findings"][0]["evidence"]["response"])

    def test_schema_rejects_numeric_boolean_extra_fields_and_missing_completion(self):
        for content, done in (
            ('{"ok":1}', True),
            ('{"ok":true,"extra":0}', True),
            ('{"ok":true}', False),
        ):
            with self.assertRaises(ValueError):
                validate_probe(
                    "json", encoded({"message": {"content": content}, "done": done}), "ollama"
                )

    def test_embedding_rejects_nonfinite_and_boolean_values(self):
        for vector in ([True], [], [float("inf")]):
            with self.assertRaises((ValueError, RuntimeFailure)):
                validate_probe("embeddings", encoded({"embeddings": [vector]}), "ollama")

    def test_tools_require_correct_name_and_arguments(self):
        for function in (
            {"name": "other", "arguments": {"city": "Paris"}},
            {"name": "get_weather", "arguments": {"city": "London"}},
            {"name": "get_weather", "arguments": "invalid"},
        ):
            with self.assertRaises(ValueError):
                validate_probe(
                    "tools",
                    encoded({"done": True, "message": {"tool_calls": [{"function": function}]}}),
                    "ollama",
                )

    def test_stream_requires_framing_content_and_terminal_record(self):
        for data in (
            b'{"done":true,"message":{"content":""}}',
            b'{"done":false,"message":{"content":"READY"}}',
            b'{"done":true,"message":{"content":"READY"}}\n{"done":true,"message":{"content":""}}',
        ):
            with self.assertRaises(ValueError):
                validate_stream(data, "ollama")

    def test_openai_stream_requires_finish_reason_and_done_sentinel(self):
        valid = b'data: {"choices":[{"delta":{"content":"READY"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
        self.assertIn("Validated", validate_stream(valid, "openai"))
        with self.assertRaises(ValueError):
            validate_stream(valid.replace(b'"stop"', b"null"), "openai")
        with self.assertRaises(ValueError):
            validate_stream(valid.replace(b"data: [DONE]", b""), "openai")

    def test_openai_json_and_tools_use_openai_response_shapes(self):
        self.assertIn(
            "matched",
            validate_probe(
                "json",
                encoded(
                    {"choices": [{"finish_reason": "stop", "message": {"content": '{"ok":true}'}}]}
                ),
                "openai",
            ),
        )
        response = {
            "choices": [
                {
                    "finish_reason": "tool_calls",
                    "message": {
                        "tool_calls": [
                            {"function": {"name": "get_weather", "arguments": '{"city":"Paris"}'}}
                        ]
                    },
                }
            ]
        }
        self.assertIn("No function", validate_probe("tools", encoded(response), "openai"))

    def test_log_analysis_never_exports_raw_lines(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "runtime.log"
            path.write_text("synthetic-private-value out of memory\n", encoding="utf-8")
            findings = diagnose_log(path)
        self.assertEqual(findings[0]["id"], "memory-error")
        self.assertNotIn("synthetic-private-value", json.dumps(findings))

    def test_report_export_escapes_untrusted_content_and_refuses_overwrite(self):
        result = report(
            "Doctor <script>",
            "http://localhost",
            [
                finding(
                    "x",
                    "<img onerror=alert(1)>",
                    "fail",
                    "<script>unsafe</script>",
                    action="<iframe src=unsafe>",
                    evidence={"reply": "<script>evidence</script>"},
                )
            ],
            model="<svg onload=unsafe>",
            protocol="<img src=unsafe>",
        )
        self.assertNotIn("<script>", render(result))
        self.assertIn("&lt;script&gt;", render(result))
        self.assertNotIn("<svg", render(result))
        self.assertNotIn("<iframe", render(result))
        self.assertIn("&lt;svg onload=unsafe&gt;", render(result))
        self.assertIn("&lt;iframe src=unsafe&gt;", render(result))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "export"
            export(result, path)
            self.assertTrue((path / "report.html").is_file())
            self.assertEqual(json.loads((path / "report.json").read_text()), result)
            with self.assertRaises(FileExistsError):
                export(result, path)

    def test_html_report_exposes_context_and_preserves_the_complete_evidence(self):
        class ReportParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.record = []
                self.in_record = False
                self.visible_text = []

            def handle_starttag(self, tag, attrs):
                if tag == "pre":
                    self.in_record = dict(attrs).get("aria-label") == "Complete report JSON"

            def handle_endtag(self, tag):
                if tag == "pre":
                    self.in_record = False

            def handle_data(self, data):
                self.visible_text.append(data)
                if self.in_record:
                    self.record.append(data)

        result = report(
            "Model & Context Checker",
            "http://127.0.0.1:11434",
            [
                finding(
                    "memory",
                    "Memory estimate",
                    "warning",
                    "Estimate only.",
                    action="Run your own workload.",
                    evidence={"bytes": 1024},
                )
            ],
            model="fixture:local",
            protocol="ollama",
            context=4096,
        )
        parser = ReportParser()
        parser.feed(render(result))
        text = " ".join(parser.visible_text)
        for value in (
            "Requested context",
            "4,096 tokens",
            "fixture:local",
            "Ollama",
            "Review",
            "Run your own workload.",
            "V1 preview",
        ):
            self.assertIn(value, text)
        self.assertEqual(json.loads("".join(parser.record)), result)
        self.assertIn("default-src 'none'", render(result))

    def test_web_requests_reject_arbitrary_endpoints_files_and_invalid_types(self):
        for data in (
            {"tool": "doctor", "endpoint": "http://remote.invalid"},
            {"tool": "doctor", "log": "/etc/passwd"},
            {"tool": "inspect", "model": "fixture", "context": True},
            {"tool": "compat", "model": "fixture", "checks": "json"},
            {"tool": "compat", "model": "fixture", "checks": []},
            {"tool": "unknown"},
            [],
        ):
            with self.assertRaises(ValueError):
                validate_request(data)


if __name__ == "__main__":
    unittest.main()
