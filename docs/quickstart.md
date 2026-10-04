# Install and run

Use this guide to open DeviceBench's **V1 preview** and create your first report.
The current development package is `0.2.0`. The customer app bundles Python and
the dashboard. You do not need to visit GitHub, install Python, or build source
code to use that download.

You still need a local AI server, such as Ollama, with a model installed through
that server. DeviceBench does not install a runtime or download models. Doctor
can diagnose an unavailable runtime before one is installed. No account is needed.

## Download and open the app

1. Open **Get started** on the product website. Choose the Linux x86_64 download
   when it is available. The file is `devicebench-0.2.0-linux-x86_64.tgz`.
2. Extract the complete archive using your file manager. Keep all files in the
   extracted `DeviceBench` folder together; do not move only the executable.
3. Open the `DeviceBench` application inside that folder. On a desktop that asks
   whether to run an executable, choose to run it.
4. The launcher starts DeviceBench and opens its local dashboard in your default
   browser. Keep the launcher running while you use the tools.
5. Use **Open dashboard** to reopen the page, **Stop** to stop its
   local service, or **Quit** to close DeviceBench. Closing a browser tab alone
   does not stop the application.

The local archive is a **preview candidate**, requiring a Linux x86_64 desktop
with glibc 2.42 or newer. Other distributions and desktop environments have not
yet been validated; older system libraries are outside this candidate's support
scope. Windows and macOS app downloads are not available. A website build without
the generated archive shows the download as
unavailable; no public release or signed installer is established.

The dashboard normally uses `http://127.0.0.1:8766/`. If that port is already in
use, the launcher selects another free local port. Open the address from the
launcher so you reach the correct instance.

There is no automatic updater or system-wide installation. To replace a preview,
download your reports, quit DeviceBench, extract the new archive into a separate
folder, and open its application. To remove it, quit and delete its extracted
folder and downloaded archive. Keep any reports you want to retain.

