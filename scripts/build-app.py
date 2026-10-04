"""Build and verify a local Linux x86_64 preview; optionally stage a website download."""

import argparse
import hashlib
from importlib import metadata
import json
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage-website", action="store_true")
    args = parser.parse_args()
    if platform.system() != "Linux" or platform.machine() not in ("x86_64", "AMD64"):
        parser.error("This preview build supports Linux x86_64 only.")
    if platform.libc_ver()[0] != "glibc":
        parser.error("This preview build requires a glibc-based Linux host.")
    try:
        import PyInstaller  # noqa: F401
        import tkinter  # noqa: F401
    except ImportError:
        parser.error("Install requirements-app.lock and use a Python build with Tk support.")
    sys.path.insert(0, str(ROOT / "src"))
    from devicebench.readiness import VERSION

    work = ROOT / "build" / "app"
    work.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onedir",
            "--name",
            "DeviceBench",
            "--paths",
            str(ROOT / "src"),
            "--collect-data",
            "devicebench.readiness",
            "--distpath",
            str(ROOT / "dist" / "app"),
            "--workpath",
            str(work / "work"),
            "--specpath",
            str(work),
            str(ROOT / "scripts" / "app-entry.py"),
        ],
        cwd=ROOT,
        check=True,
    )
    bundle = ROOT / "dist" / "app" / "DeviceBench"
    glibc = platform.libc_ver()[1]
    (bundle / "READ-ME.txt").write_text(
        f"DeviceBench V1 preview ({VERSION})\n\n"
        "Extract this complete folder, then open the DeviceBench executable.\n"
        "Python and dashboard resources are included. No source build is needed.\n"
        "The launcher opens the browser; keep it open while using the workspace.\n"
        "Set your local AI server address/protocol in the launcher and use Restart.\n"
        "Use Open dashboard to reopen the browser, Stop to stop, or Quit to exit.\n"
        "Download temporary reports before stopping. AI servers/models are installed separately.\n\n"
        f"Build platform: Linux x86_64, glibc {glibc}. A graphical desktop/browser is required.\n"
        "Other Linux distributions and Windows/macOS have not been validated.\n"
        "This is a local evaluation artifact, not a signed or publicly released installer.\n"
        "Updates: quit, extract a new verified bundle, then replace this folder.\n"
        "Uninstall: quit and remove this folder. Keep any reports you downloaded.\n"
        "No automatic updates, startup service, model downloads, or system installation.\n\n"
        "Documentation is in docs/. Application distribution license remains pending.\n",
        encoding="utf-8",
    )
    shutil.copytree(ROOT / "docs", bundle / "docs", dirs_exist_ok=True)
    shutil.copy2(ROOT / "README.md", bundle / "README.md")
    shutil.copy2(ROOT / "Documents.md", bundle / "Documents.md")
    notices = bundle / "THIRD-PARTY"
    notices.mkdir(exist_ok=True)
    for package in (
        "pyinstaller",
        "altgraph",
        "pyinstaller-hooks-contrib",
        "setuptools",
        "packaging",
    ):
        distribution = metadata.distribution(package)
        for relative in distribution.files or ():
            if "license" in relative.name.lower() or "copying" in relative.name.lower():
                path = distribution.locate_file(relative)
                if path.is_file():
                    target = notices / package / str(relative).replace("/", "_")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, target)
    # Python exposes its license text even in distribution builds without LICENSE.txt.
    with (notices / "PYTHON-LICENSE.txt").open("w", encoding="utf-8") as license_file:
        subprocess.run(
            [
                sys.executable,
                "-c",
                "import builtins; builtins.license._Printer__setup(); print('\\n'.join(builtins.license._Printer__lines))",
            ],
            stdout=license_file,
            check=True,
        )
    # .tgz preserves the archive bytes on static hosts that treat .gz as HTTP encoding.
    filename = f"devicebench-{VERSION}-linux-x86_64.tgz"
    archive = ROOT / "dist" / filename
    with tarfile.open(archive, "w:gz") as output:
        output.add(bundle, arcname="DeviceBench")
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check-app.py"), str(archive)], check=True
    )
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_name(filename + ".sha256")
    checksum.write_text(f"{digest}  {filename}\n", encoding="utf-8")
    manifest = {
        "version": VERSION,
        "platform": "linux-x86_64",
        "status": "local-preview",
        "filename": filename,
        "bytes": archive.stat().st_size,
        "sha256": digest,
        "glibc": glibc,
    }
    manifest_path = ROOT / "dist" / "app-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if args.stage_website:
        target = ROOT / "site" / "public" / "downloads"
        target.mkdir(parents=True, exist_ok=True)
        for path in (archive, checksum):
            shutil.copy2(path, target / path.name)
        shutil.copy2(manifest_path, target / "manifest.json")
        print(f"Staged verified local preview: {target}")
    print(f"SHA256 {digest}  {filename}")


if __name__ == "__main__":
    main()
