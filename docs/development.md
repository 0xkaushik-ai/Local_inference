# Development and architecture

DeviceBench has a Python toolkit, native benchmark/research components, and a
React website. Commands below run from the repository root unless stated otherwise.
The root [README](../README.md) is the quick entry point; [Documents.md](../Documents.md)
is the project handoff.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/devicebench/cli.py` | CLI entry, legacy benchmark/import dispatch, standalone benchmark reports |
| `src/devicebench/readiness/checks.py` | Doctor, model sizing, compatibility probes |
| `src/devicebench/readiness/transport.py` | Bounded HTTP loopback runtime client |
| `src/devicebench/readiness/hardware.py` | Capability-based system and memory probes |
| `src/devicebench/readiness/server.py` | Local dashboard server, validated requests, report downloads |
| `src/devicebench/readiness/web/` | Dashboard HTML, CSS, and JavaScript bundled into the Python package |
| `src/devicebench/readiness/report.py` | Finding statuses, report schema, HTML/JSON export |
| `src/devicebench/runanywhere.py`, `native/` | Python adapter and pinned C++ bridge |
| `src/devicebench/engine_lab.py`, `engine/` | CPU experiment harness, kernel patch, native correctness checks |
| `suites/` | Benchmark prompt suites |
| `tests/` | Python behavior and HTTP integration tests, synthetic runtime fixtures |
| `site/` | React + TypeScript website and browser tests |
| `docs/` | User guides, consolidated roadmap, protocols, evidence |
| `scripts/` | Engine setup and package verification |

## Two interfaces, one set of readiness checks

The React website on development port 8765 describes the product and renders
repository documentation. Its interactive example shows illustrative readiness
findings for the same three tools as the V1 dashboard. It does not call the
runtime or start the companion.

The Python companion on port 8766 serves its own plain HTML/CSS/JavaScript dashboard.
Browser actions call the local server, which uses the same checks as the CLI.
The companion calls the selected local runtime and returns findings. Its dashboard
provides setup help, editable app presets, and next-step navigation. The browser
keeps the most recent report for each tool until reload, displaying it only when
the relevant current settings match. The server retains up to 16 reports in memory
for HTML export until eviction or restart; it is not a report-history service.
The installed Python wheel works without Node.js. Benchmark suites remain CLI-only;
native research has a separate build and execution path.

The website and dashboard share a warm canvas, charcoal text, rust accent, and
the DeviceBench measurement mark. The website bundles IBM Plex fonts; the
dependency-free dashboard uses system fonts and its own stylesheet. Update both
surfaces when changing shared brand colors or product terminology.

## Python development

Use Python 3.11+. Runtime dependencies are empty; development tools are pinned.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install --no-deps --no-build-isolation -e .
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check
.venv/bin/ruff format --check
```

On Windows substitute `.venv\Scripts\python.exe` and `.venv\Scripts\ruff.exe`.
Ruff's configured scope is the new readiness code, its tests, and release checker;
legacy benchmark formatting is preserved. HTTP tests bind local sockets. Fixtures
exercise protocol/error paths without model downloads or genuine model-quality claims.

## Website development

Use Node.js 22.12+ and npm. From `site/`:

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run format:check
npm test
npm run test:toolkit
```

`npm run dev` serves port 8765. Build before `npm test`, which checks the production
bundle at port 4173 using installed Google Chrome. Install the browser if needed
with `npx playwright install chrome`. Toolkit tests use the root `.venv` and start
a synthetic runtime plus dashboard on port 18766. Browser automation needs permission
to launch Chrome and bind loopback sockets. `npm run format` applies the formatter.
See the [website guide](../site/README.md) for rendering and documentation conventions.

## Build and check a package

After Python development setup:

```sh
.venv/bin/python -m build --no-isolation
.venv/bin/python scripts/check-release.py dist/devicebench_local-0.2.0-py3-none-any.whl
```

The checker installs the wheel in a fresh temporary environment without an index,
checks the CLI and bundled dashboard resources, and prints the wheel SHA-256.
This verifies a local artifact; it does not publish a package. Cross-platform
Python checks and Linux browser checks are configured in `.github/workflows/readiness.yml`.
Do not describe configured jobs as passed until they have executed.

## Native work

Follow the [RunAnywhere guide](runanywhere.md) for its pinned SDK and bridge.
Follow the [CPU experiment](engine-experiment.md) for llama.cpp setup, native tests,
and paired measurements. Keep both workflows' requirements and evidence separate.

## Documentation and evidence

Use [the roadmap](roadmap.md) for scope and next gates. Update user-facing commands
and limitations with behavior changes. Keep validation in [release evidence](readiness-release.md)
or [engine results](engine-results.md), distinguishing synthetic fixtures from live
runtime observations. Generated `.cache/`, `build/`, `dist/`, and `reports/` contents
are ignored. Report files can contain user inputs, outputs, and device information;
they are not bundled into the website or published automatically.
