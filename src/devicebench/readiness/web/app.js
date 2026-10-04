"use strict";

const $ = (id) => document.getElementById(id);
const token = document.querySelector(
  'meta[name="devicebench-session"]',
).content;
const tools = {
  doctor: {
    name: "Local AI Doctor",
    step: "01 / SETUP",
    action: "Run diagnostics",
    description:
      "Check your connection, model inventory, and available hardware information.",
    empty: "Start with your setup.",
    hint: "Run diagnostics to check your local AI server and hardware.",
  },
  inspect: {
    name: "Model & Context Checker",
    step: "02 / MODEL",
    action: "Inspect model",
    description:
      "Choose a model and the context your app needs. See declared limits and estimated memory.",
    empty: "Understand your model.",
    hint: "Choose an installed model and context length, then inspect its requirements.",
  },
  compat: {
    name: "App Compatibility Tester",
    step: "03 / APP",
    action: "Test integration",
    description:
      "Choose the capabilities your app uses. Each check sends a small request to your model.",
    empty: "Check the features your app needs.",
    hint: "Select a model and the features to test. These checks may load a model.",
  },
};
const labels = {
  pass: "Passed",
  fail: "Failed",
  info: "Details",
  warning: "Review",
  unsupported: "Unsupported",
  unavailable: "Unavailable",
};
const presets = {
  chatbot: ["streaming"],
  extraction: ["json"],
  assistant: ["streaming", "tools"],
  search: ["embeddings"],
};
let activeTool = "doctor";
let busy = false;
let currentReport = null;
const reports = new Map();

function requestFor(tool) {
  const request = { tool, protocol: $("protocol").value };
  if (tool !== "doctor") request.model = $("model").value;
  if (tool === "inspect") request.context = Number($("context").value);
  if (tool === "compat") {
    request.checks = Array.from(
      document.querySelectorAll('input[name="check"]:checked'),
      (element) => element.value,
    );
    if (request.checks.includes("embeddings") && $("embedding-model").value)
      request.embedding_model = $("embedding-model").value;
  }
  return request;
}

function updateControls() {
  document
    .querySelectorAll("form button, form input, form select, .tool-card")
    .forEach((element) => {
      element.disabled = busy;
    });
  $("model").disabled = busy || activeTool === "doctor";
  $("model").required = activeTool !== "doctor";
  $("context").disabled = busy || activeTool !== "inspect";
  $("context").required = activeTool === "inspect";
  $("feature-controls").disabled = busy || activeTool !== "compat";
  $("app-preset").disabled = busy || activeTool !== "compat";
  $("embedding-model").disabled =
    busy ||
    activeTool !== "compat" ||
    !document.querySelector('input[value="embeddings"]').checked;
  $("run").textContent = busy ? "Checking…" : `${tools[activeTool].action} →`;
  $("next-step").disabled = busy;
  $("findings").setAttribute("aria-busy", String(busy));
  for (const id of ["export-json", "export-html"])
    $(id).disabled = busy || !currentReport;
}

function selectTool(tool) {
  if (busy) return;
  activeTool = tool;
  document.querySelectorAll(".tool-card").forEach((element) => {
    const selected = element.dataset.tool === tool;
    element.classList.toggle("selected", selected);
    element.setAttribute("aria-pressed", String(selected));
  });
  $("tool-heading").textContent = tools[tool].name;
  $("step-label").textContent = `STEP ${tools[tool].step}`;
  $("tool-description").textContent = tools[tool].description;
  $("model-controls").hidden = tool === "doctor";
  $("context-controls").hidden = tool !== "inspect";
  $("feature-controls").hidden = tool !== "compat";
  $("app-controls").hidden = tool !== "compat";
  $("request-note").textContent =
    tool === "compat"
      ? "Sends small test requests. Models may stay loaded for five minutes. Tool calls are checked, never executed."
      : tool === "inspect"
        ? "Reads metadata. Estimates do not guarantee that a model will load."
        : "Reads local information. Does not install or load models.";
  $("error").hidden = true;
  renderActive();
}

