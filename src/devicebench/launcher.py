"""Desktop launcher for the existing loopback readiness dashboard."""

import argparse
import errno
import http.client
from importlib.resources import files
import json
import os
import sys
import threading
import webbrowser

from .readiness import VERSION
from .readiness.checks import PROTOCOLS
from .readiness.server import make_server
from .readiness.transport import LocalClient


class CheckInProgress(RuntimeError):
    """A running check must finish before the local service can stop."""


def restore_system_library_path():
    """Let system helpers use system libraries after bundled Tk has initialized."""
    if not getattr(sys, "frozen", False) or not sys.platform.startswith("linux"):
        return
    original = os.environ.get("LD_LIBRARY_PATH_ORIG")
    if original is None:
        os.environ.pop("LD_LIBRARY_PATH", None)
    else:
        os.environ["LD_LIBRARY_PATH"] = original


class LauncherService:
    """Manage one dashboard without changing runtime or model state."""

    def __init__(self):
        self.server = None
        self.thread = None
        self.url = ""
        self.error = None

    @property
    def is_running(self):
        return self.thread is not None and self.thread.is_alive()

    @property
    def busy(self):
        return self.server is not None and self.server.check_lock.locked()

    def start(self, endpoint="http://127.0.0.1:11434", protocol="ollama", timeout=30, port=8766):
        if self.server is not None:
            raise RuntimeError("Stop the current dashboard before starting another.")
        if protocol not in PROTOCOLS:
            raise ValueError("Choose Ollama or OpenAI-compatible protocol.")
        client = LocalClient(endpoint, timeout)
        if isinstance(port, bool) or not isinstance(port, int) or not 0 <= port <= 65535:
            raise ValueError("Dashboard port must be between 0 and 65535.")
        try:
            server = make_server(client, protocol, port)
        except OSError as error:
            if error.errno != errno.EADDRINUSE or port == 0:
                raise
            server = make_server(client, protocol, 0)
        server.launch_mode = "desktop"
        self.server = server
        self.error = None
        self.url = f"http://127.0.0.1:{server.server_address[1]}/"

        def run():
            try:
                server.serve_forever(poll_interval=0.1)
            except Exception as error:
                self.error = str(error)

        self.thread = threading.Thread(target=run, name="devicebench-dashboard", daemon=True)
        try:
            self.thread.start()
        except Exception:
            server.server_close()
            self.server = None
            self.thread = None
            self.url = ""
            raise
        return self.url

    def open_dashboard(self):
        if not self.is_running:
            raise RuntimeError("Start the dashboard before opening it.")
        try:
            opened = webbrowser.open(self.url, new=2)
        except Exception as error:
            raise RuntimeError(f"Could not open your browser. Open {self.url} manually.") from error
        if not opened:
            raise RuntimeError(f"Could not open your browser. Open {self.url} manually.")

    def request_stop(self):
        """Reject new checks while an existing bounded request finishes."""
        if self.server is not None:
            self.server.accept_checks = False

    def stop(self):
        if self.server is None:
            return
        self.request_stop()
        if not self.server.check_lock.acquire(blocking=False):
            raise CheckInProgress("Waiting for the active check to finish.")
        server = self.server
        try:
            if self.is_running:
                server.shutdown()
            if self.thread is not None:
                self.thread.join(timeout=2)
                if self.thread.is_alive():
                    raise RuntimeError("The dashboard is still stopping. Please wait.")
            server.server_close()
            server.reports.clear()
            self.server = None
            self.thread = None
            self.url = ""
        finally:
            server.check_lock.release()


def self_test():
    """Check frozen resources and local serving without contacting an AI runtime."""
    for name in ("index.html", "styles.css", "app.js", "favicon.svg"):
        if not files("devicebench.readiness").joinpath("web", name).read_bytes():
            raise RuntimeError(f"Missing dashboard resource: {name}")
    service = LauncherService()
    service.start(port=0)
    try:
        connection = http.client.HTTPConnection(
            "127.0.0.1", service.server.server_address[1], timeout=5
        )
        connection.request("GET", "/")
        response = connection.getresponse()
        page = response.read()
        if response.status != 200 or b"__SESSION_TOKEN__" in page or b"DeviceBench" not in page:
            raise RuntimeError("Bundled dashboard failed its HTTP check.")
        connection.request("GET", "/api/config")
        response = connection.getresponse()
        config = json.loads(response.read())
        if response.status != 200 or config.get("launch_mode") != "desktop":
            raise RuntimeError("Desktop configuration failed its HTTP check.")
        connection.request("POST", "/api/run", "{}", {"Content-Type": "application/json"})
        response = connection.getresponse()
        response.read()
        if response.status != 403:
            raise RuntimeError("Dashboard session protection failed.")
        connection.close()
    finally:
        service.stop()
    print(f"DeviceBench {VERSION}: bundled resources, local HTTP, and session protection OK")


