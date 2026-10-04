# Local AI readiness toolkit

DeviceBench V1 brings three independently usable tools into one local dashboard.
Check your setup, inspect a model and context size, and test the features your app
uses. The Python CLI runs the same checks. This preview uses development package
`0.2.0`; public release gates are tracked in the [V1 roadmap](roadmap.md).

For the app download, first-run instructions, developer setup, and troubleshooting,
start with the [quickstart](quickstart.md). The [support matrix](overview.md#runtime-support)
distinguishes readiness, benchmark, and research adapters.

## Install and launch

Use the website's available Linux preview download, extract its complete
`DeviceBench` folder, and open the `DeviceBench` application. Python and the
dashboard are bundled; no GitHub checkout, Python installation, or build step is
needed. The local candidate requires a Linux x86_64 desktop with glibc 2.42 or
newer. Other distributions remain unvalidated, and Windows/macOS app downloads
are not available. Websites without the generated archive display an unavailable
download state. Public distribution is still pending.

The launcher starts the local service and opens its browser dashboard. Use **Open
dashboard** to return to it, **Stop** to stop the service, and **Quit** to exit.
Keep the launcher open while running checks. Closing a browser tab does not stop
the application. If port 8766 is occupied, the launcher chooses another free local
port; use the address it opens. For manual replacement/removal instructions,
see the [customer quickstart](quickstart.md#download-and-open-the-app).

Install and start your AI runtime and models separately. DeviceBench does not
download them. No account is required. Set the runtime address and API protocol
in the launcher, then use **Restart** to apply changes. Save reports first;
restarting clears the temporary report store. Request timeout is also configurable
in the launcher, from 1 to 120 seconds.

### Developer installation

The source and wheel alternatives require Python 3.11+. The readiness checks use
only the standard library; Node.js and curl are not required for those checks.
If you have a locally built wheel, install it into a virtual environment. A public
package registry release is not established; see
[build instructions](development.md#build-and-check-a-package):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --no-index --no-deps dist/devicebench_local-0.2.0-py3-none-any.whl
.venv/bin/devicebench serve
```

On Windows use `python` and `.venv\Scripts\python.exe` /
`.venv\Scripts\devicebench.exe`. Start the model runtime separately. Open
`http://127.0.0.1:8766/`; Ctrl+C stops the dashboard. From a source checkout,
`PYTHONPATH=src python3 -m devicebench serve` also works on POSIX systems.

The CLI examples below use `devicebench` for brevity. If the environment is not
activated, use `.venv/bin/devicebench` on Linux/macOS or
`.\.venv\Scripts\devicebench.exe` in Windows PowerShell instead.

For an alternate unauthenticated local OpenAI-compatible runtime:

```sh
devicebench serve --endpoint http://127.0.0.1:1234 --protocol openai
```

Endpoint paths are selected by the tool. Pass the runtime root URL, not `/v1`.
Numeric IPv4/IPv6 loopback addresses are supported; `localhost` is normalized
to `127.0.0.1`. Remote hosts, TLS, credentials, redirects, proxies, and base-path
prefixes are outside V1. OpenAI-compatible is a wire protocol, not a claim that
every provider, model, or feature has been validated.

Open **Help & setup** in the dashboard for launch commands, connection guidance,
and the preview's support limits. In the app, change the endpoint in its launcher
and restart. With a source/wheel server, restart the companion with `--endpoint`;
selecting an API protocol in the dashboard uses the configured address.

## Local AI Doctor

**Start here if your setup is new or your runtime is not connecting.** Run Doctor
from the dashboard, then review the findings and suggested next steps. It checks
what is available; it does not install or repair your runtime automatically.

```sh
devicebench doctor
devicebench doctor --out reports/readiness-doctor
devicebench doctor --log /path/to/your/ollama.log
```

The doctor reads model inventory and, for Ollama, version and running-model
allocation. It collects CPU/system information, available Linux/Windows RAM,
macOS total RAM, and optional NVIDIA memory through `nvidia-smi`. Missing probes
produce explicit unknowns. AMD/Intel/Metal memory and NPU telemetry are not
measured in this version. No model is loaded by diagnosis.

The optional CLI-only log check reads at most the last 1 MiB of a file explicitly
supplied by the user. It recognizes memory, GPU discovery, permission, and port
errors; raw log lines are excluded from reports. This is pattern matching, not
an exhaustive diagnosis. The dashboard cannot read arbitrary local files.

`doctor --backend runanywhere` and `doctor --backend ollama` retain the original
backend diagnostic behavior for existing workflows.

## Model and context checker

**Use this before choosing a context size for your application.** Context is the
token budget for a model's input and output. A larger context may require more
memory. Set the size you intend to use and inspect the estimate and its assumptions.
This input does not change your runtime's settings.

Select an exact installed name from Doctor or the dashboard's inventory:

```sh
devicebench inspect --model YOUR_INSTALLED_MODEL --context 4096
devicebench inspect --model YOUR_INSTALLED_MODEL --context 8192 --out reports/model-check
```

The checker reads Ollama model metadata, quantization, declared capabilities,
context limit, digest, file size, and any runtime-supplied license. It does not
independently authenticate metadata or interpret the model's license terms.

The estimator supports known dense full-attention `llama`, `qwen2`, `qwen3`,
and `phi3` layouts with sufficient metadata. MoE, sliding-window, hybrid, or
unknown layouts remain unscored. The formula uses file size as an approximation
of weight memory, one sequence of FP16 key/value cache, and a heuristic allowance
equal to the greater of 512 MiB or 15% of weight size. It is not a measured load
requirement or guaranteed fit.

Each measured RAM/GPU pool is assessed independently with 15% available-memory
headroom. Discrete GPUs are not summed, and unified memory is not double-counted.
Unknown available memory never becomes a positive fit verdict. OpenAI APIs do
not standardize this metadata, so this tool reports those limits honestly.

## App compatibility tester

**Choose the features your app actually needs.** A chat UI may need streaming;
an extractor may need structured JSON; an assistant may need tool calling; a
search workflow may need embeddings. Select those checks and run the test. A
separate embedding model can be selected for the same report.

The dashboard's **What are you building?** presets make a starting selection:

| Preset | Checks selected |
| --- | --- |
| A streaming chatbot | Streaming |
| JSON data extraction | Structured JSON |
| An assistant that calls tools | Streaming and tool calling |
| Semantic search | Embeddings |

Adjust the checkboxes to match your app. These presets select API probes; they do
not test a complete chatbot, extraction pipeline, assistant, or search system.

```sh
devicebench compat --model YOUR_INSTALLED_MODEL --checks streaming json
devicebench compat --model YOUR_INSTALLED_MODEL --checks tools
devicebench compat --model YOUR_CHAT_MODEL --checks streaming json tools embeddings --embedding-model YOUR_EMBEDDING_MODEL
devicebench compat --endpoint http://127.0.0.1:1234 --protocol openai --model YOUR_INSTALLED_MODEL --checks streaming json
```

Only selected features are tested. When native metadata explicitly excludes a
feature, it is reported unsupported without starting inference. Older runtimes
without capability metadata are probed instead. Advertised cloud/remote models
are rejected; contacting a loopback runtime does not prove that the runtime
itself never makes external connections.

The probes validate:

- Streaming: multiple NDJSON or SSE frames, non-empty output, and terminal
  records. Incremental arrival timing is not measured.
- JSON: the exact requested schema, including boolean types and no extra keys.
- Tools: one expected function name and valid arguments. No function runs.
- Embeddings: one non-empty vector of finite numbers. Semantic quality is not
  tested. A dedicated embedding model can be selected.

These are small fixed integration checks, not general capability scores or
reliability benchmarks. Generative requests are capped at 128 output tokens;
Ollama chat requests use a 2048-token context and five-minute keep-alive. Model
loading consumes resources and changes residency. The runtime may ignore options.

## Statuses, reports, and limits

After a run, read the findings and next steps, then download the HTML report for a
readable record or JSON for automation. A report applies to the model, runtime,
settings, and features recorded in it. Rerun after changing your setup.

Each tool has its own most recent report in the current browser page. The
dashboard displays it only when the selected protocol, model, context, features,
and embedding model relevant to that tool match the recorded request. Changing
those settings hides a mismatched report and disables its exports; restoring the
settings can show the matching report again. Starting a new check replaces the
previous result for that tool. Refreshing model inventory keeps you in the same
tool. Next-step buttons select another tool without starting inference.

`pass` means the recorded requirement was observed. `fail` means the observation
did not satisfy it. `unsupported` means a declared feature or endpoint is
unsupported. `unavailable` means infrastructure or protocol errors prevented a
usable observation. `warning` and `info` describe limits and estimates.

CLI exit codes are `0` for no failed/unsupported/unavailable requirements, `1`
for failed or unsupported requirements, and `2` for unavailable/error conditions.
Warnings may coexist with exit code 0; inspect the findings before automation.
Both exports preserve statuses, assumptions, fixed prompts, and response
evidence. Response previews are capped at 65,536 characters with explicit
truncation and byte-count fields. Error responses may contain less evidence than
completed responses.

Reloading or closing the page clears its displayed reports. Separately, the local
companion retains up to 16 reports in memory for HTML export, evicting older ones;
stopping it clears that store. This is temporary storage, not a browsable history.
Download results you want to keep. If an HTML export expires, rerun the check or
download JSON while its report is still displayed.

CLI `--out` creates a new directory and refuses to
overwrite an existing one. HTML escapes runtime-controlled text and contains
no executable scripts. Exported prompts, outputs, model names, endpoint ports,
and device information may be sensitive; review before sharing.

Requests have a total deadline (default 30 seconds, configurable up to 120) and
an 8 MiB response cap. Each selected feature can take one request deadline,
plus inventory/metadata calls. The dashboard runs one tool at a time, binds only
to loopback, checks Host/Origin and session tokens, and serves an asset allowlist.
It is a local companion, not a server to deploy publicly.

## API references

Implementation follows the official [model inventory](https://docs.ollama.com/api/tags),
[model details](https://docs.ollama.com/api-reference/show-model-details),
[running models](https://docs.ollama.com/api/ps),
[chat](https://docs.ollama.com/api/chat), and
[embedding](https://docs.ollama.com/api/embed) APIs. Endpoint availability is
detected rather than inferred solely from a version number.
