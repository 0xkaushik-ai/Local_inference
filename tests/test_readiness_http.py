"""Exercise actual loopback transport and the dashboard's security boundary."""

import http.client
import json
import re
import threading
import time
import unittest
from unittest.mock import patch

from devicebench.readiness.checks import compatibility, doctor, model_check
from devicebench.readiness.server import make_server
from devicebench.readiness.transport import LocalClient, RuntimeFailure
from readiness_fixture import make_runtime, start_server


class HttpReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime = make_runtime()
        cls.thread = start_server(cls.runtime)
        cls.client = LocalClient(f"http://127.0.0.1:{cls.runtime.server_address[1]}", timeout=2)
        cls.dashboard = make_server(cls.client, port=0)
        cls.dashboard_thread = start_server(cls.dashboard)
        cls.port = cls.dashboard.server_address[1]
        _, _, page = cls.request("GET", "/")
        cls.token = re.search(r'name="devicebench-session" content="([^"]+)"', page.decode())[1]

    @classmethod
    def tearDownClass(cls):
        for server in (cls.dashboard, cls.runtime):
            server.shutdown()
            server.server_close()
        cls.thread.join()
        cls.dashboard_thread.join()

    @classmethod
    def request(cls, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", cls.port, timeout=5)
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        status, received_headers, data = (
            response.status,
            dict(response.getheaders()),
            response.read(),
        )
        connection.close()
        return status, received_headers, data

    def auth(self):
        return {
            "Content-Type": "application/json",
            "Origin": f"http://127.0.0.1:{self.port}",
            "X-DeviceBench-Token": self.token,
        }

    def test_native_tools_work_over_actual_http(self):
        self.assertEqual(doctor(self.client)["findings"][0]["status"], "pass")
        self.assertEqual(model_check(self.client, "fixture:latest")["model"], "fixture:latest")
        result = compatibility(
            self.client,
            "fixture:latest",
            ("streaming", "json", "tools", "embeddings"),
            embedding_model="fixture-embed:latest",
        )
        self.assertTrue(all(item["status"] == "pass" for item in result["findings"]))

    def test_openai_protocol_works_without_ollama_metadata(self):
        result = compatibility(
            self.client,
            "fixture:latest",
            ("streaming", "json", "tools", "embeddings"),
            protocol="openai",
        )
        self.assertTrue(all(item["status"] == "pass" for item in result["findings"]))
        result = model_check(self.client, "fixture:latest", protocol="openai")
        self.assertEqual(
            next(item for item in result["findings"] if item["id"] == "estimate")["status"],
            "warning",
        )

    def test_transport_rejects_redirects_without_following_them(self):
        with self.assertRaises(RuntimeFailure) as caught:
            self.client.json("/redirect")
        self.assertEqual(caught.exception.status, 302)

    def test_total_deadline_stops_slow_drip_response(self):
        client = LocalClient(self.client.endpoint, timeout=0.15)
        start = time.monotonic()
        with self.assertRaises(RuntimeFailure):
            client.request("/slow")
        self.assertLess(time.monotonic() - start, 1)

    def test_response_size_limit_and_malformed_json(self):
        for path in ("/oversized", "/malformed"):
            with self.assertRaises(RuntimeFailure):
                self.client.json(path)

    def test_total_deadline_also_bounds_slow_response_headers(self):
        client = LocalClient(self.client.endpoint, timeout=0.15)
        start = time.monotonic()
        with self.assertRaises(RuntimeFailure):
            client.request("/slow-headers")
        self.assertLess(time.monotonic() - start, 1)

    def test_dashboard_headers_and_asset_allowlist(self):
        status, headers, _ = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertEqual(self.request("GET", "/../../pyproject.toml")[0], 404)
        self.assertEqual(self.request("GET", "/app.js")[0], 200)

    def test_host_rebinding_cross_origin_and_missing_session_are_rejected(self):
        body = json.dumps({"tool": "doctor"})
        for headers in (
            {"Host": "attacker.invalid"},
            {**self.auth(), "Origin": "https://attacker.invalid"},
            {**self.auth(), "X-DeviceBench-Token": ""},
            {**self.auth(), "Sec-Fetch-Site": "cross-site"},
            {**self.auth(), "X-DeviceBench-Token": "é"},
        ):
            self.assertEqual(self.request("POST", "/api/run", body, headers)[0], 403)

    def test_oversized_body_and_bad_options_are_rejected(self):
        self.assertEqual(self.request("POST", "/api/run", "x" * 8193, self.auth())[0], 413)
        self.assertEqual(
            self.request(
                "POST",
                "/api/run",
                json.dumps({"tool": "doctor", "endpoint": "http://remote.invalid"}),
                self.auth(),
            )[0],
            400,
        )

    def test_same_origin_tool_run_and_report_export(self):
        status, _, data = self.request(
            "POST", "/api/run", json.dumps({"tool": "doctor"}), self.auth()
        )
        self.assertEqual(status, 200)
        result = json.loads(data)
        status, headers, content = self.request(
            "GET", f"/api/export?id={result['id']}", headers=self.auth()
        )
        self.assertEqual(status, 200)
        self.assertIn("attachment", headers["Content-Disposition"])
        self.assertIn(b"Local AI Doctor", content)
        self.assertEqual(self.request("GET", "/api/export?id=unknown", headers=self.auth())[0], 404)
        self.assertEqual(self.request("GET", f"/api/export?id={result['id']}")[0], 403)

    def test_parallel_tool_requests_return_busy_instead_of_loading_twice(self):
        entered = threading.Event()
        release = threading.Event()

        def blocked(*_args):
            entered.set()
            release.wait(2)
            return {"id": "fixture", "findings": []}

        with patch("devicebench.readiness.server.doctor", side_effect=blocked):
            thread = threading.Thread(
                target=self.request,
                args=("POST", "/api/run", json.dumps({"tool": "doctor"}), self.auth()),
            )
            thread.start()
            self.assertTrue(entered.wait(1))
            try:
                self.assertEqual(
                    self.request("POST", "/api/run", json.dumps({"tool": "doctor"}), self.auth())[
                        0
                    ],
                    409,
                )
            finally:
                release.set()
                thread.join()


if __name__ == "__main__":
    unittest.main()