function modelOptions(models) {
  for (const id of ["model", "embedding-model"]) {
    const select = $(id);
    const previous = select.value;
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      id === "embedding-model"
        ? "Use selected model"
        : models.length
          ? "Select an installed model"
          : "No models available — run Doctor";
    select.append(placeholder);
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      select.append(option);
    }
    if (models.some((model) => model.name === previous))
      select.value = previous;
    else if (id === "model" && models.length) select.value = models[0].name;
  }
  $("model-help").textContent = models.length
    ? "Choose a model installed in your local AI server."
    : "Start your server and install a model there, then refresh this list.";
}

function updateConnection(report) {
  const connected = report.findings.some(
    (item) => item.id === "runtime" && item.status === "pass",
  );
  const count = (report.models || []).length;
  $("connection-status").textContent = connected
    ? count
      ? "Connected"
      : "No models"
    : "Unavailable";
  $("connection-dot").className =
    `connection-dot ${connected ? "connected" : "unavailable"}`;
  $("connection-summary").textContent = connected
    ? `${$("protocol").selectedOptions[0].textContent} · ${count} installed ${count === 1 ? "model" : "models"}`
    : "Start your local server, check its address, and run Doctor again.";
}

function clearReport() {
  currentReport = null;
  $("result-title").textContent = tools[activeTool].name;
  for (const id of [
    "summary",
    "raw",
    "outcome",
    "next-step",
    "report-context",
    "export-note",
  ])
    $(id).hidden = true;
  $("raw").open = false;
  $("raw-json").textContent = "";
  $("report-scope").textContent = "";
  $("report-context").textContent = "";
  $("findings").replaceChildren();
}

function showEmpty() {
  const empty = document.createElement("div");
  empty.className = "empty";
  const mark = document.createElement("span");
  mark.className = "empty-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = tools[activeTool].step.slice(0, 2);
  const title = document.createElement("h3");
  title.textContent = tools[activeTool].empty;
  const description = document.createElement("p");
  description.textContent =
    activeTool !== "doctor" && !$("model").value
      ? "No installed models are available. Use Local AI Doctor to check your connection, or refresh the model list after installing a model in your server."
      : tools[activeTool].hint;
  empty.append(mark, title, description);
  $("findings").append(empty);
  $("status").textContent =
    "No report for these settings yet. Run a check to see your results.";
}

function showOutcome(report) {
  const statuses = new Set(report.findings.map((item) => item.status));
  const blocked =
    statuses.has("fail") ||
    statuses.has("unsupported") ||
    statuses.has("unavailable");
  let title, description;
  let next = null;
  if (activeTool === "doctor") {
    const connected = report.findings.some(
      (item) => item.id === "runtime" && item.status === "pass",
    );
    const models = report.models || [];
    title = !connected
      ? "Your runtime needs attention."
      : models.length
        ? "Your local runtime is connected."
        : "Add a model to continue.";
    description = !connected
      ? "Review the connection finding below, then run diagnostics again."
      : models.length
        ? "Your installed models are available. Choose one to explore its context and memory requirements."
        : "Install a model through your AI server, then run diagnostics again to find it here.";
    if (connected && models.length)
      next = ["inspect", "Next: inspect a model →"];
  } else if (activeTool === "inspect") {
    title = blocked
      ? "Review your model settings."
      : "Your model details are ready.";
    description = blocked
      ? "Check the findings below before continuing with this model and context."
      : "Review the context limit, memory estimate, and any missing information. You can then test the API features your app needs.";
    if (!blocked) next = ["compat", "Next: test app features →"];
  } else {
    title = blocked
      ? "Some requirements need attention."
      : "Selected checks passed.";
    description = blocked
      ? "Review failed, unsupported, or unavailable features below. Adjust your model or requirements and run the checks again."
      : "Your model returned the expected responses for these checks. Download the evidence and validate your own app’s workload before deployment.";
  }
  $("outcome").className =
    `outcome ${blocked || statuses.has("warning") ? "needs-review" : ""}`;
  $("outcome-title").textContent = title;
  $("outcome-description").textContent = description;
  $("outcome").hidden = false;
  if (next) {
    $("next-step").dataset.tool = next[0];
    $("next-step").textContent = next[1];
    $("next-step").hidden = false;
  }
}

