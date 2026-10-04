"""CLI for the first DeviceBench readiness toolkit."""

import argparse
import json
import sys

from . import VERSION
from .checks import CHECKS, PROTOCOLS, compatibility, doctor, model_check
from .report import exit_code, export
from .transport import LocalClient


def main(argv=None):
    parser = argparse.ArgumentParser(description="DeviceBench local AI readiness toolkit")
    parser.add_argument("command", choices=("doctor", "inspect", "compat", "serve"))
    parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:11434",
        help="HTTP loopback runtime URL; no proxies or redirects",
    )
    parser.add_argument("--protocol", choices=PROTOCOLS, default="ollama")
    parser.add_argument(
        "--timeout",
        type=float,
        default=30,
        help="Total deadline per runtime request, at most 120 seconds",
    )
    parser.add_argument("--model", help="Exact model name from the runtime inventory")
    parser.add_argument("--embedding-model", help="Optional separate model for embedding checks")
    parser.add_argument("--context", type=int, default=4096)
    parser.add_argument("--checks", nargs="+", choices=CHECKS, default=["streaming", "json"])
    parser.add_argument(
        "--log",
        help="Doctor only: inspect the last 1 MiB of an explicitly supplied log; exclude raw lines",
    )
    parser.add_argument(
        "--out", help="Create a new directory containing report.json and report.html"
    )
    parser.add_argument("--port", type=int, default=8766, help="Local dashboard port")
    parser.add_argument("--version", action="version", version=VERSION)
    args = parser.parse_args(argv)
    if args.command in ("inspect", "compat") and not args.model:
        parser.error(f"{args.command} requires --model")
    if args.log and args.command != "doctor":
        parser.error("--log is only available for doctor")
    try:
        client = LocalClient(args.endpoint, args.timeout)
        if args.command == "serve":
            if not 1 <= args.port <= 65535:
                parser.error("Dashboard port must be between 1 and 65535")
            from .server import serve

            serve(client, args.protocol, args.port)
            return
        if args.command == "doctor":
            result = doctor(client, args.protocol, args.log)
        elif args.command == "inspect":
            result = model_check(client, args.model, args.context, args.protocol)
        else:
            result = compatibility(
                client, args.model, args.checks, args.protocol, args.embedding_model
            )
        print(json.dumps(result, indent=2, allow_nan=False))
        if args.out:
            directory = export(result, args.out)
            print(f"Report: {directory / 'report.html'}", file=sys.stderr)
        raise SystemExit(exit_code(result))
    except (OSError, ValueError) as error:
        parser.exit(2, f"devicebench: {error}\n")
    except KeyboardInterrupt:
        parser.exit(130, "devicebench: interrupted\n")