Developers can instead [run from source](#run-from-source) or
[install a local wheel](#install-a-locally-built-wheel). Those paths need Python
3.11+; Node.js is only needed for website development. See
[release evidence](readiness-release.md) for recorded validation.

## Choose your runtime

The default is native Ollama at `http://127.0.0.1:11434`. In the launcher, set the
endpoint and protocol for the local AI server you use, then select **Restart**
to apply the change. Save reports you want to keep before restarting. For an
OpenAI-compatible server, select that protocol and enter its root address, such
as `http://127.0.0.1:1234`.

The launcher also exposes the request timeout, from 1 to 120 seconds. It defaults
to 30 seconds. Changes apply when you start or restart. Connection settings are
not saved between application launches; a new launch starts with the defaults.
If a check is running when you stop, restart, or quit, the launcher asks whether
to wait for it to finish. It blocks new checks while waiting.

Use the port actually configured in your AI server; `1234` is an example. Pass the
runtime root URL, without `/v1`. Remote hosts, authentication, HTTPS, and
base-path prefixes are outside V1. Protocol support does not imply that every
runtime provides model metadata or every model supports every feature.

The dashboard's **Help & setup** button contains connection instructions for the
launcher, or terminal instructions when started from the CLI. Source and wheel users change the endpoint by stopping
their command with Ctrl+C and restarting with `--endpoint`. The API protocol can
also be selected in the dashboard.

## Your first checks

1. Confirm the dashboard shows the endpoint for your AI server, then select its
   API protocol: **Ollama native** or **OpenAI-compatible**.
2. Open **Local AI Doctor** and run it. Review connectivity, model inventory, and
   hardware findings. Diagnosis does not load a model.
3. Select an installed model in **Model & Context Checker**. Set the context size
   your app needs. Read the declared limit, estimate assumptions, and unknowns.
4. Open **App Compatibility Tester** and choose an app preset or select the
   features your app uses. Presets cover a streaming chatbot, JSON extraction,
   an assistant that calls tools, and semantic search; you can adjust their checks.
   These checks perform inference and can load a model. For embeddings, select
   a separate embedding model when needed.
5. Download the HTML report for reading or JSON for further inspection. The
   browser remembers the latest report for each tool until you reload the page.

The **Next** buttons move you to the next tool; they do not start another check.
Switching tools shows that tool's report only when its recorded settings match
the current selection. Changing a model, context, protocol, or required feature
hides a report that no longer matches and disables its downloads. Run again, or
restore the original settings to view the matching report.

For example, select **Structured JSON** for an invoice extraction app. A passing
result means the small test returned the requested schema. Use your own invoice
examples to check extraction quality after integrating the model.

Download reports you want to keep before closing or reloading the page. The
companion holds up to 16 reports temporarily for HTML export; older reports are
evicted and restarting clears that store. There is no saved-report library.

## Run from source

This optional developer path requires Python 3.11+ and a source checkout. On
Linux or macOS, run from the repository root:

```sh
PYTHONPATH=src python3 -m devicebench serve
```

Open the address printed by the server, normally `http://127.0.0.1:8766/`. Keep
the terminal open; Ctrl+C stops it. The checks use the Python standard library,
so this source launch needs no pip install.

In Windows PowerShell:

```powershell
$env:PYTHONPATH = "src"
python -m devicebench serve
```

To use another local API on Linux/macOS:

```sh
PYTHONPATH=src python3 -m devicebench serve --endpoint http://127.0.0.1:1234 --protocol openai
```

On Windows, after setting `PYTHONPATH`, use `python -m devicebench serve` with the
same endpoint/protocol arguments. Windows/macOS instructions support preview
evaluation; live validation is still pending.

Developers with Python's Tk support installed can launch the desktop controls
from source with `PYTHONPATH=src python3 -m devicebench.launcher`. The downloaded
app includes those dependencies already.

### Optional CLI checks

Equivalent source commands on Linux/macOS follow. Replace `YOUR_INSTALLED_MODEL`
with an exact inventory name. Each `--out` directory must be new.

```sh
PYTHONPATH=src python3 -m devicebench doctor --out reports/doctor-first
PYTHONPATH=src python3 -m devicebench inspect --model YOUR_INSTALLED_MODEL --context 4096 --out reports/model-first
PYTHONPATH=src python3 -m devicebench compat --model YOUR_INSTALLED_MODEL --checks streaming json --out reports/compat-first
```

Each command writes `report.html` and `report.json` to its output directory.
Exit code 0 means no failed, unsupported, or unavailable requirements; 1 means a
failed or unsupported requirement; 2 means unavailable infrastructure or an error.
Warnings can coexist with exit code 0. Read the findings before automating decisions.

## Install a locally built wheel

There is no published package registry release established for this project. These commands
use a wheel built from this repository or provided directly for evaluation. The
[development guide](development.md#build-and-check-a-package) explains how to
build and verify it.

On Linux/macOS, run from the repository root after building the wheel:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --no-index --no-deps dist/devicebench_local-0.2.0-py3-none-any.whl
.venv/bin/devicebench serve
```

In Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-index --no-deps .\dist\devicebench_local-0.2.0-py3-none-any.whl
.\.venv\Scripts\devicebench.exe serve
```

If the wheel was provided separately, replace the `dist/...whl` argument with its
actual local path. No package registry or global installation is required. Launch
the installed application using the executable inside this environment; activation
is optional. For example, `.venv/bin/devicebench doctor` on Linux/macOS or
`.\.venv\Scripts\devicebench.exe doctor` on Windows.

The wheel also provides `devicebench-app` for the graphical launcher. Unlike the
bundled archive, this developer path needs Python's Tk support supplied by your
environment. On Linux/macOS, run `.venv/bin/devicebench-app`; the terminal-only
`devicebench serve` path does not require Tk.

To start again later, rerun the `devicebench serve` command for this environment
and open the printed address. Keep your AI runtime running as well. Saved HTML
reports can be opened directly in a browser without starting DeviceBench.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| App download unavailable | This website build does not include an app archive. Use a candidate supplied directly for evaluation, or the optional source/wheel instructions if you are a developer. |
| App will not open / system-library error | Keep the full extracted folder intact. The current candidate needs a Linux x86_64 desktop with glibc 2.42 or newer; other distributions still need validation. |
| Dashboard tab was closed | Reopen it from the launcher. Closing the tab does not stop DeviceBench. |
| Runtime unavailable / connection refused | Start the runtime; check its port and chosen protocol. The website on 8765 and companion on 8766 are not inference endpoints. |
| Empty model inventory | Install a local model through the runtime, then refresh. |
| Requested model unavailable | Copy its exact name, including its tag, from Doctor or the dashboard inventory. |
| Metadata or memory unknown | Inspect the explanation. OpenAI-compatible APIs often lack sizing metadata; missing probes do not prove hardware is absent. |
| Unsupported tool calls or embeddings | Select a model that advertises the feature. Use a dedicated embedding model if needed. |
| Report disappears after changing settings | The previous report does not match the current selection. Run a new check, or restore the settings that produced the report. |
| HTML report no longer available | The companion may have restarted or evicted an older report. Run the check again, or download JSON if the report is still displayed. |
| Request deadline exceeded | Check runtime health and loading time. In the launcher, increase **Request timeout (seconds)** up to 120 and restart. Source/wheel users can restart with `serve --timeout 120`, or use `--timeout 120` with a CLI check. |
| Output directory already exists | Pick a new `--out` directory; the exporter refuses to overwrite prior evidence. |
| Companion port occupied | The desktop launcher selects another free port. For a source/wheel server, start with `serve --port 8767`, then open the printed address. |

Next: [Readiness tool reference](readiness-toolkit.md) for findings and limits, or
[V1 launch scope](roadmap.md). Existing [CLI benchmarks](benchmarks.md) are an
optional advanced workflow.
