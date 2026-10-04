# DeviceBench — project handoff

This is the repository-wide handoff for DeviceBench. The first public **V1** is a
local AI readiness toolkit with three tools, a dashboard, CLI, and reports. The
current development package is `0.2.0`. Existing benchmark and CPU research work
is documented as an optional advanced track. Start with the
[documentation overview](docs/overview.md) for a guide to every workflow and the
[quickstart](docs/quickstart.md) for source, Windows, or local-wheel installation.
The [roadmap](docs/roadmap.md) consolidates current scope and remaining work.

## Product and interfaces

The V1 product journey is **connect → diagnose → inspect a model → test app
features → export a report**. Tools are independently usable. Readiness checks
share Python implementations between the CLI and local dashboard on port 8766.
Benchmarks use the CLI. The React website on development port 8765 presents the
product, illustrative readiness reports, and documentation bundled from repository
Markdown. It does not inspect hardware or run inference.

| Workflow | Entry point | Guide |
| --- | --- | --- |
| Local AI Doctor | `devicebench doctor` or local dashboard | [Doctor](docs/readiness-toolkit.md#local-ai-doctor) |
| Model & Context Checker | `devicebench inspect` or local dashboard | [Model/context reference](docs/readiness-toolkit.md#model-and-context-checker) |
| App Compatibility Tester | `devicebench compat` or local dashboard | [Compatibility reference](docs/readiness-toolkit.md#app-compatibility-tester) |
| Benchmark and export | `devicebench run` / `import` | [Benchmark guide](docs/benchmarks.md) |
| Website and docs | `cd site` then `npm run dev` after `npm ci` | [Website development](site/README.md) |
| Architecture, tests, and packaging | Python, npm, and native workflows | [Contributor guide](docs/development.md) |
| CPU experiment | Native build and `devicebench.engine_lab` | [Protocol](docs/engine-experiment.md) |

The CPU experiment modifies one kernel in pinned llama.cpp. Its isolated speedup
is not evidence of a general whole-model performance advantage.

## What is built

DeviceBench V1 centers on the **Local AI Doctor**, **Model & Context Checker**,
and **App Compatibility Tester**, sharing a loopback dashboard and Python CLI.
These tools support native Ollama and local OpenAI-compatible APIs with explicit
capability limits. See [toolkit installation and usage](docs/readiness-toolkit.md)
and [current release evidence](docs/readiness-release.md). Benchmark-control
improvements are deferred; the existing benchmark and CPU experiment described
below remain separate workflows.

| Part | What it does | Main files |
| --- | --- | --- |
| V1 readiness tools | Diagnoses local runtimes and hardware, estimates supported model/context memory, and probes selected app capabilities. | `src/devicebench/readiness/checks.py`, `hardware.py`, `transport.py` |
| Local dashboard and reports | Runs the same checks as the CLI, explains findings, and downloads HTML/JSON reports. | `src/devicebench/readiness/server.py`, `report.py`, `web/` |
| DeviceBench CLI | Runs a prompt suite through local Ollama or RunAnywhere, checks exact answers, and writes JSON, JSONL, and standalone HTML evidence. | `src/devicebench/cli.py`, `suites/smoke.json` |
| RunAnywhere adapter | Calls the Linux x64 desktop kit's llama.cpp backend through a small C++ bridge. Records loading and generation separately. | `native/runanywhere.cpp`, `src/devicebench/runanywhere.py` |
| CPU kernel experiment | Selects original or direct AVX-512/VNNI Q4_K arithmetic with `DEVICEBENCH_Q4K_VNNI`. It keeps the existing model format. | `engine/patches/q4k-vnni.patch` |
| Engine benchmark and demo | Keeps a model resident for controlled token tests; the demo generates real text through the patched library. | `engine/bench.cpp`, `src/devicebench/engine_lab.py`, `engine/CMakeLists.txt` |
| Verification | Tests evidence handling, kernel arithmetic, and full-vocabulary model outputs. | `tests/`, `engine/kernel_test.cpp` |

Versioned download locations and SHA-256 values are in `engine/source-lock.json`, `engine/experiment-plan.json`, and `native/sdk-lock.json`. Downloaded models and SDKs live in `.cache/`; compiled binaries in `build/`; generated results in `reports/`. Those directories are ignored by Git. The current workspace has the downloads and builds; a fresh checkout needs the setup below.

## What the results show

On this laptop's Intel i7-11800H, the final kernel was **1.35–1.47× as fast in isolated tests** across ten matrix shapes. Its 875 native test cases produced 42,000 bit-for-bit identical output values. Qwen3 full-model checks also matched all captured logits, and two greedy text completions matched byte-for-byte.

That kernel result did **not** carry through to a consistent win when the whole Qwen3 model used its tuned eight-core setting. The primary 128-prompt/64-decode screening result was **0.951× baseline**; above 1× would mean faster. A separate four-pair, one-core diagnostic observed **1.157×** resident prompt-plus-decode speed and **1.182×** decode speed. These small, shared-laptop samples warrant retesting. The original **1.20× whole-model target remains unmet**. Warm-ups were excluded, both paths used the same weights and executable, and the engine timings exclude model loading. The raw measurements and limitations are in [engine results](docs/engine-results.md).

The Ollama and RunAnywhere reports are functional smoke tests, not comparisons with this CPU kernel. The RunAnywhere run completed four measured requests, but the small model failed all four exact-format answer checks. That distinguishes successful inference from a correct task answer.

## Requirements

Run commands from the repository root. The Python tools require Python 3.11+ and use the standard library. The native work was validated on Linux x64 with CMake 3.24+, a C++20 compiler, OpenMP, `patch`, `taskset`, `curl`, and SHA-256 tools. The RunAnywhere build also needs curl development headers and a library. The AVX-512 candidate requires a compatible CPU; a build for this machine is not portable to every CPU.

## Build and use the CPU engine experiment

1. On a **fresh checkout**, fetch the pinned llama.cpp source and apply the recorded patch. `prepare-engine.py` refuses to change a source directory that already exists, so skip it in this workspace.

   ```sh
   python3 scripts/prepare-engine.py
   ```

2. Download the pinned Qwen3 GGUF and check its hash. The same URL and digest are recorded in `engine/experiment-plan.json`.

   ```sh
   mkdir -p .cache
   curl -fL 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf' -o .cache/qwen3-0.6b-q4_k_m.gguf
   printf '%s  %s\n' 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a' '.cache/qwen3-0.6b-q4_k_m.gguf' | sha256sum -c -
   ```

3. Build and check the native code.

   ```sh
   cmake -S engine -B build/engine \
     -DLLAMA_SOURCE_DIR="$PWD/.cache/llama.cpp-836d57176dc699a726c55418e4f96b8ca628e1bf" \
     -DCMAKE_BUILD_TYPE=Release
   cmake --build build/engine -j 2
   ctest --test-dir build/engine --output-on-failure
   PYTHONPATH=src python3 -m unittest discover -s tests -v
   ```

4. Generate text with the candidate enabled. Use `DEVICEBENCH_Q4K_VNNI=0` to run the original arithmetic. An activation message on stderr confirms the candidate actually ran.

   ```sh
   DEVICEBENCH_Q4K_VNNI=1 build/engine/bin/engine-demo \
     -m .cache/qwen3-0.6b-q4_k_m.gguf -ngl 0 -n 24 \
     "The capital of France is"
   ```

5. Run the resident benchmark. It tunes the baseline's thread count and flash attention setting, verifies model outputs, then alternates baseline and candidate trials. The full default run takes substantially longer than the demo and writes a new timestamped folder under `reports/engine/`.

   ```sh
   PYTHONPATH=src python3 -m devicebench.engine_lab \
     --model .cache/qwen3-0.6b-q4_k_m.gguf
   ```

   Read `summary.md` first, then `summary.json`, `correctness.json`, `tuning.json`, and the numbered raw stdout/stderr and execution files. `--blocks 4 --threads 8` is a shorter screening run; `--threads 1 --primary-only` checks a constrained one-core case. These diagnostic options cannot satisfy the full acceptance gate. See the [protocol](docs/engine-experiment.md) for the exact measurement boundaries.

## Use DeviceBench with Ollama or RunAnywhere

For Ollama, start the local service and install the model names you intend to test. The runner uses only `127.0.0.1:11434` and does not download models.

```sh
PYTHONPATH=src python3 -m devicebench doctor
PYTHONPATH=src python3 -m devicebench run \
  --models phi3:mini llama3.2:latest --repeats 3 --warmups 1
```

For RunAnywhere, download and hash-check the SDK and optional SmolLM2 model listed in `native/sdk-lock.json`; then follow the [native setup](docs/runanywhere.md) to build `build/runanywhere/devicebench-runanywhere`. Once built:

```sh
PYTHONPATH=src python3 -m devicebench doctor --backend runanywhere
PYTHONPATH=src python3 -m devicebench run --backend runanywhere \
  --models .cache/runanywhere/smollm2-135m-q4_k_m.gguf \
  --repeats 2 --warmups 1 --max-tokens 24 --threads 4
```

Each CLI run creates `report.html`, `report.json`, and `runs.jsonl` in a new timestamped report directory. Open `report.html` locally. Exit code `0` means every measured exact-answer check passed, `1` means at least one answer failed its check, and `2` means setup or execution failed. RunAnywhere starts a fresh process and reloads the model for **each request**, whereas the engine experiment keeps the model resident within each benchmark process; their speed figures should not be compared directly. The CLI also supports `import` of trusted Ollama NDJSON captures; see the [README](README.md#import-captured-results).

## Current limits and next work

For the entire project, follow the [consolidated roadmap](docs/roadmap.md).
The V1 preview (development package `0.2.0`) has a locally built wheel and recorded Linux validation; public
publication, a distribution license, real-device Windows/macOS checks, successful
live tool-call/embedding models, and target-developer validation remain open.
[Release evidence](docs/readiness-release.md) distinguishes the implemented code,
synthetic tests, real runtime observations, and pending gates.

The CPU result covers one laptop, two small GGUF models, and synthetic fixed-token benchmark inputs. The one-core observation needs more paired runs on a quiet machine and another device. For this independent research track, the next technical milestone is a repeatable **whole-model** gain against a tuned baseline before considering engine integration or distribution. The CPU candidate remains opt-in and is not required to use V1. No public package, deployment, or commercial validation is established. A distribution license for this project has not been selected; the included llama.cpp code retains its upstream MIT notice in `engine/LLAMA-LICENSE`.
