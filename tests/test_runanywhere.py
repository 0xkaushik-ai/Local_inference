import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from devicebench import runanywhere as ra


class RunAnywhereTests(unittest.TestCase):
    def record(self, **changes):
        return dict(output="42", first_content_ms=10, generation_ms=500,
                    runtime_load_ms=100, output_tokens=3, **changes)

    def generate(self, record):
        result = subprocess.CompletedProcess([], 0, json.dumps(record), "")
        with patch.object(ra.subprocess, "run", return_value=result):
            return ra.generate("bridge", "model", "prompt", 24, 42, 10, 4)

    def test_generation_speed_does_not_claim_decode_speed(self):
        result = self.generate(self.record())
        self.assertEqual(result["generation_tokens_per_second"], 6)
        self.assertIsNone(result["decode_tokens_per_second"])
        self.assertEqual(result["runtime_load_ms"], 100)

    def test_invalid_metrics_rejected(self):
        for value in (-1, float("nan"), float("inf"), True, "10"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.generate({**self.record(), "generation_ms": value})

    def test_empty_stream_does_not_invent_latency(self):
        result = self.generate({**self.record(), "output": "", "first_content_ms": None,
                                "output_tokens": 0, "generation_ms": 0})
        self.assertIsNone(result["first_content_ms"])
        self.assertIsNone(result["generation_tokens_per_second"])

    def test_native_failure_is_not_a_success(self):
        result = subprocess.CompletedProcess([], 2, "", "model load failed")
        with patch.object(ra.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "model load failed"):
                ra.generate("bridge", "model", "p", 24, 42, 10, 4)

    def test_timeout_preserved(self):
        with patch.object(ra.subprocess, "run", side_effect=subprocess.TimeoutExpired("bridge", 1)):
            with self.assertRaises(subprocess.TimeoutExpired):
                ra.generate("bridge", "model", "p", 24, 42, 1, 4)

    def test_wrong_sdk_rejected(self):
        with tempfile.NamedTemporaryFile() as binary:
            result = subprocess.CompletedProcess([], 0, '{"version":"wrong"}', "")
            with patch.object(ra.subprocess, "run", return_value=result):
                with self.assertRaisesRegex(ValueError, "Expected SDK"):
                    ra.doctor(binary.name)

    def test_model_format_and_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.gguf"
            path.write_bytes(b"html")
            with self.assertRaisesRegex(ValueError, "GGUF"):
                ra.inspect_model(path)
            path.write_bytes(b"GGUFfixture")
            first = ra.inspect_model(path)
            path.write_bytes(b"GGUFchanged")
            self.assertNotEqual(first["sha256"], ra.inspect_model(path)["sha256"])
