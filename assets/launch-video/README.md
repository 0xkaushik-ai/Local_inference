# DeviceBench V1 launch film

An original 48-second product film introducing the three DeviceBench V1 readiness tools. The direction uses the reference's clean typography, focused product reveals, light background, and musical pacing, with DeviceBench's existing visual identity and verified product scope.

## Deliverables

- `devicebench-v1-4k.mp4`: native 3840 × 2160, 60 fps, 16:9 delivery master.
- `devicebench-v1-1080p.mp4`: 1920 × 1080, 30 fps sharing copy.
- `devicebench-v1-poster-4k.png`: native UHD poster.
- `watch.html`: local player, download links, optional English text track, and transcript.
- `index.html` and `scene.js`: editable, deterministic motion-design source.
- `captions.vtt`: an optional summary of the on-screen story; there is no spoken narration.
- `delivery-manifest.json`: measured export specifications, checksums, audio levels, and playback verification.
- `fonts/`: self-hosted IBM Plex Sans and IBM Plex Mono, with their license files.

The MP4 exports use H.264 High, YUV 4:2:0, limited-range Rec.709, square pixels, AAC stereo at 48 kHz, and fast-start metadata. These are explicit delivery choices, not a claim of certification against a universal industry standard. The master is SDR, not HDR. It is rendered directly at UHD resolution, not upscaled from a 1080p recording.

The original stereo soundtrack is synthesized from scratch at 100 BPM. The source WAV is 24-bit, 48 kHz and normalized to approximately −16 LUFS integrated. No reference footage, reference music, third-party samples, or stock recordings are included.

## Watch locally

From the repository root:

```sh
node site/node_modules/vite/bin/vite.js assets/launch-video --host 127.0.0.1 --port 8768 --strictPort
```

Run `npm ci --prefix site` first if the website dependencies are not installed. Open <http://127.0.0.1:8768/watch.html>. The player defaults to the smaller sharing copy. The 4K download retains the full native resolution. This server supports HTTP byte-range requests so the video can seek before the entire file is downloaded. All film assets are served locally; the GitHub link opens the public product repository.

For a silent, editable timeline preview, open <http://127.0.0.1:8768/index.html?play>. The deterministic export, rather than real-time browser playback, is the frame-accurate final artifact.

## Rebuild

Validated here with Node.js 26.5.1, Python 3.13.12, NumPy 2.3.5, FFmpeg 8.1.1 with libx264, and Google Chrome 151.0.7922.108. Python 3.11+ is required for the optional soundtrack environment. The Playwright and font dependencies are already pinned by `site/package-lock.json`; NumPy is pinned by `requirements-video.lock`. Chrome and FFmpeg are system prerequisites.

```sh
npm ci --prefix site
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-video.lock
.venv/bin/python scripts/make-launch-score.py
node scripts/render-launch-video.mjs
```

The renderer defaults to installed Google Chrome. To use the project's Playwright Chromium instead:

```sh
cd site
npx playwright install chromium
cd ..
node scripts/render-launch-video.mjs --browser chromium
```

Each frame is drawn as vectors and text into a native-resolution canvas, transferred as lossless PNG, then encoded by FFmpeg. Fonts finish loading before capture. The canvas backing store is reset before each exported frame and accelerated Canvas is disabled to keep captures independent of previous timestamps. Repeated frame captures were checked against fresh captures, and the actual brand/footer pixels were checked across all nine storyboard images. Ordered parallel workers produce exact frame timestamps; no wall-clock recording or screen capture is used.

Useful commands:

```sh
# Two-second silent UHD timing sample
node scripts/render-launch-video.mjs --benchmark

# Full lower-resolution editorial preview with the original score
node scripts/render-launch-video.mjs --preview

# Native-resolution storyboard frames
node scripts/render-launch-video.mjs --stills 2.8,7.6,13.5,20.8,28.5,34.3,38.5,42.8,46.8

# See export overrides
node scripts/render-launch-video.mjs --help

# Syntax and formatting checks for the editable scene
node --check assets/launch-video/scene.js
node --check scripts/render-launch-video.mjs
node site/node_modules/prettier/bin/prettier.cjs --check assets/launch-video/scene.js assets/launch-video/index.html assets/launch-video/watch.html
```

Create the sharing copy from the completed master. This preserves the original AAC audio without a second lossy audio encode, while using a lower video resolution, frame rate, and H.264 level:

```sh
ffmpeg -hide_banner -y \
  -i assets/launch-video/devicebench-v1-4k.mp4 \
  -map 0:v:0 -map 0:a:0 \
  -vf 'scale=1920:1080:flags=lanczos,fps=30,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709' \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p -maxrate 12M -bufsize 24M -threads 8 \
  -c:a copy -movflags +faststart \
  assets/launch-video/devicebench-v1-1080p.mp4

node scripts/render-launch-video.mjs --stills 7.6
cp reports/launch-video/stills/frame-7-600.png assets/launch-video/devicebench-v1-poster-4k.png
```

