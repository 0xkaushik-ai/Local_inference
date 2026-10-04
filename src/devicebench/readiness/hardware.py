"""Optional hardware probes; missing vendor tools never stop diagnostics."""

import csv
import ctypes
import io
import os
from pathlib import Path
import platform
import shutil
import subprocess


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=5, check=False)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.SubprocessError, UnicodeError):
        return None


def collect():
    system = platform.system()
    memory = {"total_bytes": None, "available_bytes": None, "source": "unavailable"}
    cpu = platform.processor() or platform.machine()
    if system == "Linux":
        try:
            values = {}
            for line in Path("/proc/meminfo").read_text().splitlines():
                key, value = line.split(":", 1)
                values[key] = int(value.split()[0]) * 1024
            memory = {
                "total_bytes": values.get("MemTotal"),
                "available_bytes": values.get("MemAvailable"),
                "source": "/proc/meminfo",
            }
            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.startswith("model name"):
                    cpu = line.split(":", 1)[1].strip()
                    break
        except (OSError, ValueError, IndexError):
            pass
    elif system == "Darwin":
        total = command(["sysctl", "-n", "hw.memsize"])
        memory["total_bytes"] = int(total) if total and total.isdigit() else None
        memory["source"] = "sysctl; available memory not measured"
    elif system == "Windows":

        class MemoryStatus(ctypes.Structure):
            _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [
                (name, ctypes.c_ulonglong)
                for name in (
                    "total",
                    "available",
                    "page",
                    "available_page",
                    "virtual",
                    "available_virtual",
                    "extended",
                )
            ]

        try:
            status = MemoryStatus()
            status.length = ctypes.sizeof(status)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
                memory = {
                    "total_bytes": status.total,
                    "available_bytes": status.available,
                    "source": "GlobalMemoryStatusEx",
                }
        except (AttributeError, OSError):
            pass
    gpus = []
    probe = "NVIDIA probe unavailable; AMD/Intel/Metal memory is not measured"
    executable = shutil.which("nvidia-smi")
    if executable:
        output = command(
            [
                executable,
                "--query-gpu=name,memory.total,memory.free",
                "--format=csv,noheader,nounits",
            ]
        )
        if output:
            try:
                for name, total, free in csv.reader(io.StringIO(output)):
                    gpus.append(
                        {
                            "name": name.strip(),
                            "total_bytes": int(float(total)) * 1024**2,
                            "available_bytes": int(float(free)) * 1024**2,
                            "source": "nvidia-smi",
                        }
                    )
                probe = "NVIDIA memory measured; other accelerators not measured"
            except (ValueError, OverflowError):
                gpus = []
                probe = "NVIDIA probe returned unrecognized memory values"
    return {
        "system": system,
        "machine": platform.machine(),
        "cpu": cpu,
        "logical_cpus": os.cpu_count(),
        "python": platform.python_version(),
        "memory": memory,
        "gpus": gpus,
        "gpu_probe": probe,
    }
