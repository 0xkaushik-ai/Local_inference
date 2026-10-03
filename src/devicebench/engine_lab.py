"""Resident CPU experiments; raw results precede any performance conclusion."""

import argparse
import array
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import random
import statistics
import subprocess
import sys

CANDIDATE_ENV = "DEVICEBENCH_Q4K_VNNI"


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def physical_cpus():
    """One allowed logical CPU per physical core; do not change host-wide settings."""
    allowed = sorted(os.sched_getaffinity(0))
    seen, selected = set(), []
    for cpu in allowed:
        base = Path(f"/sys/devices/system/cpu/cpu{cpu}/topology")
        try:
            key = ((base / "physical_package_id").read_text().strip(),
                   (base / "core_id").read_text().strip())
        except OSError:
            key = ("unknown", cpu)
        if key not in seen:
            seen.add(key)
            selected.append(cpu)
    return selected


def host_snapshot():
    def read(path):
        try:
            return Path(path).read_text().strip()
        except OSError:
            return None
    temperatures = {}
    for path in Path("/sys/class/thermal").glob("thermal_zone*/temp"):
        temperatures[str(path)] = {"type": read(path.parent / "type"), "millidegrees_c": read(path)}
    return {"loadavg": read("/proc/loadavg"), "meminfo": read("/proc/meminfo"),
            "vmstat": {line.split()[0]: int(line.split()[1])
                       for line in (read("/proc/vmstat") or "").splitlines()
                       if line.startswith(("pswpin ", "pswpout ", "pgmajfault "))},
            "temperatures": temperatures,
            "governor": read("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"),
            "frequency_khz": read("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"),
            "affinity": sorted(os.sched_getaffinity(0))}


def measured_median(result, key):
    if result.get("timing_claims_allowed") is False:
        raise ValueError("Instrumented diagnostic timings cannot support a speed comparison")
    values = [row[key] for row in result["runs"] if row["phase"] == "measured"]
    if not values or any(not math.isfinite(v) or v <= 0 for v in values):
        raise ValueError(f"Invalid or empty measurements: {key}")
    return statistics.median(values)


def paired_speedup(pairs, key, bootstrap=2000):
    ratios = [measured_median(pair["baseline"], key) / measured_median(pair["candidate"], key)
              for pair in pairs]
    if not ratios:
        raise ValueError("No paired observations")
    rng = random.Random(20261004)
    estimates = sorted(statistics.median(rng.choices(ratios, k=len(ratios)))
                       for _ in range(bootstrap))
    return {"median_speedup": statistics.median(ratios),
            "bootstrap_95_interval": [estimates[int(.025 * bootstrap)], estimates[int(.975 * bootstrap)]],
            "paired_speedups": ratios, "blocks": len(ratios)}


def protocol_eligible(model_hash, expected_hash, requested_threads, physical_count,
                      primary_only, blocks, repeats):
    required_threads = {n for n in (1, 2, 4, 8) if n <= physical_count}
    return (model_hash == expected_hash and required_threads.issubset(requested_threads)
            and not primary_only and blocks >= 8 and repeats >= 3)


def compare_logits(baseline, candidate, rows, columns, atol=1e-5, rtol=1e-5):
    left, right = array.array("f"), array.array("f")
    for path, values in ((baseline, left), (candidate, right)):
        if Path(path).stat().st_size != rows * columns * 4:
            raise ValueError("Truncated or unexpected logits file")
        with Path(path).open("rb") as stream:
            values.fromfile(stream, rows * columns)
        if sys.byteorder != "little":
            values.byteswap()
    mismatches, max_abs, squared, greedy_mismatches = 0, 0., 0., 0
    for a, b in zip(left, right):
        if not math.isfinite(a) or not math.isfinite(b):
            raise ValueError("Nonfinite logits")
        diff = abs(a - b)
        mismatches += diff > atol + rtol * abs(a)
        max_abs = max(max_abs, diff)
        squared += diff * diff
    for row in range(rows):
        offset = row * columns
        a = max(range(columns), key=lambda i: left[offset + i])
        b = max(range(columns), key=lambda i: right[offset + i])
        greedy_mismatches += a != b
    return {"passed": mismatches == 0 and greedy_mismatches == 0,
            "bitwise_equal": digest(baseline) == digest(candidate),
            "values": len(left), "max_absolute_error": max_abs,
            "rms_error": math.sqrt(squared / len(left)), "outside_tolerance": mismatches,
            "greedy_mismatches": greedy_mismatches, "atol": atol, "rtol": rtol}