def run_gui():
    import tkinter as tk
    from tkinter import messagebox, ttk

    window = tk.Tk()
    # PyInstaller sets a bundle-specific loader path. Tk is loaded now; browsers
    # and optional hardware probes must inherit the user's original system path.
    restore_system_library_path()
    window.title("DeviceBench")
    window.geometry("600x520")
    window.minsize(600, 520)
    service = LauncherService()
    pending = None
    frame = ttk.Frame(window, padding=28)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="DeviceBench", font=("TkDefaultFont", 24, "bold")).pack(anchor="w")
    ttk.Label(frame, text=f"V1 preview · {VERSION} · Local AI readiness").pack(
        anchor="w", pady=(4, 22)
    )
    endpoint = tk.StringVar(value="http://127.0.0.1:11434")
    protocol = tk.StringVar(value="ollama")
    timeout = tk.StringVar(value="30")
    for label, variable in (
        ("AI server address", endpoint),
        ("Request timeout (seconds)", timeout),
    ):
        ttk.Label(frame, text=label).pack(anchor="w", pady=(8, 4))
        ttk.Entry(frame, textvariable=variable).pack(fill="x")
    ttk.Label(frame, text="API protocol").pack(anchor="w", pady=(8, 4))
    ttk.Combobox(frame, textvariable=protocol, values=PROTOCOLS, state="readonly").pack(fill="x")
    ttk.Label(frame, text="Changing settings takes effect when you start or restart.").pack(
        anchor="w", pady=(8, 14)
    )
    address = tk.StringVar(value="Dashboard stopped")
    ttk.Entry(frame, textvariable=address, state="readonly").pack(fill="x")
    status = tk.StringVar(value="Starting your local dashboard…")
    ttk.Label(frame, textvariable=status, wraplength=540).pack(anchor="w", pady=(10, 10))
    buttons = ttk.Frame(frame)
    buttons.pack(fill="x")
    ttk.Label(
        frame,
        text="Keep this window open while using the dashboard. Reports are temporary; download any you want to keep. Your AI server and models are installed separately.",
        wraplength=540,
    ).pack(anchor="w", pady=(18, 0))

    def show_error(error):
        status.set(str(error))
        messagebox.showerror("DeviceBench", str(error), parent=window)

    def open_dashboard():
        try:
            service.open_dashboard()
            status.set("Dashboard running. Your browser can be reopened here at any time.")
        except RuntimeError as error:
            show_error(error)

    def settings():
        try:
            seconds = float(timeout.get())
        except ValueError:
            raise ValueError(
                "Request timeout must be a positive number up to 120 seconds."
            ) from None
        client = LocalClient(endpoint.get().strip(), seconds)
        if protocol.get() not in PROTOCOLS:
            raise ValueError("Choose a supported API protocol.")
        return client.endpoint, protocol.get(), client.timeout

    def start():
        try:
            selected = settings()
        except ValueError as error:
            show_error(error)
            return
        if service.server is not None:
            request_action("restart", selected)
            return
        launch(selected)

    def launch(selected):
        try:
            address.set(service.start(*selected))
            start_button.configure(text="Restart")
            open_button.state(["!disabled"])
            stop_button.state(["!disabled"])
            open_dashboard()
        except (OSError, ValueError, RuntimeError) as error:
            show_error(error)

    def request_action(action, selected=None):
        nonlocal pending
        if pending is not None:
            return
        if service.busy and not messagebox.askyesno(
            "A check is running",
            "Wait for the active check to finish, then "
            + action
            + "?\n\nNew checks will be blocked. Downloaded reports are safe; temporary reports will be cleared.",
            parent=window,
        ):
            return
        pending = (action, selected)
        service.request_stop()
        for button in (start_button, open_button, stop_button, quit_button):
            button.state(["disabled"])
        finish_action()

    def finish_action():
        nonlocal pending
        try:
            service.stop()
        except CheckInProgress:
            status.set(
                "Waiting for the active check to finish before stopping. New checks are blocked."
            )
            window.after(200, finish_action)
            return
        except RuntimeError as error:
            pending = None
            quit_button.state(["!disabled"])
            show_error(error)
            return
        action, selected = pending
        pending = None
        if action == "quit":
            window.destroy()
            return
        address.set("Dashboard stopped")
        status.set("Stopped. Start again to open a new dashboard session.")
        start_button.configure(text="Start")
        start_button.state(["!disabled"])
        quit_button.state(["!disabled"])
        if action == "restart":
            launch(selected)

    start_button = ttk.Button(buttons, text="Start", command=start)
    start_button.pack(side="left")
    open_button = ttk.Button(
        buttons, text="Open dashboard", command=open_dashboard, state="disabled"
    )
    open_button.pack(side="left", padx=8)
    stop_button = ttk.Button(
        buttons, text="Stop", command=lambda: request_action("stop"), state="disabled"
    )
    stop_button.pack(side="left")
    quit_button = ttk.Button(buttons, text="Quit", command=lambda: request_action("quit"))
    quit_button.pack(side="right")
    window.protocol("WM_DELETE_WINDOW", lambda: request_action("quit"))

    def watch():
        if service.server is not None and not service.is_running and pending is None:
            status.set(
                f"Dashboard stopped unexpectedly: {service.error or 'server exited'}. Restart to try again."
            )
            open_button.state(["disabled"])
        window.after(1000, watch)

    window.after(50, start)
    window.after(1000, watch)
    window.mainloop()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Open the DeviceBench local desktop companion.")
    parser.add_argument("--version", action="version", version=VERSION)
    parser.add_argument(
        "--self-test", action="store_true", help="Verify the bundle without a display or AI runtime"
    )
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    try:
        run_gui()
    except Exception as error:
        print(f"DeviceBench could not open its launcher: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
