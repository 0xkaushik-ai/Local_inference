"""Verify a built wheel installs offline and includes every dashboard asset."""

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import venv
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wheel", type=Path)
    args = parser.parse_args()
    wheel = args.wheel.resolve()
    with zipfile.ZipFile(wheel) as archive:
        names = set(archive.namelist())
        required = {
            f"devicebench/readiness/web/{name}"
            for name in ("index.html", "styles.css", "app.js", "favicon.svg")
        }
        if required - names:
            raise SystemExit(f"Wheel is missing dashboard assets: {sorted(required - names)}")
        if any(name.startswith((".cache/", "reports/", "site/node_modules/")) for name in names):
            raise SystemExit("Generated or private content found in the release wheel")
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONHOME", None)
    with tempfile.TemporaryDirectory(prefix="devicebench-release-") as temporary:
        root = Path(temporary)
        venv.create(root / "env", with_pip=True)
        binary = root / "env" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        subprocess.run(
            [str(binary), "-m", "pip", "install", "--no-index", "--no-deps", str(wheel)],
            cwd=root,
            env=environment,
            check=True,
        )
        subprocess.run(
            [str(binary), "-I", "-m", "devicebench", "--version"],
            cwd=root,
            env=environment,
            check=True,
        )
        code = "from importlib.resources import files; from devicebench.readiness import VERSION; from devicebench.readiness.report import report, render; from devicebench.readiness.transport import LocalClient; assert VERSION == '0.2.0'; assert files('devicebench.readiness').joinpath('web/index.html').is_file(); assert 'DeviceBench' in render(report('Release check', 'http://127.0.0.1', [])); assert LocalClient().host == '127.0.0.1'; print('Fresh installed wheel: CLI, resources, reports, transport OK')"
        subprocess.run([str(binary), "-I", "-c", code], cwd=root, env=environment, check=True)
    print(f"SHA256 {hashlib.sha256(wheel.read_bytes()).hexdigest()}  {wheel.name}")


if __name__ == "__main__":
    main()
