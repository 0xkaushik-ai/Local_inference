"""Verify desktop lifecycle and the unchanged local HTTP security boundary."""

import errno
import http.client
import json
import os
import re
import socket
import unittest
from unittest.mock import patch

from devicebench.launcher import (
    CheckInProgress,
    LauncherService,
    restore_system_library_path,
    self_test,
)
from devicebench.readiness.server import make_server
from devicebench.readiness.transport import LocalClient


class FrozenEnvironmentTests(unittest.TestCase):
    def test_frozen_linux_restores_original_library_path(self):
        for original in ("/usr/local/example-libs", ""):
            with (
                self.subTest(original=original),
                patch.dict(
                    os.environ,
                    {"LD_LIBRARY_PATH": "/bundle/_internal", "LD_LIBRARY_PATH_ORIG": original},
                    clear=True,
                ),
                patch("sys.frozen", True, create=True),
                patch("sys.platform", "linux"),
            ):
                restore_system_library_path()
                self.assertEqual(os.environ["LD_LIBRARY_PATH"], original)

    def test_frozen_linux_removes_library_path_when_no_original_existed(self):
        with (
            patch.dict(os.environ, {"LD_LIBRARY_PATH": "/bundle/_internal"}, clear=True),
            patch("sys.frozen", True, create=True),
            patch("sys.platform", "linux"),
        ):
            restore_system_library_path()
            self.assertNotIn("LD_LIBRARY_PATH", os.environ)
            restore_system_library_path()
            self.assertNotIn("LD_LIBRARY_PATH", os.environ)

    def test_source_execution_and_other_platforms_keep_their_environment(self):
        environment = {"LD_LIBRARY_PATH": "/current", "LD_LIBRARY_PATH_ORIG": "/original"}
        for frozen, platform in ((False, "linux"), (True, "darwin"), (True, "win32")):
            with (
                self.subTest(frozen=frozen, platform=platform),
                patch.dict(os.environ, environment, clear=True),
                patch("sys.frozen", frozen, create=True),
                patch("sys.platform", platform),
            ):
                restore_system_library_path()
                self.assertEqual(dict(os.environ), environment)


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.service = LauncherService()

    def tearDown(self):
        self.service.stop()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection(
            "127.0.0.1", self.service.server.server_address[1], timeout=3
        )
        try:
            connection.request(method, path, body, headers or {})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def test_desktop_configuration_and_resources_are_served(self):
        url = self.service.start("http://localhost:1234", "openai", 5, port=0)
        self.assertTrue(self.service.is_running)
        self.assertEqual(url, f"http://127.0.0.1:{self.service.server.server_address[1]}/")
        status, body = self.request("GET", "/api/config")
        self.assertEqual(status, 200)
        self.assertEqual(
            json.loads(body),
            {
                "endpoint": "http://127.0.0.1:1234",
                "protocol": "openai",
                "timeout": 5,
                "launch_mode": "desktop",
            },
        )
        for path in ("/", "/styles.css", "/app.js", "/favicon.svg"):
            status, body = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(body)

    def test_occupied_port_uses_another_port_without_disturbing_its_owner(self):
        with socket.socket() as occupied:
            occupied.bind(("127.0.0.1", 0))
            occupied.listen()
            port = occupied.getsockname()[1]
            self.service.start(port=port)
            self.assertNotEqual(port, self.service.server.server_address[1])
            self.assertEqual(occupied.getsockname()[1], port)

    def test_other_bind_failures_are_reported_without_fallback(self):
        with patch(
            "devicebench.launcher.make_server", side_effect=OSError(errno.EACCES, "Denied")
        ) as make:
            with self.assertRaises(OSError):
                self.service.start()
        self.assertEqual(make.call_count, 1)
        self.assertFalse(self.service.is_running)

    def test_invalid_settings_never_bind_a_server(self):
        with patch("devicebench.launcher.make_server") as make:
            for options in (
                {"endpoint": "http://example.com"},
                {"endpoint": "http://127.0.0.1:1234/v1"},
                {"protocol": "unsupported"},
                {"timeout": float("nan")},
                {"timeout": 121},
                {"port": -1},
            ):
                with self.assertRaises(ValueError):
                    self.service.start(**options)
        make.assert_not_called()

    def test_stop_clears_reports_releases_port_and_allows_restart(self):
        self.service.start(port=0)
        server = self.service.server
        thread = self.service.thread
        port = server.server_address[1]
        server.reports["private"] = {"model": "example"}
        self.service.stop()
        self.assertFalse(thread.is_alive())
        self.assertFalse(server.reports)
        self.assertFalse(self.service.is_running)
        self.assertEqual(self.service.url, "")
        self.service.start(port=port)
        self.assertEqual(self.service.server.server_address[1], port)

    def test_active_check_finishes_before_stop_and_new_checks_are_blocked(self):
        self.service.start(port=0)
        server = self.service.server
        server.check_lock.acquire()
        try:
            with self.assertRaises(CheckInProgress):
                self.service.stop()
            self.assertFalse(server.accept_checks)
            self.assertTrue(self.service.is_running)
        finally:
            server.check_lock.release()
        _, page = self.request("GET", "/")
        token = re.search(rb'name="devicebench-session" content="([^"]+)"', page)[1].decode()
        status, _ = self.request(
            "POST",
            "/api/run",
            json.dumps({"tool": "doctor"}),
            {"Content-Type": "application/json", "X-DeviceBench-Token": token},
        )
        self.assertEqual(status, 503)
        self.service.stop()
        self.assertFalse(self.service.is_running)

    def test_browser_failure_keeps_service_available_and_reports_the_url(self):
        self.service.start(port=0)
        for behavior in ({"return_value": False}, {"side_effect": OSError("No browser")}):
            with patch("devicebench.launcher.webbrowser.open", **behavior):
                with self.assertRaisesRegex(RuntimeError, self.service.url):
                    self.service.open_dashboard()
        self.assertTrue(self.service.is_running)
        with patch("devicebench.launcher.webbrowser.open", return_value=True) as opened:
            self.service.open_dashboard()
        opened.assert_called_once_with(self.service.url, new=2)

    def test_starting_twice_does_not_replace_a_running_server(self):
        self.service.start(port=0)
        original = self.service.server
        with self.assertRaises(RuntimeError):
            self.service.start(port=0)
        self.assertIs(self.service.server, original)

    def test_headless_self_test_does_not_call_a_runtime_or_open_a_browser(self):
        with patch.object(LocalClient, "request", side_effect=AssertionError("Runtime called")):
            with patch(
                "devicebench.launcher.webbrowser.open", side_effect=AssertionError("Browser opened")
            ):
                self_test()

    def test_cli_server_does_not_advertise_desktop_mode(self):
        with make_server(LocalClient(), port=0) as server:
            self.assertEqual(getattr(server, "launch_mode", "cli"), "cli")


if __name__ == "__main__":
    unittest.main()
