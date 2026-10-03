# Engine research results

## First whole-model attempt: four accumulators

The first completed Qwen3 experiment did not meet the 1.20x resident-compute target.
Baseline/candidate median total-time ratios were 0.970x, 0.991x and 0.954x at
128, 512 and 1024 prompt tokens, respectively, with 64 fixed decode steps.
Every bootstrap interval included 1.0. These shared-laptop measurements do not
establish a performance advantage.

Eight paired AB/BA blocks per workload, three measured trials per process,
and one excluded warm-up produced 144 measured trials. A baseline sweep selected
eight physical cores and flash attention enabled. Same binary, model, quantization,
KV type and settings were used for both paths.

All 7,748,736 captured logits were bitwise identical across three fixed token
sequences. This establishes numerical agreement on those sequences, not general
model quality or correctness for every input.

[Full report](../reports/engine-qwen/20261003T220658.732634Z/summary.md) ·
[Raw evidence](../reports/engine-qwen/20261003T220658.732634Z/summary.json) ·
[Isolated kernel findings](engine-kernel-notes.md)

## Follow-up hypothesis

A direct AVX-512 path can process the existing eight-byte interleave while retaining
two integer lanes per output column, reducing those lanes after scaling. This aims
to remove much of the blend/shuffle work while preserving packing, prefill GEMM,
and floating-point accumulation order.

Screening rule set before follow-up whole-model measurements: use the earlier
baseline thread choice (eight), retest flash attention on/off, check full logits,
and run four paired blocks per workload with three measured trials. This smaller
screen is exploratory and cannot satisfy the eight-block acceptance gate. Proceed
to eight-block confirmation only if primary median total speedup is at least 1.10x
and no other workload has a median time regression over 5%. Retain the earlier negative
results and check the original SmolLM2 model as a regression case.

A separate **one-core diagnostic** was specified with the same 128/64 workload,
four pairs and three trials, to check whether core count changes the effect of
this arithmetic optimization. This is a new question prompted by near-parity
at eight cores, not a replacement for the tuned eight-core target. It cannot
satisfy that target or establish superiority over the fastest baseline configuration.

## Direct AVX-512 results

The final isolated kernel achieved **1.3513–1.4706x** median baseline/candidate
ratios over ten matrix shapes. All 875 fixtures / 42,000 output floats matched
bitwise. This is a warm-cache, single-thread kernel result, not application throughput.

On Qwen3 with eight physical threads, four paired blocks per workload gave:

| Prompt / decode tokens | Decode ratio | Resident total ratio | Total bootstrap interval |
| --- | ---: | ---: | ---: |
| 128 / 64 | 0.975x | 0.951x | 0.889–1.037 |
| 512 / 64 | 1.015x | 0.986x | 0.916–1.111 |
| 1024 / 64 | 1.040x | 1.037x | 1.012–1.778 |

The primary workload missed the predeclared 1.10x screening threshold; no
confirmation run was justified. The large last interval illustrates host noise.
Again, 7,748,736 captured logits matched bitwise. [Screening report](../reports/engine-qwen-direct/20261003T222257.482982Z/summary.md).

The separate one-core diagnostic observed **1.182x decode** and **1.157x resident
total** median speedup, with total interval 1.041–1.312 across four paired blocks.
Its 2,582,912 captured logits also matched bitwise. These preliminary results
suggest an effect worth retesting under a fixed core budget, but do not beat the
best eight-core baseline or satisfy the original target. [One-core report](../reports/engine-qwen-one-core/20261003T222917.654841Z/summary.md).

**Decision:** keep the implementation opt-in. The experiment demonstrates a faster
isolated kernel and a preliminary gain under a one-core constraint; it does not
establish a 20% improvement over the tuned whole-model baseline. Natural workloads,
a quiet repeat run, additional models, and a second device remain open.


## Additional verification

- SmolLM2 regression: all 2,506,752 captured logits matched bitwise at three
  context lengths; two timing pairs per workload are too few for a speed claim.
  [Regression report](../reports/engine-smol-regression/20261003T223215.639520Z/summary.md).
- Odd prefill length 131: all 2,582,912 captured Qwen3 logits matched bitwise,
  exercising GEMV remainder rows after the GEMM prefill path.
  [Evidence](../reports/engine-odd-prefill/correctness.json).
- Two natural-text greedy completions matched byte-for-byte using the upstream
  simple example linked against the patched engine. These are correctness smoke
  checks, not timing or model-quality evaluations.
  [Text outputs](../reports/engine-text-demo/results.json).
- Final checks: 23 Python tests pass; CTest passes the native kernel test with
  875 fixtures and 42,000 bitwise-equal output values. The measured engine-bench
  binary remained unchanged while the optional text demo was built.