class Experiment:
    def __init__(self, args, out):
        self.args, self.out = args, out
        self.cpus = physical_cpus()
        self.index = 0

    def run(self, label, threads, prompt, decode, seed=42, flash="on", variant="baseline", extra=(), repeats=None):
        self.index += 1
        stem = f"{self.index:03d}-{label}"
        selected = self.cpus[:threads]
        if len(selected) != threads:
            raise ValueError("Requested more threads than available physical cores")
        cmd = [str(self.args.binary.resolve()), "--model", str(self.args.model.resolve()),
               "--threads", str(threads), "--prompt-tokens", str(prompt),
               "--decode-tokens", str(decode), "--sequence-seed", str(seed),
               "--repeats", str(self.args.repeats if repeats is None else repeats),
               "--warmups", "1", "--flash-attention", flash, *map(str, extra)]
        # Pin the child with taskset, leaving the controlling process and host settings alone.
        cmd = ["taskset", "--cpu-list", ",".join(map(str, selected)), *cmd]
        env = dict(os.environ)
        env[CANDIDATE_ENV] = "1" if variant == "candidate" else "0"
        before = host_snapshot()
        print(stem, flush=True)
        (self.out / f"{stem}.execution.json").write_text(json.dumps(
            {"command": cmd, "variant": variant, "before": before, "status": "started"}, indent=2))
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=self.args.timeout)
        except subprocess.TimeoutExpired as error:
            for suffix, value in (("stdout", error.stdout), ("stderr", error.stderr)):
                value = value or ""
                if isinstance(value, bytes):
                    value = value.decode("utf-8", errors="replace")
                (self.out / f"{stem}.{suffix}").write_text(value)
            (self.out / f"{stem}.execution.json").write_text(json.dumps(
                {"command": cmd, "variant": variant, "before": before, "after": host_snapshot(),
                 "status": "timeout", "timeout_seconds": self.args.timeout}, indent=2))
            raise
        (self.out / f"{stem}.stderr").write_text(result.stderr)
        (self.out / f"{stem}.stdout").write_text(result.stdout)
        execution = {"command": cmd, "variant": variant, "before": before,
                     "after": host_snapshot(), "returncode": result.returncode}
        (self.out / f"{stem}.execution.json").write_text(json.dumps(execution, indent=2))
        if result.returncode:
            raise RuntimeError(f"{stem} failed; inspect preserved stdout/stderr")
        record = json.loads(result.stdout)
        record["execution"] = execution
        if variant == "candidate" and "DEVICEBENCH_Q4K_VNNI active" not in result.stderr:
            raise RuntimeError("Candidate kernel was not activated; refusing misleading comparison")
        return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path("build/engine/bin/engine-bench"))
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("reports/engine"))
    parser.add_argument("--blocks", type=int, default=8)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--threads", type=int, nargs="+", default=[1, 2, 4, 8])
    parser.add_argument("--primary-only", action="store_true",
                        help="Diagnostic 128/64 workload only; cannot pass the full acceptance gate")
    args = parser.parse_args()
    if args.blocks < 2 or args.repeats < 1 or not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("Need >=2 blocks, >=1 repeats, and a finite positive timeout")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    out = args.out / stamp
    out.mkdir(parents=True, exist_ok=False)
    experiment = Experiment(args, out)
    workloads = [(128, 42)] if args.primary_only else [(128, 42), (512, 73), (1024, 123)]
    try:
        metadata = {"created_at": stamp, "binary_sha256": digest(args.binary),
                    "model_sha256": digest(args.model), "model": str(args.model.resolve()),
                    "source_lock": json.loads(Path("engine/source-lock.json").read_text()),
                    "patch_sha256": digest("engine/patches/q4k-vnni.patch"),
                    "physical_cpus": experiment.cpus, "scope": "one shared host; exploratory synthetic workloads"}
        metadata["runner_sha256"] = digest(__file__)
        metadata["harness_sha256"] = digest("engine/bench.cpp")
        metadata["cmake_sha256"] = digest("engine/CMakeLists.txt")
        metadata["experiment_plan"] = json.loads(Path("engine/experiment-plan.json").read_text())
        metadata["inherited_performance_environment"] = {key: os.environ.get(key) for key in
            ("GGML_CPU_DISABLE_FUSION", "OMP_NUM_THREADS", "OMP_PROC_BIND", "OMP_PLACES", "OMP_WAIT_POLICY")}
        metadata["host"] = list(os.uname())
        metadata["cpu"] = {key.strip(): value.strip() for line in
                           Path("/proc/cpuinfo").read_text().split("\n\n")[0].splitlines()
                           if ":" in line for key, value in [line.split(":", 1)]}
        metadata["python"] = sys.version
        metadata["build_files"] = {str(path): digest(path) for path in
                                   (args.binary.parent.parent / "CMakeCache.txt",
                                    args.binary.parent.parent / "compile_commands.json") if path.exists()}
        (out / "metadata.json").write_text(json.dumps(metadata, indent=2))
        tuning = []
        for threads in args.threads:
            if threads <= 0 or threads > len(experiment.cpus):
                continue
            for flash in ("on", "off"):
                run = experiment.run(f"tune-t{threads}-fa{flash}", threads, 128, 64, flash=flash)
                tuning.append({"threads": threads, "flash": flash,
                               "total_ms": measured_median(run, "total_ms"),
                               "decode_ms": measured_median(run, "decode_ms")})
        if not tuning:
            raise ValueError("No supported thread configuration selected")
        # Tune baseline for primary end-to-end workload; keep settings fixed across variants/cases.
        chosen = min(tuning, key=lambda row: row["total_ms"])
        (out / "tuning.json").write_text(json.dumps({"all": tuning, "chosen": chosen}, indent=2))
        threads, flash = chosen["threads"], chosen["flash"]
        profile = experiment.run("profile-baseline", threads, 128, 16, flash=flash,
                                 extra=["--profile"], repeats=1)
        (out / "profile.json").write_text(json.dumps(profile, indent=2))
        correctness = []
        for prompt, seed in workloads:
            records = {}
            for variant in ("baseline", "candidate"):
                path = out / f"logits-{prompt}-{variant}.f32"
                records[variant] = experiment.run(f"check-{prompt}-{variant}", threads, prompt, 16,
                                                  seed, flash, variant, ["--logits", path], repeats=1)
            left, right = records["baseline"]["logits"], records["candidate"]["logits"]
            if records["baseline"]["input"] != records["candidate"]["input"]:
                raise ValueError("Baseline and candidate received different token sequences")
            settings = [{key: value for key, value in records[variant]["settings"].items()
                         if key != "candidate_env"} for variant in ("baseline", "candidate")]
            if settings[0] != settings[1]:
                raise ValueError("Baseline and candidate runtime settings differ")
            if (left["rows"], left["columns"]) != (right["rows"], right["columns"]):
                raise ValueError("Mismatched logits shape")
            check = compare_logits(left["path"], right["path"], left["rows"], left["columns"])
            correctness.append({"prompt_tokens": prompt, "seed": seed, **check})
        (out / "correctness.json").write_text(json.dumps(correctness, indent=2))
        if not all(row["passed"] for row in correctness):
            raise RuntimeError("Numerical correctness failed; timing comparison stopped")
        summaries = []
        for prompt, seed in workloads:
            pairs = []
            for block in range(args.blocks):
                order = ("baseline", "candidate") if block % 2 == 0 else ("candidate", "baseline")
                pair = {"block": block, "order": order}
                for variant in order:
                    pair[variant] = experiment.run(f"p{prompt}-b{block}-{variant}", threads, prompt, 64,
                                                   seed, flash, variant)
                pairs.append(pair)
                (out / f"pairs-{prompt}.json").write_text(json.dumps(pairs, indent=2))
            summaries.append({"prompt_tokens": prompt, "decode_tokens": 64, "sequence_seed": seed,
                              **{key: paired_speedup(pairs, key) for key in ("prefill_ms", "decode_ms", "total_ms")}})
        primary = summaries[0]["total_ms"]
        eligible = protocol_eligible(metadata["model_sha256"],
                                     metadata["experiment_plan"]["primary_model"]["sha256"],
                                     args.threads, len(experiment.cpus), args.primary_only,
                                     args.blocks, args.repeats)
        result = {"metadata": metadata, "tuning": chosen, "correctness": correctness,
                  "workloads": summaries,
                  "full_protocol_eligible": eligible,
                  "exploratory_target_met": eligible and primary["median_speedup"] >= 1.2
                  and primary["bootstrap_95_interval"][0] > 1
                  and all(s["total_ms"]["median_speedup"] >= 1 / 1.05 for s in summaries),
                  "limitations": ["Synthetic fixed tokens, no sampling or text tokenization in timings",
                                  "One shared laptop, no controlled clock/thermal state or second machine",
                                  "Bootstrap resamples blocks; correlated host noise may invalidate nominal coverage",
                                  "Only this model, quantization and CPU; no general speed superiority established"]}
        (out / "summary.json").write_text(json.dumps(result, indent=2))
        lines = ["# CPU inference experiment", "", f"Model SHA-256: `{metadata['model_sha256']}`", "",
                 f"Tuned baseline: {threads} physical threads; flash attention {flash}.", "",
                 "Speedup = baseline time / candidate time. Above 1 is faster. Intervals are exploratory.", "",
                 "| Prompt / decode tokens | Prefill speedup | Decode speedup | Total speedup (95% interval) |",
                 "|---|---:|---:|---:|"]
        for s in summaries:
            total = s["total_ms"]
            lo, hi = total["bootstrap_95_interval"]
            lines.append(f"| {s['prompt_tokens']} / 64 | {s['prefill_ms']['median_speedup']:.3f}× | "
                         f"{s['decode_ms']['median_speedup']:.3f}× | {total['median_speedup']:.3f}× ({lo:.3f}–{hi:.3f}) |")
        lines += ["", f"Full-vocabulary logits correctness passed on {len(correctness)} fixed token sequences.", "",
                  f"Exploratory 20% primary-workload target met: **{result['exploratory_target_met']}**.", "",
                  *[f"- {limit}" for limit in result["limitations"]]]
        (out / "summary.md").write_text("\n".join(lines) + "\n")
        print(f"Results: {out / 'summary.md'}")
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.SubprocessError) as error:
        (out / "failure.json").write_text(json.dumps({"error": str(error)}, indent=2))
        parser.exit(2, f"engine-lab: {error}; evidence preserved in {out}\n")


if __name__ == "__main__":
    main()
