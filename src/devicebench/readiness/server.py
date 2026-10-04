"""Loopback-only dashboard with same-origin, session, and request limits."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
import json
import secrets
import threading
from urllib.parse import parse_qs, urlsplit

from .checks import CHECKS, PROTOCOLS, compatibility, doctor, model_check
from .report import render

MAX_BODY = 8192


def validate_request(data):
    if not isinstance(data, dict) or set(data) - {
        "tool",
        "model",
        "context",
        "checks",
        "protocol",
        "embedding_model",
    }:
        raise ValueError("Invalid request fields")
    tool = data.get("tool")
    if tool not in ("doctor", "inspect", "compat"):
        raise ValueError("Unknown tool")
    if data.get("protocol", "ollama") not in PROTOCOLS:
        raise ValueError("Unknown API protocol")
    if tool != "doctor":
        from .checks import validate_model

        validate_model(data.get("model"))
    if tool == "inspect":
        context = data.get("context", 4096)
        if isinstance(context, bool) or not isinstance(context, int) or not 1 <= context <= 1048576:
            raise ValueError("Context must be between 1 and 1048576 tokens")
    if tool == "compat":
        checks = data.get("checks", ["streaming", "json"])
        if (
            not isinstance(checks, list)
            or not checks
            or len(checks) > 4
            or any(not isinstance(check, str) or check not in CHECKS for check in checks)
        ):
            raise ValueError("Choose one or more supported checks")
        if data.get("embedding_model"):
            validate_model(data["embedding_model"])
    return data


def make_server(client, protocol="ollama", port=8766):
    token = secrets.token_urlsafe(32)
    lock = threading.Lock()
    report_lock = threading.Lock()
    assets = files("devicebench.readiness").joinpath("web")

    class Handler(BaseHTTPRequestHandler):
        server_version = "DeviceBench"
        sys_version = ""

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_args):
            pass  # No model names, credentials, or request bodies in access logs.

        def allowed(self, require_token=False):
            port_number = self.server.server_address[1]
            allowed_hosts = {f"127.0.0.1:{port_number}", f"localhost:{port_number}"}
            host = self.headers.get("Host", "")
            if host not in allowed_hosts:
                return False
            origin = self.headers.get("Origin")
            if origin is not None and origin != f"http://{host}":
                return False
            if self.headers.get("Sec-Fetch-Site") in ("cross-site", "same-site"):
                return False
            if require_token and not secrets.compare_digest(
                self.headers.get("X-DeviceBench-Token", "").encode("utf-8"), token.encode("ascii")
            ):
                return False
            return True

        def send(
            self, status, body, content_type="application/json; charset=utf-8", attachment=None
        ):
            if not isinstance(body, bytes):
                body = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
            )
            if attachment:
                self.send_header("Content-Disposition", f'attachment; filename="{attachment}"')
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def json(self, status, data):
            self.send(status, json.dumps(data, allow_nan=False))

        def do_GET(self):
            if not self.allowed():
                return self.json(403, {"error": "Open the dashboard through its local address."})
            if self.path == "/api/config":
                return self.json(
                    200,
                    {
                        "endpoint": client.endpoint,
                        "protocol": protocol,
                        "timeout": client.timeout,
                        "launch_mode": getattr(self.server, "launch_mode", "cli"),
                    },
                )
            if urlsplit(self.path).path == "/api/export":
                if not self.allowed(require_token=True):
                    return self.json(403, {"error": "Session token required"})
                with report_lock:
                    key = parse_qs(urlsplit(self.path).query).get("id", [""])[0]
                    result = self.server.reports.get(key)
                if result is None:
                    return self.json(404, {"error": "Run a tool before exporting"})
                return self.send(
                    200, render(result), "text/html; charset=utf-8", "devicebench-report.html"
                )
            resources = {
                "/": ("index.html", "text/html"),
                "/app.js": ("app.js", "text/javascript"),
                "/styles.css": ("styles.css", "text/css"),
                "/favicon.svg": ("favicon.svg", "image/svg+xml"),
            }
            if self.path not in resources:
                return self.json(404, {"error": "Not found"})
            filename, content_type = resources[self.path]
            content = assets.joinpath(filename).read_text(encoding="utf-8")
            if filename == "index.html":
                content = content.replace("__SESSION_TOKEN__", token)
            self.send(200, content, f"{content_type}; charset=utf-8")

        def do_POST(self):
            if not self.allowed(require_token=True):
                return self.json(403, {"error": "A same-origin dashboard session is required."})
            if self.path != "/api/run":
                return self.json(404, {"error": "Not found"})
            if self.headers.get("Content-Type", "").split(";", 1)[
                0
            ] != "application/json" or self.headers.get("Transfer-Encoding"):
                return self.json(415, {"error": "Use a fixed-length JSON request"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    return self.json(413, {"error": "Request must be between 1 and 8192 bytes"})
                payload = self.rfile.read(length)
                if len(payload) != length:
                    raise ValueError("Incomplete request")
                data = validate_request(json.loads(payload))
            except (ValueError, UnicodeError, RecursionError):
                return self.json(
                    400,
                    {
                        "error": "Invalid tool request; check the model, context, and selected features."
                    },
                )
            except OSError:
                return self.json(408, {"error": "Request body timed out or was interrupted."})
            if not lock.acquire(blocking=False):
                return self.json(409, {"error": "Another check is running. Wait for it to finish."})
            try:
                if not self.server.accept_checks:
                    return self.json(
                        503, {"error": "DeviceBench is stopping. Wait for the launcher."}
                    )
                selected_protocol = data.get("protocol", protocol)
                if data["tool"] == "doctor":
                    result = doctor(client, selected_protocol)
                elif data["tool"] == "inspect":
                    result = model_check(
                        client, data["model"], data.get("context", 4096), selected_protocol
                    )
                else:
                    result = compatibility(
                        client,
                        data["model"],
                        data.get("checks", ["streaming", "json"]),
                        selected_protocol,
                        data.get("embedding_model"),
                    )
                with report_lock:
                    self.server.reports[result["id"]] = result
                    if len(self.server.reports) > 16:
                        del self.server.reports[next(iter(self.server.reports))]
                self.json(200, result)
            except (ValueError, OSError) as error:
                self.json(400, {"error": str(error)[:500]})
            finally:
                lock.release()

    # Binding is intentionally fixed. There is no public-host option.
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.reports = {}
    server.check_lock = lock
    server.accept_checks = True
    return server


def serve(client, protocol, port):
    with make_server(client, protocol, port) as server:
        print(f"DeviceBench toolkit: http://127.0.0.1:{server.server_address[1]}/", flush=True)
        print(f"Runtime: {client.endpoint} ({protocol}). Stop with Ctrl+C.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
