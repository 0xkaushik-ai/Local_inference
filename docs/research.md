# Research and first milestone

Reviewed public sources on 2026-10-04.

## Existing RunAnywhere functionality

- [SDK](https://github.com/RunanywhereAI/runanywhere-sdks): local inference across
  platforms; its Console already advertises benchmark comparisons and device analytics.
- [Web app](https://github.com/RunanywhereAI/runanywhere-web): already has a benchmark
  screen covering a prompt at three token budgets.
- [Hybrid Arena](https://github.com/RunanywhereAI/hybrid-arena): an existing reproducible
  benchmark harness for local/cloud/hybrid coding-agent routing.
- [Python SDK](https://github.com/RunanywhereAI/runanywhere-sdks/blob/main/bindings/python/README.md):
  documents generation metrics and local inference. Documented installation availability
  has not been validated on this machine.
- [Ollama API](https://docs.ollama.com/api/generate): completion and timing fields used
  by the first adapter.

Basic benchmark charts are not a demonstrated market gap. A candidate direction is
portable device qualification reports that combine failures, task checks, and measurements.
This remains a hypothesis, not a verified missing feature or buyer request.

## First milestone

Build and test the evidence pipeline on installed local models. Preserve failed runs,
separate warm-ups, record model identity and configuration, and export inspectable reports.
The RunAnywhere Linux x64 desktop kit 0.20.38 has now been checksum-verified,
built, and exercised through its public C API using a local GGUF. See
[setup and observed results](runanywhere.md). Do not claim a performance win from different models or uncontrolled runs.

## Next gates

1. Confirm target device and a real developer's deployment question.
2. Extend the verified Linux CPU adapter only when a target device requires it.
3. Add task-specific acceptance checks and repeatable cache/residency controls.
4. Record accelerator placement, thermal conditions, and a larger run count.
5. Validate usefulness with maintainers or developers before expanding into a product.

Potential outreach must describe observed evidence and ask whether the problem matters.
No one has been contacted and no hiring, acquisition, or paid-pilot interest is established.
