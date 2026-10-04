"""Synthetic local HTTP runtime for protocol and browser tests, never real results."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import time

from devicebench.readiness.server import make_server
from devicebench.readiness.transport import LocalClient

INFO = {
    "general.architecture": "llama",
    "llama.context_length": 8192,
    "llama.block_count": 16,
    "llama.embedding_length": 1024,
    "llama.attention.head_count": 16,
    "llama.attention.head_count_kv": 4,
}


def make_runtime():
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, value, status=200, content_type="application/json"):
            content = value if isinstance(value, bytes) else json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            try:
                self.wfile.write(content)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if self.path == "/slow-headers":
                for byte in b"HTTP/1.0 200 OK\r\nContent-Length: 2\r\n\r\n{}":
                    try:
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        break
                    time.sleep(0.03)
            elif self.path == "/redirect":
                self.send_response(302)
                self.send_header("Location", "http://fixture.invalid/")
                self.send_header("Content-Length", "0")
                self.end_headers()
            elif self.path == "/oversized":
                self.reply(b"x" * (8 * 1024 * 1024 + 1))
            elif self.path == "/slow":
                self.send_response(200)
                self.send_header("Content-Length", "100")
                self.end_headers()
                for _ in range(100):
                    try:
                        self.wfile.write(b" ")
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        break
                    time.sleep(0.03)
            elif self.path == "/malformed":
                self.reply(b"not JSON")
            elif self.path == "/api/version":
                self.reply({"version": "synthetic-test-runtime"})
            elif self.path == "/api/tags":
                self.reply(
                    {
                        "models": [
                            {
                                "name": "fixture:latest",
                                "size": 1024**3,
                                "details": {
                                    "parameter_size": "Fixture",
                                    "quantization_level": "Q4_K_M",
                                },
                            },
                            {"name": "fixture-embed:latest", "size": 256 * 1024**2, "details": {}},
                        ]
                    }
                )
            elif self.path == "/v1/models":
                self.reply({"data": [{"id": "fixture:latest"}, {"id": "fixture-embed:latest"}]})
            elif self.path == "/api/ps":
                self.reply({"models": []})
            else:
                self.reply({"error": "fixture endpoint unavailable"}, 404)

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            self.server.requests.append((self.path, body))
            if self.path == "/api/show":
                self.reply(
                    {
                        "model_info": INFO,
                        "details": {"parameter_size": "Fixture", "quantization_level": "Q4_K_M"},
                        "capabilities": ["embedding"]
                        if body["model"] == "fixture-embed:latest"
                        else ["completion", "tools"],
                        "license": "Synthetic fixture; not a real model",
                    }
                )
            elif self.path in ("/api/embed", "/v1/embeddings"):
                self.reply(
                    {"embeddings": [[0.1, 0.2, 0.3]]}
                    if self.path == "/api/embed"
                    else {"data": [{"index": 0, "embedding": [0.1, 0.2, 0.3]}]}
                )
            elif self.path in ("/api/chat", "/v1/chat/completions"):
                native = self.path == "/api/chat"
                if body.get("stream"):
                    content = (
                        b'{"message":{"content":"READY"},"done":false}\n{"message":{"content":""},"done":true}\n'
                        if native
                        else b'data: {"choices":[{"delta":{"content":"READY"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
                    )
                    self.reply(
                        content,
                        content_type="application/x-ndjson" if native else "text/event-stream",
                    )
                else:
                    message = {"role": "assistant", "content": '{"ok":true}'}
                    if body.get("tools"):
                        message["tool_calls"] = [
                            {
                                "id": "fixture-call",
                                "type": "function",
                                "function": {
                                    "name": "get_weather",
                                    "arguments": {"city": "Paris"}
                                    if native
                                    else '{"city":"Paris"}',
                                },
                            }
                        ]
                    self.reply(
                        {"message": message, "done": True}
                        if native
                        else {
                            "choices": [
                                {
                                    "message": message,
                                    "finish_reason": "tool_calls" if body.get("tools") else "stop",
                                }
                            ]
                        }
                    )
            else:
                self.reply({"error": "unsupported fixture endpoint"}, 404)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    server.requests = []
    return server


def start_server(server):
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dashboard-port", type=int, default=18766)
    args = parser.parse_args()
    with make_runtime() as runtime:
        start_server(runtime)
        endpoint = f"http://127.0.0.1:{runtime.server_address[1]}"
        with make_server(LocalClient(endpoint), port=args.dashboard_port) as dashboard:
            print(
                f"Synthetic test dashboard: http://127.0.0.1:{dashboard.server_address[1]}",
                flush=True,
            )
            try:
                dashboard.serve_forever()
            except KeyboardInterrupt:
                pass
