#!/usr/bin/env python3
"""Fetch hash-pinned sources and apply the opt-in experiment patch, without Git."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import urllib.request

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / "engine/source-lock.json").read_text())
source = root / lock["source_directory"]
if source.exists():
    raise SystemExit(f"Source directory already exists; leaving it untouched: {source}")
source.parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=source.parent) as tmp:
    archive = Path(tmp) / "source.tar.gz"
    urllib.request.urlretrieve(lock["archive_url"], archive)
    with archive.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if actual != lock["archive_sha256"]:
        raise SystemExit(f"Archive checksum mismatch: {actual}")
    with tarfile.open(archive) as bundle:
        bundle.extractall(tmp, filter="data")
    unpacked = Path(tmp) / source.name.removeprefix(".cache/")
    subprocess.run(["patch", "--batch", "-p1", "-i", str(root / lock["patch"])],
                   cwd=unpacked, check=True)
    unpacked.rename(source)
print(f"Prepared {source}")
