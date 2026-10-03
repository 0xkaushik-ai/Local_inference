# DeviceBench

A local inference measurement prototype: repeatable prompts, task checks, raw evidence,
and standalone HTML reports. Working name; no affiliation with RunAnywhere.

## Status

Adapters support local Ollama and RunAnywhere’s Linux x64 desktop kit 0.20.38
(C API, llama.cpp backend, CPU only). Real inference has been exercised on both.
This project does not demonstrate an advantage over RunAnywhere.
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
above before proposing a change. No formatter/linter is configured yet. `AGENTS.md`
is preserved. Python uses only the standard library. Native artifact versions and hashes are pinned
in `native/sdk-lock.json`.

Reports contain prompts, outputs, model metadata, and device details. Review before sharing.
No deployment, telemetry, accounts, or automatic publishing are included. A distribution
license has not yet been selected; do not present this prototype as a released OSS product.
