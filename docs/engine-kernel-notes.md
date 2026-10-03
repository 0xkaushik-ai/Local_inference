# Q4_K VNNI experiment notes

## Result and scope

The final candidate measured **1.3513–1.4706× baseline throughput in isolated kernel tests** across ten shapes. Whole-model results are separate. This modifies repacked x86 Q4_K GEMV in llama.cpp commit `836d57176dc699a726c55418e4f96b8ca628e1bf`; it is not an independent engine. The [patch](../engine/patches/q4k-vnni.patch) remains opt-in through `DEVICEBENCH_Q4K_VNNI=1`.

An initial 256-bit VNNI implementation measured **0.9414–0.9639×**, slower than baseline. Four independent accumulators shortened its dependency chain but produced **0.9824–1.0210×**, approximately parity. The final 512-bit implementation reads the existing eight-byte weight interleave directly, retaining paired integer lanes until the block finishes. It changes neither packing nor GEMM.

Selected final results (median paired baseline/candidate time ratio):

| Input length × output columns | Median ratio |
| --- | ---: |
| 1536 × 576, SmolLM2 FFN shape | 1.4315 |
| 1024 × 1024 | 1.4063 |
| 1024 × 3072 | 1.4002 |
| 3072 × 1024 | 1.4183 |

The final variant passed **875 fixtures, comparing 42,000 output floats bitwise**, including signed-byte extremes, signed activation scales, nonbinary fractional scales, varied magnitudes, unchanged inputs, and output guards.

## Reproduction and evidence

After the [engine build](engine-experiment.md), run from the repository root:

```sh
taskset -c 2 build/engine/bin/engine-kernel-test --benchmark
```

Measurements use one logical CPU, warm caches, calibrated iteration counts, and eight alternating AB/BA pairs per shape. They exclude model execution, threading, activation quantization, and sampling. Shared-machine load and changing CPU frequencies remain uncontrolled; small differences are not a product-performance claim.

The measured final test executable SHA-256 is `bd0ad6fb8d176f138f00e2bd6e4a60479626c5928664b6cea1adab24be3c0ed2`. Local artifacts include [final metadata/hashes](../reports/engine-kernel/direct-avx512-metadata.json), [final timings](../reports/engine-kernel/direct-avx512-vnni.jsonl), [initial timings](../reports/engine-kernel/initial-vnni.jsonl), and [four-accumulator timings](../reports/engine-kernel/fouracc-vnni.jsonl). Historical patches and source snapshots are in the same directory. The initial executable was replaced before hashing. Reports are ignored by Git.

## What the compiled code shows

Inspect `devicebench_gemv_q4_K_8x8_q8_K_baseline` and `devicebench_q4k_avx512_gemv`:

```sh
objdump -d -C build/engine/llama/ggml/src/CMakeFiles/ggml-cpu.dir/ggml-cpu/arch/x86/repack.cpp.o
```

The baseline contains 16 `vpmaddubsw`, 16 `vpblendd`, 35 `vpshufd`, and three `vpshufb` instructions. The final candidate contains eight 512-bit `vpdpbusd` and none of those blend/shuffle instructions. Vector stack-access entries decrease from seven to zero. [Counts](../reports/engine-kernel/direct-avx512-assembly-counts.json) are **static disassembly entries, not hardware performance counters**.

## Boundaries and next checks

The earlier four-byte packed-layout hypothesis remains unimplemented; the final candidate removes shuffles while preserving upstream packing. Whole-model correctness, prompt processing, memory, dynamic-frequency effects, and another machine must be assessed separately. Calls with multiple activation rows retain the original implementation.
