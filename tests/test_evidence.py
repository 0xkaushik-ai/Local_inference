import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from devicebench.cli import generate, load_suite, render, summarize, import_captures


class EvidenceTests(unittest.TestCase):
    def stream(self, events):
        return contextlib.nullcontext(io.BytesIO(b"\n".join(json.dumps(e).encode() for e in events)))

    def test_stream_requires_completion(self):
        with patch("devicebench.cli.api", return_value=self.stream([{"response": "42"}])):
            with self.assertRaisesRegex(RuntimeError, "completion"):
                generate("test", "prompt", 10, 42, 10)

    def test_runtime_errors_are_not_success(self):
        with patch("devicebench.cli.api", return_value=self.stream([{"error": "out of memory"}])):
            with self.assertRaisesRegex(RuntimeError, "out of memory"):
                generate("test", "prompt", 10, 42, 10)

    def test_speed_uses_runtime_tokens_not_characters(self):
        events = [{"response": "forty-two"}, {"done": True, "eval_count": 3, "eval_duration": 500000000}]
        with patch("devicebench.cli.api", return_value=self.stream(events)):
            result = generate("test", "prompt", 10, 42, 10)
        self.assertEqual(result["decode_tokens_per_second"], 6)
        self.assertEqual(result["output"], "forty-two")

    def test_empty_response_does_not_invent_first_content(self):
        with patch("devicebench.cli.api", return_value=self.stream([{"done": True}])):
            self.assertIsNone(generate("test", "p", 10, 42, 10)["first_content_ms"])

    def test_warmups_excluded_and_failures_counted(self):
        successful = dict(model="test", phase="measured", status="ok", task_pass=True,
                          first_content_ms=10, wall_ms=20, decode_tokens_per_second=30)
        rows = [successful, {**successful, "phase": "warmup", "wall_ms": 999},
                dict(model="test", phase="measured", status="error")]
        summary = summarize(rows, ["test"])[0]
        self.assertEqual(summary["attempts"], 2)
        self.assertEqual(summary["errors"], 1)
        self.assertEqual(summary["wall_ms"]["median"], 20)

    def test_duplicate_cases_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "suite.json"
            case = dict(id="same", prompt="p", expected="e")
            path.write_text(json.dumps({"cases": [case, case]}))
            with self.assertRaisesRegex(ValueError, "unique"):
                load_suite(path)

    def test_report_escapes_model_output(self):
        report = dict(summary=[], created_at="today", runtime={"version": "test"},
                      device={"cpu": "cpu", "system": "test"}, output="<script>alert(1)</script>")
        output = render(report)
        self.assertNotIn("<script>", output)
        self.assertIn("&lt;script&gt;", output)

    def test_capture_import_preserves_missing_client_measurements(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "capture.jsonl").write_text(json.dumps(dict(model="test", done=True, response="42", eval_count=2, eval_duration=1000000000)))
            manifest = dict(runtime={"version": "test"}, device={"cpu": "test", "system": "test"}, models={}, config={},
                            captures=[dict(file="capture.jsonl", model="test", phase="measured", repeat=0, case_id="a", prompt="p", expected="42")])
            (root / "manifest.json").write_text(json.dumps(manifest))
            report = import_captures(root / "manifest.json", root / "output")
            self.assertIsNone(report["runs"][0]["first_content_ms"])
            self.assertTrue(report["runs"][0]["task_pass"])
            self.assertTrue((root / "output/report.html").exists())


if __name__ == "__main__":
    unittest.main()
