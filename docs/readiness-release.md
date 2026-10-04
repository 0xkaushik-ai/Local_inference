# DeviceBench V1 preview — release evidence

This record covers the locally built readiness toolkit, currently development
package `0.2.0`, being prepared for the first public V1. It has not been published
to a package registry or deployed. The [V1 launch checklist](roadmap.md#v1-launch-checklist)
tracks remaining completion work. Benchmark and CPU research observations are
separate; V1 makes no inference speed claim.

## Implemented

- Local AI Doctor: runtime/inventory/version checks, optional bounded log
  diagnosis, hardware collection, and observed model allocation.
- Model & Context Checker: model identity, declared context limits, runtime-
  supplied license information, and conservative sizing for supported layouts.
- App Compatibility Tester: selected native Ollama or OpenAI-compatible streaming,
  JSON-schema, tool-call, and embedding probes, with editable app presets.
- Loopback dashboard: model selection, protocol selection, separate embedding
  model, setup help, next-step guidance, results matched to each tool's current
  settings, inspectable evidence, and HTML/JSON downloads.
- Installable dependency-free Python wheel with bundled dashboard resources,
  source archive, pinned development tools, and fresh-install verification.
- Website toolkit section/setup commands and CI configuration for Linux,
  Windows, and macOS on Python 3.11 and 3.13.

## Customer-facing V1 alignment verification

This pass aligns the product website, local dashboard, and documentation around
the three existing V1 tools. The development package remains `0.2.0`.

| Check | Observed result |
| --- | --- |
| Python regression suite | 65 passing tests, including HTTP/security, complete HTML evidence preservation, and prior benchmark/research coverage |
| Toolkit browser suite | 11 passing Chromium tests, including tool/settings report matching, inventory refresh, failed/busy runs, hidden-input validation, app presets, guidance, runtime state, and exports |
| Responsive toolkit | All three panels checked at 320, 390, 768, 1024, and 1100 pixels wide; desktop/mobile screenshots visually reviewed without clipping |
| Accessibility | Axe checks passed for desktop Doctor, mobile Model and Compatibility, and open Help; Help keyboard opening, Escape, and focus return verified |
| Marketing website suite | 14 passing tests covering product, setup, bundled documentation, responsiveness, keyboard, and accessibility |
| Website build and lint | Production build, ESLint, and formatting checks passed for the changed website/test surface |
| Live updated dashboard | Doctor and model inspection completed against the isolated Ollama instance at `127.0.0.1:11435`; the JSON extraction preset passed its structured JSON probe with the existing Qwen3 model |
| Standalone HTML reports | Shared V1 styling, model/protocol/context metadata, original JSON preserved; desktop/mobile axe checks passed, no 320px overflow, print PDF generated |
| Rebuilt package | Wheel and source archive rebuilt; fresh isolated offline wheel installation passed CLI, packaged resources, report rendering, and transport checks |

Screenshots from the customer review are in `reports/v1-customer-review/`, covering
the website, each dashboard tool, and mobile Help. Toolkit automated screenshots
are also under `reports/readiness-browser/`. Automated browser tests use synthetic
model/API fixtures. The separate live JSON observation is saved as
`reports/v1-customer-review/live-json-probe.json` with `live-json-result.png`;
it does not establish tool-calling, embedding, or extraction-quality performance.
Standalone HTML and print examples are under `reports/readiness-export-review/`.
The source archive includes the installation, support, and workflow documentation.

Current wheel: `dist/devicebench_local-0.2.0-py3-none-any.whl`.
Verified SHA-256:
`2c4ce80994227cd7074a68a8bf84b57fbad4ac8e06bb2248e8cbfb088c0e65ab`.
This identifies the local candidate, not a published release. Recompute the hash
after any rebuild; archive timestamps can change the artifact bytes.

## Recorded verification before the customer-facing alignment pass

Local validation used Linux x64, Python 3.13.12, an Intel i7-11800H, and an NVIDIA
RTX 3050 Laptop GPU. Native tests are not substituted for cross-device results.
The results below are the recorded toolkit baseline. They do not by themselves
verify later documentation, dashboard, website, or packaging changes; rerun the
relevant checks for the exact artifact to be distributed.

| Check | Observed result |
| --- | --- |
| Python suite | 64 passing tests, including prior benchmark/research tests |
| HTTP/security integration | Native and OpenAI-shaped fixtures; redirects, malformed/oversized responses, slow bodies/headers, Host/Origin/session checks, and concurrent-request rejection |
| Toolkit browser suite | 5 passing Chromium tests: tool workflow, both protocols, exports, unsupported/outage cases, text injection resistance, responsive widths, and axe accessibility |
| Marketing website browser suite | 10 passing tests, including toolkit navigation, setup, keyboard, responsive, and axe checks |
| Live Ollama | Version 0.15.4, isolated loopback instance, existing Qwen3-0.6B Q4_K_M GGUF imported without downloading weights |
| Live Doctor and model inspection | Runtime/model/hardware detection completed; model checker distinguished declared context from estimated memory |
| Live native and OpenAI probes | Streaming and structured JSON passed through both APIs |
| Live tool calls / embeddings | Correctly reported unsupported for this imported model/runtime; successful real tool/embedding models were not verified |
| Formatting and lint | Ruff for the new Python surface; website ESLint/build and browser checks |
| Packaging | Wheel/source archive built; fresh isolated wheel install verifies CLI, reports, transport, and bundled dashboard files |

The live stream reached its output-token cap. The streaming check verifies framing
and terminal records, not instruction following or semantic answer quality. The
JSON probe validated the generated object. Neither observation establishes
production reliability across workloads.

Generated raw evidence is under `reports/readiness-live/{doctor,model,native,openai}/`.
Synthetic browser screenshots are under `reports/readiness-browser/`. Browser
fixture data is explicitly synthetic and must not be marketed as model performance.
Build artifacts are under `dist/`; those directories are ignored by Git. Use
`scripts/check-release.py` to recompute the current wheel SHA-256.

## Remaining public-release decisions and verification

- Select the project's distribution license before public distribution. A model's
  recorded license is a separate matter; the application does not interpret it.
- Run the configured Windows/macOS CI jobs and test supported hardware/runtime
  combinations on actual devices. CI configuration alone is not execution evidence.
- Validate usefulness with target developers using their real app integration.
- Verify a successful real tool-call model and embedding model. The baseline
  established unsupported results for the imported Qwen model, with successful
  protocol shapes covered by fixtures.
- Choose the actual public download/repository and contact path. No registry
  installation command, public URL, or support commitment is established here.
- Authenticated/remote runtimes, arbitrary base paths, AMD/Intel/Metal memory
  telemetry, unsupported architecture sizing, and mobile runtime integration
  remain outside V1. The marketing website cannot inspect a visitor's device;
  the user runs the local companion.

## Reproduce

Follow [README development/build commands](../README.md#install-develop-and-build).
For browser validation from `site/`:

```sh
npm ci
npm run build
npm run lint
npm test
npm run test:toolkit
```

The toolkit browser suite starts its own synthetic runtime and dashboard. Tests
require permission to bind loopback sockets and launch Chrome. The real Ollama
reports are a separate validation layer and are not produced by those fixtures.
