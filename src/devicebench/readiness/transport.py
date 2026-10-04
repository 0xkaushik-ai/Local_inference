"""Bounded, proxy-free HTTP requests to numeric loopback addresses only."""

import http.client
import ipaddress
import json
import math
import socket
import threading
import time
from urllib.parse import urlsplit

MAX_RESPONSE = 8 * 1024 * 1024


class RuntimeFailure(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def validate_endpoint(value):
    try:
        url = urlsplit(value)
        host = url.hostname
        port = 80 if url.port is None else url.port
        if host == "localhost":
            host = "127.0.0.1"  # No DNS resolution or rebinding of localhost.
        valid = ipaddress.ip_address(host).is_loopback
    except (ValueError, TypeError):
        raise ValueError(
            "Endpoint must be an HTTP loopback URL, e.g. http://127.0.0.1:11434"
        ) from None
    if (
        not valid
        or url.scheme != "http"
        or url.username is not None
        or url.password is not None
        or url.path not in ("", "/")
        or url.query
        or url.fragment
        or not 1 <= port <= 65535
    ):
        raise ValueError(
            "Use an HTTP loopback endpoint without credentials, path, query, or fragment"
        )
    authority = f"[{host}]" if ":" in host else host
    return host, port, f"http://{authority}:{port}"


def decode_json(data):
    def reject_constant(value):
        raise ValueError(f"Invalid JSON number: {value}")

    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON object key")
            result[key] = value
        return result

    try:
        result = json.loads(data, parse_constant=reject_constant, object_pairs_hook=unique_keys)
    except (ValueError, UnicodeError, RecursionError):
        raise RuntimeFailure("Runtime returned malformed JSON") from None
    if not isinstance(result, dict):
        raise RuntimeFailure("Runtime response must be a JSON object")
    if result.get("error"):
        error = result["error"]
        if isinstance(error, dict):
            error = error.get("message", "Runtime rejected the request")
        raise RuntimeFailure(str(error)[:500])
    return result


class LocalClient:
    def __init__(self, endpoint="http://127.0.0.1:11434", timeout=30):
        self.host, self.port, self.endpoint = validate_endpoint(endpoint)
        if (
            isinstance(timeout, bool)
            or not isinstance(timeout, (int, float))
            or not math.isfinite(timeout)
            or not 0 < timeout <= 120
        ):
            raise ValueError("Timeout must be greater than zero and at most 120 seconds")
        self.timeout = timeout

    def request(self, path, payload=None):
        if not path.startswith("/") or "\r" in path or "\n" in path:
            raise ValueError("Invalid runtime path")
        deadline = time.monotonic() + self.timeout
        connection = http.client.HTTPConnection(self.host, self.port, timeout=self.timeout)
        response = None
        expired = threading.Event()

        def expire():
            expired.set()
            sock = connection.sock
            if sock is None and response is not None:
                sock = getattr(getattr(response.fp, "raw", None), "_sock", None)
            if sock is not None:
                try:
                    sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

        # A socket timeout alone does not bound a peer slowly dripping headers.
        watchdog = threading.Timer(self.timeout, expire)
        watchdog.daemon = True
        watchdog.start()
        try:
            body = None if payload is None else json.dumps(payload, allow_nan=False).encode()
            connection.request(
                "GET" if payload is None else "POST",
                path,
                body,
                {"Content-Type": "application/json", "Connection": "close"},
            )
            response = connection.getresponse()
            chunks = []
            size = 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeFailure("Runtime request exceeded its total deadline")
                # Connection: close may detach the socket from HTTPConnection.
                sock = connection.sock or getattr(getattr(response.fp, "raw", None), "_sock", None)
                if sock is not None:
                    sock.settimeout(remaining)
                chunk = response.read1(min(65536, MAX_RESPONSE + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_RESPONSE:
                    raise RuntimeFailure("Runtime response exceeded the 8 MiB limit")
                chunks.append(chunk)
            if expired.is_set():
                raise RuntimeFailure("Runtime request exceeded its total deadline")
            data = b"".join(chunks)
            if not 200 <= response.status < 300:
                # Do not follow redirects or include arbitrary server bodies in errors.
                message = f"Runtime returned HTTP {response.status}"
                if 400 <= response.status < 500:
                    try:
                        decode_json(data)
                    except RuntimeFailure as error:
                        message += f": {error}"
                raise RuntimeFailure(message, response.status)
            return data
        except (OSError, http.client.HTTPException) as error:
            if expired.is_set():
                raise RuntimeFailure("Runtime request exceeded its total deadline") from None
            raise RuntimeFailure(f"Local runtime unavailable: {type(error).__name__}") from None
        finally:
            watchdog.cancel()
            if response is not None:
                response.close()
            connection.close()

    def json(self, path, payload=None):
        return decode_json(self.request(path, payload))
