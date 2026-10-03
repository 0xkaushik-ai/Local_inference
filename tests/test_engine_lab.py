import array
import argparse
import json
import math
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from devicebench.engine_lab import Experiment, compare_logits, measured_median, paired_speedup, protocol_eligible


class EngineLabTests(unittest.TestCase):
    def test_timeout_preserves_partial_output_and_after_state(self):
        before, after = {"loadavg": "before"}, {"loadavg": "after"}
        timeout = subprocess.TimeoutExpired(
            ["engine-bench"], 2, output=b'{"partial":', stderr=b"interrupted \xff")
        with tempfile.TemporaryDirectory() as tmp, \
                patch("devicebench.engine_lab.physical_cpus", return_value=[2]), \
                patch("devicebench.engine_lab.host_snapshot", side_effect=[before, after]), \
                patch("devicebench.engine_lab.subprocess.run", side_effect=timeout) as run, \
                patch("builtins.print"):
            out = Path(tmp)
            args = argparse.Namespace(binary=out / "engine-bench", model=out / "model.gguf",
                                      repeats=3, timeout=2)
            experiment = Experiment(args, out)
            with self.assertRaises(subprocess.TimeoutExpired):
                experiment.run("timeout", 1, 128, 64)
            run.assert_called_once()
            self.assertEqual((out / "001-timeout.stdout").read_text(), '{"partial":')
            self.assertEqual((out / "001-timeout.stderr").read_text(), "interrupted \ufffd")
            execution = json.loads((out / "001-timeout.execution.json").read_text())
            self.assertEqual(execution["status"], "timeout")
            self.assertEqual(execution["timeout_seconds"], 2)
            self.assertEqual(execution["before"], before)
            self.assertEqual(execution["after"], after)

    def test_diagnostics_cannot_pass_full_protocol_gate(self):
        self.assertTrue(protocol_eligible("model", "model", [1, 2, 4, 8], 8, False, 8, 3))
        self.assertFalse(protocol_eligible("model", "model", [1], 8, False, 8, 3))
        self.assertFalse(protocol_eligible("other", "model", [1, 2, 4, 8], 8, False, 8, 3))
        self.assertFalse(protocol_eligible("model", "model", [1, 2, 4, 8], 8, True, 8, 3))
        self.assertFalse(protocol_eligible("model", "model", [1, 2, 4, 8], 8, False, 4, 3))
        self.assertFalse(protocol_eligible("model", "model", [1, 2, 4, 8], 8, False, 8, 1))

    def test_warmup_does_not_inflate_improvement(self):
        record = {"runs": [{"phase": "warmup", "decode_ms": 1000},
                            {"phase": "measured", "decode_ms": 10},
                            {"phase": "measured", "decode_ms": 20}]}
        self.assertEqual(measured_median(record, "decode_ms"), 15)

    def test_nonfinite_and_empty_timings_rejected(self):
        for value in [float("nan"), float("inf"), -1, 0]:
            with self.assertRaises(ValueError):
                measured_median({"runs": [{"phase": "measured", "decode_ms": value}]}, "decode_ms")
        with self.assertRaises(ValueError):
            measured_median({"runs": []}, "decode_ms")

    def test_profile_timings_cannot_be_claimed_as_speed(self):
        with self.assertRaisesRegex(ValueError, "diagnostic"):
            measured_median({"timing_claims_allowed": False,
                             "runs": [{"phase": "measured", "decode_ms": 10}]}, "decode_ms")

    def test_speedup_uses_paired_blocks_and_correct_direction(self):
        def record(value):
            return {"runs": [{"phase": "measured", "total_ms": value}]}
        pairs = [{"baseline": record(20), "candidate": record(10)},
                 {"baseline": record(40), "candidate": record(20)}]
        result = paired_speedup(pairs, "total_ms", bootstrap=100)
        self.assertEqual(result["median_speedup"], 2)
        self.assertEqual(result["bootstrap_95_interval"], [2, 2])

    def test_full_logits_check_detects_greedy_flip_within_tolerance(self):
        import sys
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / "a", Path(tmp) / "b"
            def save(path, values):
                values = array.array("f", values)
                if sys.byteorder != "little":
                    values.byteswap()
                path.write_bytes(values.tobytes())
            save(a, [1, 1.000001, 0, 3])
            save(b, [1.000001, 1, 0, 3])
            result = compare_logits(a, b, 2, 2)
            self.assertEqual(result["outside_tolerance"], 0)
            self.assertEqual(result["greedy_mismatches"], 1)
            self.assertFalse(result["passed"])
            save(b, [1, 1.000001, 0, 3])
            self.assertTrue(compare_logits(a, b, 2, 2)["bitwise_equal"])
            save(b, [1])
            with self.assertRaisesRegex(ValueError, "Truncated"):
                compare_logits(a, b, 2, 2)

    def test_nonfinite_logits_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / "a", Path(tmp) / "b"
            a.write_bytes(array.array("f", [math.nan]).tobytes())
            b.write_bytes(array.array("f", [1]).tobytes())
            with self.assertRaisesRegex(ValueError, "Nonfinite"):
                compare_logits(a, b, 1, 1)
