# DeviceBench documentation

DeviceBench helps developers check their local AI setup before connecting it to
an application. Run three tools in a browser on your computer: **Local AI Doctor**,
**Model & Context Checker**, and **App Compatibility Tester**. Each gives you
findings, explanations, and an HTML or JSON report.

This is the **V1 preview**. The development package is `0.2.0`; it is part of the
same first public V1. The local Linux app candidate bundles Python and the
dashboard. It requires a Linux x86_64 desktop with glibc 2.42 or newer; broader
distribution compatibility still needs validation. Public publication and
Windows/macOS app downloads remain pending.

## Start here

1. [Download, extract, and open](quickstart.md#download-and-open-the-app) the local
   app when its candidate download is available on the website.
2. [Diagnose your runtime](readiness-toolkit.md#local-ai-doctor) with Local AI Doctor.
3. [Check model and context requirements](readiness-toolkit.md#model-and-context-checker).
4. [Test your app's required features](readiness-toolkit.md#app-compatibility-tester).
5. Export the report as HTML to read or JSON to use in your own tooling.

Each tool can be used independently. For example, a developer building an invoice
extractor can inspect a model's context requirements, test structured JSON, and
save the results before writing the integration. A passing probe describes the
tested request; test your own workload as well.

Existing [CLI benchmarks](benchmarks.md) are an optional advanced workflow.
Benchmark-control improvements are deferred while the three-tool V1 is prepared
for launch.

## Choose a guide

| Guide | What you will find |
| --- | --- |
| [Quickstart](quickstart.md) | App download and launch, runtime setup, reports, update/removal, optional developer installation, troubleshooting |
| [Readiness tools](readiness-toolkit.md) | Doctor, model/context estimates, streaming, JSON, tools, embeddings, statuses, limits |
| [Benchmarks and evidence](benchmarks.md) | Prompt suites, repeats, warm-ups, measurements, exports, captured-result import |
| [RunAnywhere](runanywhere.md) | Pinned Linux native bridge, build steps, timing boundaries |
| [Development and architecture](development.md) | Repository layout, the two interfaces, commands, tests, packaging |
| [Project roadmap](roadmap.md) | Implemented work, remaining gates, deferred scope, research direction |
| [Release evidence](readiness-release.md) | Recorded local checks and validation gaps |
| [CPU experiment](engine-experiment.md) | Build, correctness protocol, resident benchmarks, text generation |
| [Engine results](engine-results.md) | Recorded outcomes and the decision to keep the kernel opt-in |
| [Project handoff](../Documents.md) | Repository-wide handoff and native research reproduction |

## Which interface should I use?

| Interface | Address or command | Purpose |
| --- | --- | --- |
| Product website | `http://127.0.0.1:8765/` during development | Learn about the tools, download an available candidate, read documentation |
| Desktop launcher | Open `DeviceBench` in the extracted app folder | Start the companion, configure its connection, open its dashboard, stop or quit |
| Local dashboard | Open from the launcher; normally `http://127.0.0.1:8766/` | Run readiness checks against your local runtime and download reports |
| CLI | `devicebench doctor`, `inspect`, `compat`, `run`, `import` | Run checks, benchmark, and export evidence from a terminal |
| CPU research | `python -m devicebench.engine_lab` after native setup | Separate experimental kernel evaluation |

The website cannot inspect a visitor's machine or start the local companion.
Website samples are labeled illustrative. Download availability depends on that
website build including the verified archive and its manifest. There is no
published public release yet. The app includes Python and its dashboard; customers
do not need GitHub, Python installation, or rebuilding. Start the separately
installed runtime and the app on your own computer to collect real observations.

Keep the launcher open while using the app. Its **Open dashboard**, **Stop**, and
**Quit** controls manage the local service; **Restart** applies connection changes.
The launcher uses a free local port if 8766 is occupied. Source/wheel developers
can still use `devicebench serve` and keep that terminal open instead.

There is no account or hosted report storage. Download reports you want to keep;
the companion retains up to 16 reports temporarily for HTML export, which are cleared when it stops.
The browser shows the latest matching report per tool only until its page reloads.
Use **Help & setup** in the dashboard for connection guidance and launch commands.
The archive is a portable preview with manual replacement/removal, not a signed
installer or an automatic updater. The [quickstart](quickstart.md) explains its
lifecycle and the developer installation alternatives.

## Runtime support

| Workflow | Native Ollama | Local OpenAI-compatible API | RunAnywhere |
| --- | --- | --- | --- |
| Doctor | Inventory, version, reported allocation | Inventory and available hardware information | Legacy CLI diagnosis with `--backend runanywhere` |
| Model/context checker | Metadata and estimates for supported layouts | Limited by missing standardized metadata | Not integrated |
| App compatibility | Selected feature probes | Selected feature probes | Not integrated |
| Benchmark runner | Supported | Not integrated | Pinned Linux x64 bridge, CPU only |

Readiness endpoints must be unauthenticated HTTP loopback addresses. Linux has
recorded live validation. Windows/macOS fallbacks and CI configuration exist;
actual cross-platform execution is still a release gate. See the
[release evidence](readiness-release.md) for the exact tested scope.

| Device information | Current coverage |
| --- | --- |
| CPU and operating system | System information when available |
| RAM | Total and available on Linux/Windows; total only on macOS |
| NVIDIA GPU memory | Optional, when `nvidia-smi` is available |
| AMD, Intel GPU, Apple Metal, or NPU memory | Not measured in this V1 |

Missing hardware information is reported as unknown. It does not mean the device
is absent or unusable. Model sizing has the narrower limits described in the
[tool reference](readiness-toolkit.md#model-and-context-checker).

## Read results in context

Memory fit is an estimate. Compatibility checks are small integration probes.
Benchmark task checks use exact answers for a chosen suite. None of these is a
general quality score, production certification, or guarantee of successful model
loading. CPU research has its own protocol and does not establish a general speed
advantage. Reports contain prompts, outputs, and device details; review them before
sharing.
