# DeviceBench

A local AI toolkit for developers preparing an application to run on their own
machine. Check your setup, understand a model's memory needs, test the features
your app requires, and save a report you can inspect or share.

**V1 preview:** three tools, one local dashboard, and a matching CLI. The current
development package is `0.2.0`; all three tools belong to the first public V1.
Linux has recorded live validation. Public package publication and Windows/macOS
validation remain pending; see the [V1 launch checklist](docs/roadmap.md#v1-launch-checklist).

| Tool | The question it helps answer |
| --- | --- |
| **Local AI Doctor** | Can DeviceBench reach my runtime, and what hardware and models are available? |
| **Model & Context Checker** | What does this model declare, and how much memory might my chosen context require? |
| **App Compatibility Tester** | Does this model/runtime pass the streaming, JSON, tool-call, or embedding checks my app needs? |

## Documentation

Start with the [documentation overview](docs/overview.md) or
[installation and first run](docs/quickstart.md). The website also renders these
same guides at `http://127.0.0.1:8765/#/docs/overview` when running locally.

- [Readiness tools](docs/readiness-toolkit.md): Doctor, model/context checks, and app compatibility.
- [Benchmarks and evidence](docs/benchmarks.md): suites, metrics, exports, and captured results.
- [Development and architecture](docs/development.md): components, tests, packaging, and both interfaces.
- [Project roadmap](docs/roadmap.md): implemented work, remaining gates, and deferred scope.
- [Release evidence](docs/readiness-release.md): recorded checks and validation limits.
- [Project handoff](Documents.md): repository overview and native research reproduction.

The V1 journey is **connect → diagnose → inspect a model → test app features →
export a report**. Each tool can also be used independently. Existing benchmarks
and CPU research are optional advanced workflows; benchmark-control improvements
are deferred.

## Try the V1 preview

With Python 3.11+ and this source checkout, run from the repository root:

```sh
PYTHONPATH=src python3 -m devicebench serve
```

Open `http://127.0.0.1:8766/`. Start Ollama separately, or use
`--endpoint http://127.0.0.1:1234 --protocol openai` for another local API.
The dashboard includes Local AI Doctor, Model & Context Checker, App
Compatibility Tester, model selection, and HTML/JSON downloads. It remains
usable when the runtime is unavailable and explains missing capabilities. Models
must already be installed through your runtime. Keep the terminal open while
using the dashboard; Ctrl+C stops it.

For Windows PowerShell, use `$env:PYTHONPATH = "src"`, then
`python -m devicebench serve`. See the [quickstart](docs/quickstart.md) for full
source and local-wheel instructions on each platform.

```sh
PYTHONPATH=src python3 -m devicebench doctor
PYTHONPATH=src python3 -m devicebench inspect --model YOUR_INSTALLED_MODEL --context 4096
PYTHONPATH=src python3 -m devicebench compat --model YOUR_INSTALLED_MODEL --checks streaming json
```

Python 3.11+; no third-party runtime dependencies. Readiness supports native
Ollama and unauthenticated local OpenAI-compatible APIs with capability-based
fallbacks. Linux is the first live-validated platform. Windows/macOS are
implemented with graceful hardware fallbacks and covered by a CI configuration;
they are not claimed as live-validated here. See [toolkit usage and limits](docs/readiness-toolkit.md)
and [release evidence](docs/readiness-release.md).

### Install, develop, and build

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install --no-deps --no-build-isolation -e .
.venv/bin/devicebench serve
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check
.venv/bin/ruff format --check
.venv/bin/python -m build --no-isolation
.venv/bin/python scripts/check-release.py dist/devicebench_local-0.2.0-py3-none-any.whl
```

On Windows use `python`, `.venv\Scripts\python.exe`, and the corresponding
`.venv\Scripts\` executables. End-user installation needs only the built wheel:
`python -m pip install dist/devicebench_local-0.2.0-py3-none-any.whl`.
This command installs an artifact you built or received locally; a public package
download is not established. `requirements.lock` records zero third-party runtime dependencies;
`requirements-dev.lock` pins the formatter, linter, and build tools. Ruff covers
the new toolkit and its tests; legacy benchmark formatting is preserved.

Layout: `src/devicebench/readiness/` contains the toolkit and packaged dashboard
assets; `tests/` contains behavioral, HTTP/security, and synthetic runtime
fixtures; `site/` contains the marketing website and browser tests; `docs/`
contains scope/usage/evidence; `scripts/` contains build verification;
`suites/`, `native/`, and `engine/` retain the benchmark/research workflows.
Generated builds and evidence remain ignored under `build/`, `dist/`, and `reports/`.

## Website preview

`site/` contains the React + TypeScript product website, built with Vite. It includes
the tool overview, first-run guidance, illustrative readiness reports, and
bundled Markdown documentation. Users run checks in the local companion on 8766.
Requires Node.js 22.12+ (validated on Node 26) and npm. From the repository root:

```sh
cd site
npm ci
npm run dev
```

Open `http://127.0.0.1:8765/`. The website examples contain illustrative data; actual
readiness checks run through the companion or CLI. See [website development](site/README.md) for build, lint,
formatting, and browser-test commands. The previous Python static server should be
stopped before starting Vite on the same port.

## Advanced benchmark workflows

Adapters support local Ollama and RunAnywhere’s Linux x64 desktop kit 0.20.38
(C API, llama.cpp backend, CPU only). Real inference has been exercised on both.
DeviceBench has no affiliation with RunAnywhere. These adapters do not demonstrate
an inference speed advantage over RunAnywhere.
See [research and scope](docs/research.md) before expanding it.

## Run locally

Requires Python 3.11+, curl, an already-running Ollama at `127.0.0.1:11434`, and
locally installed models. No Python runtime dependencies or package installation required.

```sh
PYTHONPATH=src python3 -m devicebench doctor
PYTHONPATH=src python3 -m devicebench run \
  --models phi3:mini llama3.2:latest --repeats 3 --warmups 1
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

Use exact names from your local model inventory. The runner does not download models.
Reports are written to a new timestamped directory under `reports/`. Open `report.html`
directly in your browser. `report.json` contains configuration and results;
`runs.jsonl` is flushed after every attempted run.

Exit codes: `0` all measured task checks pass; `1` at least one task check fails;
`2` an execution/setup error occurred. Passing this tiny suite is not general model quality.

## RunAnywhere

Follow [native setup](docs/runanywhere.md) to build the pinned bridge and obtain a GGUF.

```sh
PYTHONPATH=src python3 -m devicebench doctor --backend runanywhere
PYTHONPATH=src python3 -m devicebench run --backend runanywhere \
  --models .cache/runanywhere/smollm2-135m-q4_k_m.gguf \
  --repeats 2 --warmups 1 --max-tokens 24 --threads 4
```

Each request starts a new process and loads the model. Warm-ups warm OS caches only;
this does not measure a resident application session. Model and bridge hashes are recorded.
The smoke run completed four measured calls without runtime errors; all four exact-format
checks failed. Raw answers and timings remain in the report.

## Measurements

- First content: client-observed time to the first non-empty output chunk, not an
  instrumented engine-level first-token measurement.
- Ollama decode throughput: output token count divided by runtime decode duration.
- RunAnywhere generation throughput: output tokens divided by generation time including
  prefill; separate decode throughput is unavailable. First content excludes model load.
- Runtime load duration: recorded separately; not guaranteed to be a cold load.
- Exact-match task checks: trim surrounding whitespace only. Raw output remains inspectable.
- Warm-ups: excluded from summaries. Failed attempts remain in task-check denominators.
- p95: nearest-rank on successful measurements; small samples are descriptive only.

Models run sequentially. Cache state, competing processes, accelerator placement,
thermal state, and runtime defaults are not controlled. Seed and temperature settings
do not guarantee reproducibility across devices or runtime releases. The runner itself
uses loopback for Ollama and a local subprocess for RunAnywhere; this does not establish that the runtime makes no external requests.

## Import captured results

Restricted environments can capture Ollama NDJSON using curl and import the evidence:

```sh
PYTHONPATH=src python3 -m devicebench import \
  --manifest reports/first-capture/manifest.json --out reports/imported-example
```

The manifest records `runtime`, `device`, `models`, `config`, and `captures`. Each capture
has `file`, `model`, `phase` (`warmup` or `measured`), `repeat`, `case_id`, `prompt`, and
`expected`. Paths are relative to the manifest. Import only your own trusted manifests.
Imported captures do not contain client latency: the report explicitly leaves it unavailable.
Collector-supplied metadata is not independently attested. Raw-file hashes detect changes
only when checked against a trusted copy; they are not proof of authenticity.

## CPU engine research

A separate [resident CPU experiment](docs/engine-experiment.md) builds pinned
llama.cpp with an opt-in Q4_K VNNI kernel candidate. It includes kernel correctness
checks, full-vocabulary logit comparisons, baseline tuning, and alternating paired
measurements. [Results and limits](docs/engine-results.md) distinguish the isolated
kernel gain from whole-model outcomes. This is experimental engine work; the earlier Ollama/RunAnywhere
smoke reports are not evidence of an engine speed advantage. The engine build also
provides a [native text-generation demo](docs/engine-experiment.md#generate-real-text).

## Development

Source: `src/devicebench/`; meaningful measurement tests: `tests/`; workloads: `suites/`.
Use standard Python formatting (four spaces, snake_case) and run the unittest command
above before proposing a change. Ruff formats/lints the new toolkit. `AGENTS.md`
is preserved. Python uses only the standard library. Native artifact versions and hashes are pinned
in `native/sdk-lock.json`.

Reports contain prompts, outputs, model metadata, and device details. Review before sharing.
No deployment, telemetry, accounts, or automatic publishing are included. A distribution
license has not yet been selected. Follow the [V1 launch checklist](docs/roadmap.md#v1-launch-checklist)
before presenting this preview as a public release.