function showReport(report, request) {
  currentReport = report;
  const counts = {};
  for (const finding of report.findings) {
    const status = Object.hasOwn(labels, finding.status)
      ? finding.status
      : "info";
    counts[status] = (counts[status] || 0) + 1;
    const article = document.createElement("article");
    article.className = "finding";
    const top = document.createElement("div");
    top.className = "finding-top";
    const heading = document.createElement("h3");
    heading.textContent = finding.title;
    const badge = document.createElement("span");
    badge.className = `badge ${status}`;
    badge.textContent = labels[status];
    top.append(heading, badge);
    const detail = document.createElement("p");
    detail.textContent = finding.detail;
    article.append(top, detail);
    if (finding.action) {
      const action = document.createElement("p");
      action.className = "action";
      action.textContent = `Next step: ${finding.action}`;
      article.append(action);
    }
    if (finding.evidence !== null && finding.evidence !== undefined) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "View evidence & request details";
      const pre = document.createElement("pre");
      pre.tabIndex = 0;
      pre.textContent =
        typeof finding.evidence === "string"
          ? finding.evidence
          : JSON.stringify(finding.evidence, null, 2);
      details.append(summary, pre);
      article.append(details);
    }
    $("findings").append(article);
  }
  $("summary").replaceChildren();
  for (const [status, count] of Object.entries(counts)) {
    const pill = document.createElement("span");
    pill.textContent = `${count} ${labels[status].toLowerCase()}`;
    $("summary").append(pill);
  }
  $("summary").hidden = false;
  $("raw").hidden = false;
  $("raw-json").textContent = JSON.stringify(report, null, 2);
  $("report-scope").textContent = report.scope;
  $("status").textContent =
    `Completed ${new Date(report.created_at).toLocaleString()}.`;
  const context = [
    request.protocol === "ollama" ? "Ollama native" : "OpenAI-compatible",
  ];
  if (request.model) context.push(request.model);
  if (request.context)
    context.push(`${request.context.toLocaleString()} tokens`);
  if (request.embedding_model)
    context.push(`Embeddings: ${request.embedding_model}`);
  $("report-context").textContent = context.join(" · ");
  $("report-context").hidden = false;
  $("export-note").hidden = false;
  showOutcome(report);
}

function renderActive() {
  clearReport();
  const saved = reports.get(activeTool);
  if (saved && saved.key === JSON.stringify(requestFor(activeTool)))
    showReport(saved.report, saved.request);
  else showEmpty();
  updateControls();
}

async function run(tool = activeTool) {
  if (busy) return;
  $("error").hidden = true;
  const request = requestFor(tool);
  if (tool === "compat" && !request.checks.length) {
    $("error").textContent = "Select at least one feature your app requires.";
    $("error").hidden = false;
    return;
  }
  reports.delete(tool);
  busy = true;
  renderActive();
  $("status").textContent =
    tool !== activeTool
      ? "Refreshing your model list…"
      : tool === "compat"
        ? "Testing your selected features. Loading a model can take a moment…"
        : "Reading your local runtime information…";
  if (tool === "doctor") {
    $("connection-status").textContent = "Checking connection";
    $("connection-dot").className = "connection-dot";
  }
  let failure = null;
  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DeviceBench-Token": token,
      },
      body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || `Request failed (${response.status})`);
    if (tool === "doctor") {
      modelOptions(result.models || []);
      updateConnection(result);
    }
    reports.set(tool, {
      key: JSON.stringify(request),
      request,
      report: result,
    });
  } catch (error) {
    failure =
      error instanceof Error
        ? error.message
        : "The check could not be completed.";
    if (tool === "doctor") {
      modelOptions([]);
      $("connection-status").textContent = "Unavailable";
      $("connection-dot").className = "connection-dot unavailable";
      $("connection-summary").textContent =
        "Connection could not be checked. Run Doctor again.";
    }
  } finally {
    busy = false;
    renderActive();
    if (failure) {
      $("error").textContent = failure;
      $("error").hidden = false;
      $("status").textContent =
        "Check incomplete. Review the error and try again.";
    }
  }
}

