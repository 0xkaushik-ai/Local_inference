# RunAnywhere adapter

Validated on Linux x64 with desktop kit 0.20.38, CMake 4.3 and GCC 15.2.
Requires CMake 3.24+, a C++20 compiler, OpenMP, curl development headers/library,
and Python 3.11+. Other platforms have not been tested.

## Download and build

Download the SDK and optional smoke model using URLs in `native/sdk-lock.json`.
Verify their SHA-256 values against that file before extraction or use. Keep downloaded
artifacts under ignored `.cache/runanywhere/`; no SDK binaries or models are redistributed.

```sh
mkdir -p .cache/runanywhere/sdk
# Save the verified SDK as .cache/runanywhere/sdk.tar.gz, then:
tar -xzf .cache/runanywhere/sdk.tar.gz -C .cache/runanywhere/sdk
cmake -S native -B build/runanywhere \
  -DCMAKE_PREFIX_PATH="$PWD/.cache/runanywhere/sdk/cpp-desktop-linux-x64" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build/runanywhere -j 2
build/runanywhere/devicebench-runanywhere --version
```

If curl headers are unavailable, install your distribution's curl development package.
This workspace instead extracted `libcurl4-openssl-dev_8.21.0-2_amd64.deb` using
`dpkg-deb -x` into `.cache/runanywhere/curl-dev`, without changing system packages.
Its CMake invocation additionally set:

```sh
-DCURL_INCLUDE_DIR="$PWD/.cache/runanywhere/curl-dev/usr/include/x86_64-linux-gnu" \
-DCURL_LIBRARY=/usr/lib/x86_64-linux-gnu/libcurl.so.4
```

The Linux CMake target groups the kit's static archives to resolve circular linker
references and links OpenMP explicitly. This is a consumer-side build adjustment.

Save the verified smoke model as `.cache/runanywhere/smollm2-135m-q4_k_m.gguf`.
Run the commands in the README; exit code 1 means task mismatch, not runtime failure.

## Measurement boundary

The bridge calls the SDK's public llama.cpp C backend directly. It does not exercise
Python bindings, browser/mobile SDKs, cloud routing, or Console. Configuration uses
CPU only, four threads by default, context size 2048, temperature zero, and backend
default prompt formatting. Each request reloads the model in a fresh process.
No HTTP transport or telemetry bootstrap is registered; offline operation has not been
independently verified through network monitoring.

First content and generation time exclude model loading. Wall time includes subprocess
startup, loading, generation, and teardown. Streaming token counts come from the SDK;
no separate decode duration is available. Do not compare this throughput directly with
Ollama's decode-only metric. Timeout applies to the whole subprocess.

## Observed smoke result

Two warm-ups and four measured calls completed with SmolLM2 135M Q4_K_M.
All measured calls completed; none met the exact-format checks. Arithmetic returned
`17 + 25 = 42.` instead of `42`; extraction repeated the sentence instead of `ZX-204`.
Median first content was 114.2 ms and model load 186.1 ms on this host. These tiny,
uncontrolled samples validate the pipeline, not general model quality or competitiveness.
