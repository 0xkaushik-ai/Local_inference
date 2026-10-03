# CPU inference experiment

This is an opt-in optimization of a pinned llama.cpp kernel, not a new independent
engine or a claim of general superiority. The first target is a reproducible 20%
resident-inference speedup on one defined workload, with correctness preserved.
The experiment may reject that hypothesis.

## What changes

On compatible x86 builds, the candidate uses VNNI integer dot-product instructions
inside the repacked Q4_K matrix-vector kernel. It replaces the existing pairwise
16-bit multiply/add and shuffle sequence with direct AVX-512 dot products.
Two integer lanes per output column are retained through the scaled block and
then reduced. The initial serial-accumulator attempt was slower; a four-accumulator
revision was approximately at parity. Both are retained under `reports/engine-kernel/`. Weight layout,
scales, minimum correction, and floating-point accumulation order are retained.
Other quantizations and the matrix-matrix prefill kernel are unchanged.

`DEVICEBENCH_Q4K_VNNI=0` uses the original arithmetic. `=1` enables the candidate.
The same executable contains both paths. The wrapper adds process-level selection
to both; this is not an independently built pristine-upstream executable.
Unsupported builds reject the candidate. The native binary targets the build host;
do not copy it to an older CPU.

Source: [llama.cpp](https://github.com/ggml-org/llama.cpp/tree/836d57176dc699a726c55418e4f96b8ca628e1bf).
The commit and downloaded archive hash are in `engine/source-lock.json`.
The model choice and acceptance criteria are recorded in `engine/experiment-plan.json`. The exact
change is stored as `engine/patches/q4k-vnni.patch`; downloaded sources remain ignored.
Upstream MIT attribution is retained in `engine/LLAMA-LICENSE`; this project has not selected its own release license.

## Build and run

Requires Linux x64, GCC/Clang with C++20, CMake 3.24+, OpenMP, `patch`, `taskset`,
Python 3.11+, and a local GGUF model. The experiment disables GPU and external BLAS
backends, enables native CPU instructions and upstream weight repacking, and uses
Release settings. No Python packages are required.

```sh
# On a fresh checkout; refuses to change an existing source directory:
python3 scripts/prepare-engine.py
cmake -S engine -B build/engine \
  -DLLAMA_SOURCE_DIR="$PWD/.cache/llama.cpp-836d57176dc699a726c55418e4f96b8ca628e1bf" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build/engine -j 2
ctest --test-dir build/engine --output-on-failure
PYTHONPATH=src python3 -m unittest discover -s tests -v
PYTHONPATH=src python3 -m devicebench.engine_lab \
  --model .cache/qwen3-0.6b-q4_k_m.gguf
```

Download the primary Qwen3 GGUF from the pinned URL in `engine/experiment-plan.json`
and verify its listed SHA-256 before running. See [RunAnywhere setup](runanywhere.md)
for the additional SmolLM2 regression model and its hash.
The runner never downloads a model. Result directories are new timestamped directories
under `reports/engine/`; failed runs preserve available evidence and return nonzero.

## Generate real text

The build also includes upstream's minimal greedy text example, linked against
this patched runtime. It is a completion demo, with no chat template or server.

```sh
DEVICEBENCH_Q4K_VNNI=1 build/engine/bin/engine-demo \
  -m .cache/qwen3-0.6b-q4_k_m.gguf -ngl 0 -n 24 \
  "The capital of France is"
```

Set the environment variable to `0` for original arithmetic. The candidate writes
an activation marker to stderr when its kernel actually executes. This demo's
reported timing is not a controlled benchmark; use the experiment runner above.

## Protocol

1. Sweep the baseline across 1, 2, 4 and 8 physical cores and flash attention on/off.
   Select lowest median total time on the primary 128-prompt/64-decode workload.
   Hold those settings fixed for both paths and all subsequent workloads.
2. Profile the baseline separately. The scheduler callback synchronizes each node
   and can inhibit fusion: profile values diagnose operations, not unperturbed timings.
3. Compare all vocabulary logits at 17 positions on three fixed input sequences
   with 128/512/1024 prompt tokens. Require absolute/relative error within 1e-5
   and identical per-position greedy choices. An isolated C++ test additionally
   requires bitwise-equal kernel results over random and extreme-value fixtures.
4. Run eight paired blocks per workload, alternating baseline/candidate order.
   Each process loads the model once, warms up once, then measures three times.
   Clear KV state between trials; keep weights/context resident. Inputs use a
   deterministic LCG and valid vocabulary tokens. No sampling, EOS early stopping,
   tokenization, or text-quality claims are part of this timing experiment.
5. Report prefill, decode and their sum; the total excludes loading, KV clearing,
   first-batch preparation, and output handling. It is **not application latency**.
   Report paired speedup and a bootstrap interval across blocks, not token samples.

The full gate requires the planned Qwen3 model hash, the complete supported
1/2/4/8 thread sweep, all three workloads, at least eight blocks and three repeats.
`--primary-only` and restricted thread sweeps are diagnostic and cannot pass it.
The exploratory performance gate requires >=1.20x median total speedup on the primary workload,
a bootstrap lower bound >1, successful correctness checks, eight blocks, and no
>5% median total slowdown on the other workloads. See [recorded outcomes](engine-results.md) for completed experiments.
A clean repeat, natural prompts,
additional models and a second machine remain necessary before a product claim.

Affinity pins child processes to one allowed logical CPU per physical core. Host
power settings remain unchanged. Every launch records temperatures, load, memory,
swap counters and governor; every trial records peak process RSS and page faults.
RSS is a process high-water mark, not a live model-only memory measurement. Thermal
and background-load correlation can make bootstrap intervals overconfident.