function settingsChanged() {
  $("error").hidden = true;
  $("embedding-controls").hidden = !document.querySelector(
    'input[value="embeddings"]',
  ).checked;
  renderActive();
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filename(format, report = currentReport) {
  const name = report.tool.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `devicebench-${name}-${report.created_at.slice(0, 10)}.${format}`;
}

document
  .querySelectorAll(".tool-card")
  .forEach((element) =>
    element.addEventListener("click", () => selectTool(element.dataset.tool)),
  );
$("tool-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run();
});
$("refresh").addEventListener("click", () => run("doctor"));
$("protocol").addEventListener("change", () => {
  modelOptions([]);
  run("doctor");
});
for (const id of ["model", "context", "embedding-model"])
  $(id).addEventListener("input", settingsChanged);
document.querySelectorAll('input[name="check"]').forEach((input) =>
  input.addEventListener("change", () => {
    $("app-preset").value = "custom";
    settingsChanged();
  }),
);
$("app-preset").addEventListener("change", () => {
  const checks = presets[$("app-preset").value];
  if (checks)
    document.querySelectorAll('input[name="check"]').forEach((input) => {
      input.checked = checks.includes(input.value);
    });
  settingsChanged();
});
$("next-step").addEventListener("click", () => {
  selectTool($("next-step").dataset.tool);
  $("model").focus();
});
for (const id of ["help-open", "connection-help"])
  $(id).addEventListener("click", () => $("help-dialog").showModal());
$("help-close").addEventListener("click", () => $("help-dialog").close());
$("export-json").addEventListener("click", () => {
  if (currentReport && !busy)
    download(
      JSON.stringify(currentReport, null, 2),
      filename("json"),
      "application/json",
    );
});
$("export-html").addEventListener("click", async () => {
  if (!currentReport || busy) return;
  const report = currentReport;
  try {
    const response = await fetch(
      `/api/export?id=${encodeURIComponent(report.id)}`,
      { headers: { "X-DeviceBench-Token": token } },
    );
    if (!response.ok)
      throw new Error(
        "This report is no longer available for HTML export. Run the check again or download its JSON.",
      );
    const content = await response.text();
    if (currentReport === report && !busy)
      download(content, filename("html", report), "text/html");
  } catch (error) {
    if (currentReport !== report) return;
    $("error").textContent =
      error instanceof Error ? error.message : "Export failed.";
    $("error").hidden = false;
  }
});

async function initialize() {
  busy = true;
  updateControls();
  try {
    const response = await fetch("/api/config");
    if (!response.ok)
      throw new Error("Unable to load your workspace configuration.");
    const config = await response.json();
    $("endpoint").textContent = config.endpoint;
    $("help-endpoint").textContent = config.endpoint;
    $("deadline").textContent =
      `Each runtime request has a ${config.timeout}-second time limit. Some checks make several requests.`;
    $("protocol").value = config.protocol;
    busy = false;
    await run("doctor");
  } catch (error) {
    busy = false;
    renderActive();
    $("connection-status").textContent = "Unavailable";
    $("connection-dot").className = "connection-dot unavailable";
    $("connection-summary").textContent =
      "Restart DeviceBench and reload this page.";
    $("status").textContent =
      "Workspace unavailable. Restart devicebench serve.";
    $("error").textContent =
      error instanceof Error ? error.message : "Workspace unavailable.";
    $("error").hidden = false;
  }
}
initialize();
