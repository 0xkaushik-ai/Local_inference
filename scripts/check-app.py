"""Exercise the frozen Linux application outside the checkout, without Python on PATH."""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="Application directory or .tgz archive")
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    executable = bundle / "DeviceBench"
    if not executable.is_file() and not (
        bundle.is_file() and bundle.name.endswith((".tar.gz", ".tgz"))
    ):
        parser.error(f"Application directory or archive missing: {bundle}")
    environment = os.environ.copy()
    for key in ("PYTHONPATH", "PYTHONHOME", "LD_LIBRARY_PATH", "VIRTUAL_ENV"):
        environment.pop(key, None)
    with tempfile.TemporaryDirectory(prefix="devicebench-app-check-") as temporary:
        root = Path(temporary)
        relocated = root / "DeviceBench"
        if bundle.is_dir():
            shutil.copytree(bundle, relocated, symlinks=True)
        else:
            with tarfile.open(bundle) as archive:
                archive.extractall(root, filter="data")
        executable = relocated / "DeviceBench"
        empty_path = root / "empty-path"
        empty_path.mkdir()
        environment["PATH"] = str(empty_path)
        for command in ("--version", "--self-test"):
            result = subprocess.run(
                [str(executable), command],
                cwd=root,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode:
                raise SystemExit(result.stderr or result.stdout or "Application check failed")
            print(result.stdout.strip())
    print("Relocated application passed outside the checkout with no Python executable on PATH.")


if __name__ == "__main__":
    main()
