# Development and architecture

DeviceBench has a Python toolkit, native benchmark/research components, and a
React website. Commands below run from the repository root unless stated otherwise.
The root [README](../README.md) is the quick entry point; [Documents.md](../Documents.md)
is the project handoff.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/devicebench/cli.py` | CLI entry, legacy benchmark/import dispatch, standalone benchmark reports |
| `src/devicebench/launcher.py` | Desktop launcher, connection settings, local service lifecycle, browser opening |
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
| `requirements-app.lock` | Pinned application bundling tools |

## Two interfaces, one set of readiness checks

The React website on development port 8765 describes the product and renders
repository documentation. Its interactive example shows illustrative readiness
findings for the same three tools as the V1 dashboard. It does not call the
runtime or start the companion. Its download flow checks whether this website
build includes an app archive and displays availability accordingly.

The Python companion, normally on port 8766, serves its own plain
HTML/CSS/JavaScript dashboard.
Browser actions call the local server, which uses the same checks as the CLI.
The companion calls the selected local runtime and returns findings. Its dashboard
provides setup help, editable app presets, and next-step navigation. The browser
keeps the most recent report for each tool until reload, displaying it only when
the relevant current settings match. The server retains up to 16 reports in memory
for HTML export until eviction or restart; it is not a report-history service.
The desktop launcher starts that service, opens its browser page, and provides
endpoint/protocol settings and open, stop, and quit controls. It selects a free
local port if 8766 is occupied. The bundled app includes Python and Tk, so the
customer does not install Python or build this repository. The Python wheel is
an optional developer distribution and also works without Node.js. Benchmark
suites remain CLI-only; native research has a separate build and execution path.

The website and dashboard share a warm canvas, charcoal text, rust accent, and
the DeviceBench measurement mark. The website bundles IBM Plex fonts; the
dependency-free dashboard uses system fonts and its own stylesheet. Update both
surfaces when changing shared brand colors or product terminology.

## Python development

Use Python 3.11+. Readiness runtime dependencies are empty; development tools are
pinned. Source execution of the desktop launcher also needs Python's Tk support
and a desktop display; those are bundled or supplied by the host when running
the packaged app.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.lock
.venv/bin/python -m pip install --no-deps --no-build-isolation -e .
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check
.venv/bin/ruff format --check
```

On Windows substitute `.venv\Scripts\python.exe` and `.venv\Scripts\ruff.exe`.
Ruff's configured scope covers readiness, the launcher, their tests, and app/release
build scripts; legacy benchmark formatting is preserved. HTTP tests bind local sockets. Fixtures
exercise protocol/error paths without model downloads or genuine model-quality claims.

To work on the launcher from source:

```sh
PYTHONPATH=src .venv/bin/python -m devicebench.launcher
```

The `devicebench serve` command remains available for terminal-driven development.

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

## Build and check the desktop app

On the Linux x86_64 build host, after Python development setup and installation of
Python's Tk support:

```sh
.venv/bin/python -m pip install -r requirements-app.lock
.venv/bin/python scripts/build-app.py --stage-website
.venv/bin/python scripts/check-app.py dist/app/DeviceBench
```

The app build bundles Python, the launcher, and the existing dashboard. The output
folder is `dist/app/DeviceBench/`; its executable is `DeviceBench`. Keep all files
in that folder together. The customer archive is
`devicebench-0.2.0-linux-x86_64.tgz`. Generated download assets under
`site/public/downloads/` are ignored by Git and must be included deliberately when
building a website that offers the candidate. The `--stage-website` flag copies
the archive, checksum, and manifest there. Without it, the artifacts remain under
`dist/` and the website download does not change. Run the app build with that flag
before the website build to include those assets. A source checkout or website
build alone does not produce a downloadable app.

The current candidate requires a Linux x86_64 desktop with glibc 2.42 or newer.
The manifest conservatively reports the build host's glibc version as the minimum.
This does not establish compatibility with every distribution; test the exact
artifact on each advertised system and build against an appropriate older system
baseline before broadening support. Windows/macOS app builds, code signing,
installers, and automatic updates are not provided by this workflow.

The build invokes the checker on the completed archive before staging it. The
checker extracts the archive (or copies a supplied application folder) to a
temporary directory, then runs the frozen version and self-test commands with an empty executable search
path and no Python environment overrides; this verifies bundled operation, not
the graphical launcher or other machines. The archive checksum is written next
to the archive and its metadata to `dist/app-manifest.json` (staged as
`downloads/manifest.json`). Record exact checks and hashes
in [release evidence](readiness-release.md); app-build success, checks on the
build host, cross-device validation, and publication are separate milestones.
Serving a generated archive through the local website does not publish it.

## Native work

Follow the [RunAnywhere guide](runanywhere.md) for its pinned SDK and bridge.
Follow the [CPU experiment](engine-experiment.md) for llama.cpp setup, native tests,
and paired measurements. Keep both workflows' requirements and evidence separate.

## Documentation and evidence

Use [the roadmap](roadmap.md) for scope and next gates. Update user-facing commands
and limitations with behavior changes. Keep validation in [release evidence](readiness-release.md)
or [engine results](engine-results.md), distinguishing synthetic fixtures from live
runtime observations. Generated `.cache/`, `build/`, `dist/`, and `reports/` contents
are ignored, as are generated website downloads. Report files can contain user
inputs, outputs, and device information; they are not bundled into the website
or published automatically.
