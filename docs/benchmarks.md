# Benchmarks and evidence

The benchmark runner measures repeated prompt attempts through native Ollama or
the pinned RunAnywhere Linux x64 bridge. It runs from the CLI; the readiness
dashboard does not start benchmark suites. The website's report is illustrative.

## Run with Ollama

From the repository root, use Python 3.11+, Ollama running at
`127.0.0.1:11434`, and an installed model. Replace the placeholder with its exact
inventory name. This legacy benchmark endpoint is fixed; readiness's `--endpoint`
and `--protocol` options do not apply here.

```sh
PYTHONPATH=src python3 -m devicebench doctor --backend ollama
PYTHONPATH=src python3 -m devicebench run --models YOUR_INSTALLED_MODEL --repeats 3 --warmups 1
```

Pass multiple installed names after `--models` to measure them sequentially.
Control output length with `--max-tokens`, request timeout with `--timeout`, and
the output parent directory with `--out`. A timestamped child directory is created.
Run `PYTHONPATH=src python3 -m devicebench run --help` for all options.

Windows source launch uses `$env:PYTHONPATH = "src"` in PowerShell followed by
`python -m devicebench ...`. Benchmark runtime/platform support is narrower than
the readiness toolkit; consult the [support matrix](overview.md#runtime-support).

## Use your own prompt suite

The default `suites/smoke.json` contains two narrow instruction checks. Create a
JSON suite with a name and uniquely identified cases, each with `prompt` and
`expected` strings:

```json
{
  "name": "ticket-extraction-v1",
  "cases": [
    {
      "id": "ticket-id",
      "prompt": "Extract the ticket ID from: Review ticket ZX-204. Reply only with the ID.",
      "expected": "ZX-204"
    }
  ]
}
```

Save it as `suites/ticket-extraction.json`, then run:

```sh
PYTHONPATH=src python3 -m devicebench run --models YOUR_INSTALLED_MODEL --suite suites/ticket-extraction.json --repeats 3 --warmups 1
```

Checks trim surrounding whitespace and require an exact match. They do not assess
general reasoning, semantic equivalence, or production reliability. Warm-ups are
excluded from measured summaries; failed attempts remain in task-check denominators.

## Understand the output

| File | Contents |
| --- | --- |
| `report.html` | Standalone, readable report that opens directly in a browser |
| `report.json` | Configuration, model/runtime/device details, results, and summaries |
| `runs.jsonl` | Attempt records, flushed after each attempted run |

First content is client-observed time to the first non-empty chunk. Ollama decode
throughput uses runtime output token count and decode duration. RunAnywhere's
generation throughput includes prefill, and its first-content timing excludes
model loading. Do not treat these metrics as interchangeable. Load time is recorded
separately and is not guaranteed to represent a cold load. Small-sample p95 is
descriptive, not a reliability guarantee.

Exit codes: 0 means all measured task checks passed; 1 means at least one failed;
2 means an execution/setup error occurred. Check raw outputs when a run fails.
Control background load and record your test conditions before comparing runs.
Current tooling does not control thermals, cache state, accelerator placement, or
all runtime defaults.

## RunAnywhere and engine research

Follow the [RunAnywhere build guide](runanywhere.md), then use `--backend runanywhere`
with a local GGUF path. The bridge starts a process and loads the model for each
request, so warm-ups warm OS caches only. The separate [CPU experiment](engine-experiment.md)
keeps a model resident within its benchmark process and uses its own protocol.
Those timings should not be combined into a runtime ranking.

## Import captured Ollama results

Use `devicebench import --manifest PATH --out NEW_DIRECTORY` from an installed
checkout, or the equivalent source command. A trusted manifest contains `runtime`,
`device`, `models`, `config`, and `captures`; each capture identifies `file`,
`model`, `phase`, `repeat`, `case_id`, `prompt`, and `expected`. Capture paths are
relative to the manifest. See the [README import reference](../README.md#import-captured-results).

Imported captures lack client latency, which remains unavailable. Metadata is
collector-supplied; raw-file hashes are not proof of authenticity. Import only
your own trusted manifests. Reports can include sensitive prompts, outputs, model
names, and device details; review them before sharing.