The original WAV and intermediate previews are generated under the ignored `reports/launch-video/` directory. Final deliverables are retained here so they can be reviewed and shared. A neighboring `.render.json` records the master export parameters. Binary deliverables can also be distributed as release attachments when publishing the source.

## Completed verification

Both MP4 files passed full audio/video decoding with no errors, exact 48-second duration, expected frame counts (2,880 and 1,440), codec and color metadata checks, and MP4 fast-start inspection. The final AAC soundtrack measures −16.01 LUFS integrated, −1.67 dBTP, and 3.3 LU loudness range in both exports. The 4K master is 13,756,301 bytes; the sharing copy is 5,351,615 bytes.

Both files were played and seeked in Google Chrome on Linux. The local player reached the end correctly, loaded all nine caption cues, and had no JavaScript errors. Its layout was checked at 1440 × 1100 and 390 × 844 viewports with no horizontal overflow. HTTP byte-range playback returned `206 Partial Content`. This is local browser verification, not a claim of testing every device or a social platform's transcoding pipeline.

The portable results and SHA-256 checksums are in [`delivery-manifest.json`](./delivery-manifest.json). Detailed local evidence is in `reports/launch-video/export-qa.json` and `reports/launch-video/playback-qa.json`. Nine native-resolution storyboard frames, an encoded-frame spot check, and desktop/mobile player captures are retained under `reports/launch-video/`.

## Story and timing

| Time        | Sequence                        | Purpose                                             |
| ----------- | ------------------------------- | --------------------------------------------------- |
| 0–4.8 s     | Local AI. Ready for your app?   | Establish the setup, model, and feature questions.  |
| 4.8–9.6 s   | Meet DeviceBench                | Introduce the brand and three-tool workflow.        |
| 9.6–16.8 s  | Local AI Doctor                 | Show runtime, model, and hardware discovery.        |
| 16.8–24 s   | Model & Context Checker         | Explain context inspection and memory estimates.    |
| 24–31.2 s   | App Compatibility Tester        | Show a recorded example of selected feature checks. |
| 31.2–36 s   | App presets                     | Connect checks to familiar application needs.       |
| 36–40.8 s   | HTML and JSON exports           | Show portable results and evidence.                 |
| 40.8–44.4 s | Your machine. Clear next steps. | Recap the workflow.                                 |
| 44.4–48 s   | Explore the V1 preview          | Direct viewers to the real project repository.      |

## Product claims and visual treatment

The UI cards are purpose-built motion-graphic simplifications of the product, not a live screen recording. Their findings are based on the existing local verification reports. The film labels recorded examples and retains the estimate/support limitations next to the relevant claims.

- Runtime and example: Linux, Ollama native API, the imported Qwen3 0.6B Q4_K_M model (`devicebench-readiness:qwen3`).
- Requested context: 4,096 tokens. The declared model limit in the recorded metadata is 40,960 tokens; the animated slider ends at 10% of that limit.
- Estimated memory: 1.31 GiB, including weights, context cache, and a runtime allowance. This is an estimate, not a measurement or assurance of successful loading.
- Streaming and structured JSON passed in the recorded native API example. The film says “selected checks passed”; it does not claim that all features passed or that a whole application was validated.
- Tool calling and embeddings are available checks. This particular imported model did not support them through the tested runtime; they are never shown as passing results for it.
- Presets select API checks for chatbot, data extraction, tool assistant, and semantic search workflows. They do not certify an entire application.
- JSON is explicitly labeled as an excerpt and uses actual report field names. The illustrated HTML card condenses the real export's findings.
- The final card says V1 preview and links to the actual GitHub project. It makes no speed, platform-certification, model-accuracy, or production-readiness claim.

Local source evidence inspected for the film:

- `reports/readiness-live/model/report.json`
- `reports/readiness-live/native/report.json`
- `reports/v1-customer-review/live-json-probe.json`
- Product UI and preset definitions under `src/devicebench/readiness/`
- Existing brand palette and typography under `site/src/`

These reports are local generated evidence, not bundled production data. Re-run the product checks against your runtime when updating the numerical example.

## Design and rights

Creative direction: warm off-white (`#f6f5f1`), charcoal (`#242521`), rust (`#a43725`), and green (`#3c6251`); IBM Plex typography; the existing DeviceBench bracket-and-bars mark; generous margins; staggered type reveals; gently moving product panels; and transitions timed to the original score.

Reference supplied by the user: [launch-video post](https://x.com/Nin19536/status/2104607184755827049), sharing the [Cue Agents launch](https://x.com/CueAgents/status/2104589146153181192). It was inspected for pacing and composition only. Its characters, footage, brand, copy, and soundtrack are not used in this film.

Technical references: [FFmpeg MP4 fast-start documentation](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv) and [FFmpeg loudness normalization](https://ffmpeg.org/ffmpeg-filters.html#loudnorm). Final encoding and playback checks are recorded in the local QA evidence, rather than inferred from these references.
