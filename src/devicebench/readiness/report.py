"""Inspectable readiness evidence and portable HTML exports."""

from datetime import datetime, timezone
import html
import json
from pathlib import Path
from uuid import uuid4

from . import VERSION


def finding(key, title, status, detail, action=None, evidence=None):
    return {
        "id": key,
        "title": title,
        "status": status,
        "detail": detail,
        "action": action,
        "evidence": evidence,
    }


def report(tool, endpoint, findings, **extra):
    return {
        "schema_version": 1,
        "id": str(uuid4()),
        "product": "DeviceBench readiness",
        "version": VERSION,
        "tool": tool,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "findings": findings,
        "scope": "Local observations and explicitly labeled estimates. No general model-quality or performance ranking.",
        **extra,
    }


def exit_code(result):
    statuses = {item["status"] for item in result["findings"]}
    if "unavailable" in statuses:
        return 2
    return 1 if statuses & {"fail", "unsupported"} else 0


_STATUS_LABELS = {
    "pass": "Passed",
    "fail": "Failed",
    "info": "Details",
    "warning": "Review",
    "unsupported": "Unsupported",
    "unavailable": "Unavailable",
}

_STYLE = """
:root{color-scheme:light;--canvas:#f6f5f1;--ink:#242521;--muted:#62655e;
--line:#d8dad0;--accent:#a43725;--positive:#3c6251}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);
font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:980px;margin:auto;padding:40px 32px 56px}
.brand{display:flex;align-items:center;gap:10px;padding-bottom:24px;
border-bottom:1px solid var(--line);font-size:19px;font-weight:650}
.brand-mark{color:var(--accent);font-family:monospace}
.edition{margin-left:auto;font-size:11px;font-weight:400;color:var(--muted);
letter-spacing:.06em;text-transform:uppercase}
header{padding-block:32px 24px}.eyebrow{font-size:11px;letter-spacing:.08em;
text-transform:uppercase;color:var(--accent);margin:0 0 12px}
h1{font-size:clamp(30px,5vw,46px);line-height:1.15;font-weight:500;
letter-spacing:-1.1px;margin:0 0 24px;overflow-wrap:anywhere}
.metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
gap:14px 28px;margin:0;padding-block:20px;border-block:1px solid var(--line)}
.metadata div{min-width:0}dt{font-size:11px;color:var(--muted);letter-spacing:.03em}
dd{margin:4px 0 0;font-size:14px;overflow-wrap:anywhere}
.scope{margin:20px 0 0;color:var(--muted);font-size:14px;max-width:75ch}
.section-heading{display:flex;align-items:baseline;justify-content:space-between;
gap:16px;margin:10px 0 16px}.section-heading h2{margin:0;font-size:23px;font-weight:500}
.section-heading span{color:var(--muted);font-size:12px}
article{background:white;border:1px solid var(--line);border-radius:4px;
padding:23px 25px;margin:12px 0;break-inside:avoid}
.finding-title{display:flex;align-items:start;justify-content:space-between;gap:16px}
h3{font-size:18px;line-height:1.4;font-weight:550;margin:0;overflow-wrap:anywhere}
p{overflow-wrap:anywhere}article p{font-size:14px;margin:12px 0 0}
.badge{font-size:11px;line-height:1.5;padding:4px 9px;border-radius:3px;
background:#edf0ea;color:#485149;white-space:nowrap}
.pass{background:#eaf1eb;color:var(--positive)}
.fail,.unavailable{background:#f7e9e5;color:#943322}
.warning,.unsupported{background:#f6eddc;color:#76501d}
.info,.unknown{background:#eef0ed;color:#51564e}
.action{border-left:2px solid var(--accent);padding-left:12px;color:#494c45}
.action strong{color:var(--ink);font-weight:550}
details{margin-top:18px}summary{cursor:pointer;font-size:13px;color:var(--accent);
width:fit-content;padding:4px 0}
summary:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
pre{background:var(--canvas);border:1px solid var(--line);padding:16px;
font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;
overflow-wrap:anywhere;max-height:480px;overflow:auto}
.full-evidence{margin-top:28px;padding-top:18px;border-top:1px solid var(--line)}
.full-evidence p{font-size:13px;color:var(--muted)}
footer{margin-top:30px;padding-top:20px;border-top:1px solid var(--line);
font-size:12px;color:var(--muted)}footer p{margin:5px 0}
@media(max-width:560px){main{padding:24px 18px 36px}.brand{font-size:17px}
.edition{font-size:10px}.metadata{grid-template-columns:1fr}header{padding-top:25px}
article{padding:19px 17px}.finding-title{flex-wrap:wrap;gap:10px}
h3{font-size:17px}.section-heading h2{font-size:21px}}
@media print{body{background:white;font-size:11pt}main{max-width:none;padding:0}
header{padding-block:20px}h1{font-size:26pt}article{padding:14px 16px}
pre{max-height:none;overflow:visible;font-size:9pt}.full-evidence{break-inside:auto}}
"""


