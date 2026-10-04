# Install and run

Use this guide to open DeviceBench's **V1 preview** and create your first report.
The current development package is `0.2.0`. You need:

- Python 3.11 or newer.
- Either a local checkout of this repository or a built DeviceBench wheel.
- A running local AI server, such as Ollama, and a model already installed through
  that runtime. Doctor can still diagnose an unavailable runtime.

There is no account setup. DeviceBench does not download models. Node.js is needed
only for website development. Linux has recorded live validation; Windows/macOS
instructions are provided for preview evaluation, with validation still pending.

## Run from source

On Linux or macOS, run these commands from the repository root. The readiness
tools use the Python standard library, so a source launch needs no pip install.

```sh
PYTHONPATH=src python3 -m devicebench serve
```

The server prints its address. Open `http://127.0.0.1:8766/` in your browser.
Keep the terminal open; Ctrl+C stops the companion.

In Windows PowerShell, use:

```powershell
$env:PYTHONPATH = "src"
python -m devicebench serve
```

If you received a wheel instead of source code, use the
[wheel installation steps](#install-a-locally-built-wheel) below, then continue
with your first checks. See [release evidence](readiness-release.md) for the
tested scope.

## Choose your runtime

The default is native Ollama at `http://127.0.0.1:11434`. To use an
unauthenticated local OpenAI-compatible API, launch with:

```sh
PYTHONPATH=src python3 -m devicebench serve --endpoint http://127.0.0.1:1234 --protocol openai
```

In Windows PowerShell, after setting `$env:PYTHONPATH = "src"`, use:

```powershell
python -m devicebench serve --endpoint http://127.0.0.1:1234 --protocol openai
```

Use the port actually configured in your AI server; `1234` is an example. Pass the
runtime root URL, without `/v1`. Remote hosts, authentication, HTTPS, and
base-path prefixes are outside V1. Protocol support does not imply that every
runtime provides model metadata or every model supports every feature.

The dashboard's **Help & setup** button contains connection instructions and
launch examples. To change the endpoint address, stop the companion with Ctrl+C
and relaunch it with `--endpoint`. The API protocol can be selected in the dashboard.

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

There is no published package download established for this project. These commands
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

To start again later, rerun the `devicebench serve` command for this environment
and open the printed address. Keep your AI runtime running as well. Saved HTML
reports can be opened directly in a browser without starting DeviceBench.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Runtime unavailable / connection refused | Start the runtime; check its port and chosen protocol. The website on 8765 and companion on 8766 are not inference endpoints. |
| Empty model inventory | Install a local model through the runtime, then refresh. |
| Requested model unavailable | Copy its exact name, including its tag, from Doctor or the dashboard inventory. |
| Metadata or memory unknown | Inspect the explanation. OpenAI-compatible APIs often lack sizing metadata; missing probes do not prove hardware is absent. |
| Unsupported tool calls or embeddings | Select a model that advertises the feature. Use a dedicated embedding model if needed. |
| Report disappears after changing settings | The previous report does not match the current selection. Run a new check, or restore the settings that produced the report. |
| HTML report no longer available | The companion may have restarted or evicted an older report. Run the check again, or download JSON if the report is still displayed. |
| Request deadline exceeded | Check runtime health and loading time. Restart the companion with `serve --timeout 120` to raise its per-request deadline, or use `--timeout 120` with a CLI check. |
| Output directory already exists | Pick a new `--out` directory; the exporter refuses to overwrite prior evidence. |
| Companion port occupied | Start with `serve --port 8767`, then open the printed address. |

Next: [Readiness tool reference](readiness-toolkit.md) for findings and limits, or
[V1 launch scope](roadmap.md). Existing [CLI benchmarks](benchmarks.md) are an
optional advanced workflow.