def render(result):
    escape = lambda value: html.escape(str(value), quote=True)
    metadata = [("Created", result["created_at"]), ("Runtime address", result["endpoint"])]
    if result.get("protocol"):
        protocol = {"ollama": "Ollama", "openai": "OpenAI-compatible"}.get(
            result["protocol"], result["protocol"]
        )
        metadata.append(("Protocol", protocol))
    if result.get("model"):
        metadata.append(("Model", result["model"]))
    if result.get("context") is not None:
        context = result["context"]
        context = f"{context:,}" if isinstance(context, int) else str(context)
        metadata.append(("Requested context", f"{context} tokens"))
    metadata_html = "".join(
        f"<div><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>" for label, value in metadata
    )
    cards = []
    for item in result["findings"]:
        status = item["status"]
        status_class = status if status in _STATUS_LABELS else "unknown"
        status_label = _STATUS_LABELS.get(status, status)
        action = (
            f'<p class="action"><strong>Next step:</strong> {escape(item["action"])}</p>'
            if item.get("action")
            else ""
        )
        evidence = ""
        if item.get("evidence") is not None:
            record = escape(json.dumps(item["evidence"], indent=2, allow_nan=False))
            evidence = (
                "<details><summary>View recorded evidence</summary>"
                f'<pre tabindex="0" aria-label="Recorded finding evidence">{record}</pre></details>'
            )
        cards.append(
            '<article><div class="finding-title">'
            f"<h3>{escape(item['title'])}</h3>"
            f'<span class="badge {status_class}">{escape(status_label)}</span></div>'
            f"<p>{escape(item['detail'])}</p>{action}{evidence}</article>"
        )
    full_record = escape(json.dumps(result, indent=2, allow_nan=False))
    count = len(result["findings"])
    count_label = f"{count} finding" + ("s" if count != 1 else "")
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" '
        "content=\"default-src 'none'; style-src 'unsafe-inline'\">"
        f"<title>{escape(result['tool'])} — DeviceBench report</title>"
        f"<style>{_STYLE}</style></head><body><main>"
        '<div class="brand"><span class="brand-mark" aria-hidden="true">[▥]</span>'
        'devicebench<span class="edition">V1 preview</span></div>'
        '<header><p class="eyebrow">Local AI readiness report</p>'
        f'<h1>{escape(result["tool"])}</h1><dl class="metadata">{metadata_html}</dl>'
        f'<p class="scope">{escape(result["scope"])}</p></header>'
        '<section aria-labelledby="findings-title"><div class="section-heading">'
        f'<h2 id="findings-title">Findings</h2><span>{count_label}</span></div>'
        + "".join(cards)
        + '</section><details class="full-evidence"><summary>Full report and evidence</summary>'
        "<p>The complete record includes the original statuses, assumptions, and available "
        "request and response evidence.</p>"
        f'<pre tabindex="0" aria-label="Complete report JSON">{full_record}</pre></details>'
        "<footer><p>Review device details, model names, prompts, and responses before sharing.</p>"
        "<p>Open evidence sections before printing to include their records.</p>"
        f"<p>DeviceBench package {escape(result['version'])} · Report {escape(result['id'])}</p>"
        "</footer></main></body></html>"
    )


def export(result, directory):
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=False)
    (path / "report.json").write_text(
        json.dumps(result, indent=2, allow_nan=False), encoding="utf-8"
    )
    (path / "report.html").write_text(render(result), encoding="utf-8")
    return path
