#!/usr/bin/env node
/**
 * Deterministic native-resolution render of assets/launch-video/index.html.
 * Requirements: Node.js, `npm ci --prefix site`, Google Chrome, ffmpeg.
 * Run `node scripts/render-launch-video.mjs --help` for render and still options.
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { performance } from "node:perf_hooks";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "site", "package.json"));
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function help() {
  console.log(`DeviceBench launch-film renderer

Usage:
  node scripts/render-launch-video.mjs [options]

Options:
  --width N          Output width; default 3840 (native UHD)
  --height N         Output height; default 2160
  --fps N            Frames per second; default 60
  --duration N       Seconds to render; default 48
  --start N          Timeline start in seconds; default 0
  --workers N        Parallel Chromium pages; default 3, maximum 8
  --browser NAME     chrome (installed, default) or chromium (Playwright)
  --scene PATH       Default assets/launch-video/index.html
  --output PATH      Default assets/launch-video/devicebench-v1-4k.mp4
  --audio PATH       Default reports/launch-video/score.wav
  --no-audio         Export silent video
  --preview          Default to 1280x720/30fps and a reports/ output
  --benchmark        Default to a two-second silent native-UHD sample
  --stills SECONDS   Export only comma-separated timestamps as PNGs
  --still-dir PATH   Default reports/launch-video/stills
  --crf N            H.264 quality; default 16 (lower is higher quality)
  --preset NAME      x264 speed/size tradeoff; default medium
  --help             Show this help

Examples:
  node scripts/render-launch-video.mjs --benchmark
  node scripts/render-launch-video.mjs --preview --duration 8
  node scripts/render-launch-video.mjs --stills 2,10,18,26,34,44
  node scripts/render-launch-video.mjs

The HTML must provide a #film canvas, window.videoReady Promise and
window.renderFrame(seconds). Frames are rendered as lossless PNG at the
requested resolution and piped in order to ffmpeg without frame files.
The finished MP4 uses H.264 High, Rec.709, yuv420p, AAC 48 kHz/320 kbps,
and fast-start metadata. A neighboring .render.json records the export.
`);
}

function parseArgs(args) {
  const values = new Map();
  const flags = new Set(["help", "preview", "benchmark", "no-audio"]);
  const known = new Set([
    ...flags,
    "width",
    "height",
    "fps",
    "duration",
    "start",
    "workers",
    "browser",
    "scene",
    "output",
    "audio",
    "stills",
    "still-dir",
    "crf",
    "preset",
  ]);
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || !known.has(key)) {
      throw new Error(`Unknown option: ${args[i]}`);
    }
    if (values.has(key)) throw new Error(`Repeated option: --${key}`);
    if (flags.has(key)) values.set(key, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith("--")) {
        throw new Error(`--${key} requires a value.`);
      }
      values.set(key, value);
    }
  }
  if (values.has("help")) return { help: true };
  const browser = values.get("browser") ?? "chrome";
  if (!["chrome", "chromium"].includes(browser)) {
    throw new Error("--browser must be chrome or chromium.");
  }
  const preview = values.has("preview");
  const benchmark = values.has("benchmark");
  const number = (key, fallback, min, max, integer = false) => {
    const value = Number(values.get(key) ?? fallback);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      throw new Error(
        `--${key} must be ${integer ? "an integer" : "a number"} from ${min} to ${max}.`,
      );
    }
    return value;
  };
  const width = number("width", preview ? 1280 : 3840, 320, 7680, true);
  const height = number("height", preview ? 720 : 2160, 180, 4320, true);
  if (width % 2 || height % 2 || width * 9 !== height * 16) {
    throw new Error(
      "Width and height must be even and use the film’s 16:9 aspect ratio.",
    );
  }
  const output = resolve(
    root,
    values.get("output") ??
      (benchmark
        ? "reports/launch-video/render-benchmark.mp4"
        : preview
          ? "reports/launch-video/preview.mp4"
          : "assets/launch-video/devicebench-v1-4k.mp4"),
  );
  if (extname(output).toLowerCase() !== ".mp4") {
    throw new Error("--output must be an .mp4 path.");
  }
  const presets = new Set([
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
  ]);
  const preset = values.get("preset") ?? "medium";
  if (!presets.has(preset)) throw new Error("Unknown x264 preset.");
  const stills = values.has("stills")
    ? String(values.get("stills")).split(",").map(Number)
    : null;
  if (
    stills &&
    (!stills.length ||
      stills.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 600,
      ))
  ) {
    throw new Error(
      "--stills must contain comma-separated timestamps between 0 and 600.",
    );
  }
  return {
    width,
    height,
    browser,
    fps: number("fps", preview ? 30 : 60, 1, 120, true),
    duration: number("duration", benchmark ? 2 : 48, 0.1, 600),
    start: number("start", 0, 0, 600),
    workers: number("workers", Math.min(3, cpus().length), 1, 8, true),
    output,
    scene: resolve(
      root,
      values.get("scene") ?? "assets/launch-video/index.html",
    ),
    audio:
      values.has("no-audio") || benchmark
        ? null
        : resolve(
            root,
            values.get("audio") ?? "reports/launch-video/score.wav",
          ),
    stills,
    stillDir: resolve(
      root,
      values.get("still-dir") ?? "reports/launch-video/stills",
    ),
    crf: number("crf", 16, 0, 30, true),
    preset,
    benchmark,
  };
}

async function startServer(scene) {
  const scenePath = relative(root, scene);
  if (scenePath === ".." || scenePath.startsWith(`..${sep}`)) {
    throw new Error("--scene must be inside the repository.");
  }
  await stat(scene);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      const local = relative(root, path);
      if (local === ".." || local.startsWith(`..${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/${scenePath.split(sep).map(encodeURIComponent).join("/")}`,
  };
}

async function createPage(browser, url, options) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(
    () => typeof window.renderFrame === "function",
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(async ({ width, height }) => {
    await window.videoReady;
    await document.fonts.ready;
    const canvas = document.getElementById("film");
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error("Missing #film canvas.");
    canvas.width = width;
    canvas.height = height;
  }, options);
  if (errors.length) throw new Error(errors.join("\n"));
  return { page, errors };
}

async function frame(worker, seconds, options) {
  const base64 = await worker.page.evaluate(
    async ({ seconds, width, height }) => {
      const canvas = document.getElementById("film");
      // Each exported frame starts with a fresh backing store and context
      // state, so output is independent of previous timeline seeks.
      canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      await document.fonts.ready;
      await window.renderFrame(seconds);
      if (canvas.width !== width || canvas.height !== height) {
        throw new Error(
          `Canvas changed resolution to ${canvas.width}×${canvas.height}; expected ${width}×${height}.`,
        );
      }
      return canvas
        .toDataURL("image/png")
        .slice("data:image/png;base64,".length);
    },
    { seconds, width: options.width, height: options.height },
  );
  if (worker.errors.length) throw new Error(worker.errors.join("\n"));
  return Buffer.from(base64, "base64");
}

async function encode(pages, options) {
  if (options.audio) {
    try {
      await stat(options.audio);
    } catch {
      throw new Error(
        `Audio not found: ${options.audio}. Generate the score or pass --no-audio.`,
      );
    }
  }
  await mkdir(dirname(options.output), { recursive: true });
  const temporary = options.output.replace(/\.mp4$/i, ".partial.mp4");
  const frameCount = Math.round(options.duration * options.fps);
  const exactDuration = frameCount / options.fps;
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(options.fps),
    "-vcodec",
    "png",
    "-i",
    "pipe:0",
  ];
  if (options.audio)
    args.push("-ss", String(options.start), "-i", options.audio);
  args.push(
    "-map",
    "0:v:0",
    ...(options.audio ? ["-map", "1:a:0"] : []),
    "-c:v",
    "libx264",
    "-preset",
    options.preset,
    "-crf",
    String(options.crf),
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale=in_range=full:out_range=tv:out_color_matrix=bt709,setsar=1,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-threads",
    String(Math.min(8, cpus().length)),
    "-r",
    String(options.fps),
    "-fps_mode",
    "cfr",
    "-t",
    String(exactDuration),
    "-movflags",
    "+faststart",
    "-metadata",
    "title=DeviceBench V1 — Local AI, ready for your app.",
    "-metadata",
    "comment=Original DeviceBench product film. Native-resolution deterministic canvas render.",
  );
  if (options.audio) args.push("-c:a", "aac", "-b:a", "320k", "-ar", "48000");
  args.push(temporary);
  const encoder = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let encoderError = null;
  let stderr = "";
  encoder.stderr.on("data", (data) => {
    stderr = (stderr + data.toString()).slice(-16_384);
  });
  encoder.stdin.on("error", (error) => {
    encoderError = error;
  });
  encoder.on("error", (error) => {
    encoderError = error;
  });
  const completed = new Promise((resolvePromise, rejectPromise) => {
    encoder.once("error", rejectPromise);
    encoder.once("close", (code) =>
      code === 0
        ? resolvePromise()
        : rejectPromise(new Error(`ffmpeg exited ${code}: ${stderr}`)),
    );
  });
  // Prevent an early ffmpeg failure becoming an unhandled rejection while rendering.
  completed.catch(() => {});
  const started = performance.now();
  let lastLog = started;
  try {
    for (let index = 0; index < frameCount; index += pages.length) {
      if (encoderError || encoder.exitCode !== null) {
        throw encoderError ?? new Error(`ffmpeg exited early: ${stderr}`);
      }
      const count = Math.min(pages.length, frameCount - index);
      const images = await Promise.all(
        pages
          .slice(0, count)
          .map((page, offset) =>
            frame(
              page,
              options.start + (index + offset) / options.fps,
              options,
            ),
          ),
      );
      for (const image of images) {
        if (encoderError) throw encoderError;
        if (!encoder.stdin.write(image)) await once(encoder.stdin, "drain");
      }
      const now = performance.now();
      if (now - lastLog > 10_000 || index + count === frameCount) {
        const seconds = (now - started) / 1000;
        const done = index + count;
        const speed = done / seconds;
        const remaining = (frameCount - done) / speed;
        console.log(
          `${done}/${frameCount} frames · ${speed.toFixed(1)} fps · ${remaining.toFixed(0)}s remaining`,
        );
        lastLog = now;
      }
    }
    encoder.stdin.end();
    await completed;
    await rename(temporary, options.output);
  } catch (error) {
    encoder.stdin.destroy();
    encoder.kill("SIGTERM");
    throw error;
  }
  const elapsedSeconds = (performance.now() - started) / 1000;
  const metadata = {
    createdAt: new Date().toISOString(),
    source: relative(root, options.scene),
    output: relative(root, options.output),
    width: options.width,
    height: options.height,
    fps: options.fps,
    startSeconds: options.start,
    durationSeconds: exactDuration,
    frameCount,
    workers: pages.length,
    frameTransfer: "lossless PNG; native requested canvas resolution",
    frameIsolation:
      "fresh canvas backing store for every frame; GPU canvas disabled",
    video: {
      codec: "H.264 High",
      pixelFormat: "yuv420p",
      colorSpace: "Rec.709",
      crf: options.crf,
      preset: options.preset,
    },
    audio: options.audio
      ? {
          source: relative(root, options.audio),
          codec: "AAC",
          sampleRate: 48000,
          bitRate: 320000,
        }
      : null,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    renderFramesPerSecond: Number((frameCount / elapsedSeconds).toFixed(2)),
    bytes: (await stat(options.output)).size,
  };
  await writeFile(
    options.output.replace(/\.mp4$/i, ".render.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  console.log(
    `Saved ${options.output}\n${options.width}×${options.height} · ${options.fps}fps · ${exactDuration}s · ${(metadata.bytes / 1024 / 1024).toFixed(1)} MiB · ${elapsedSeconds.toFixed(1)}s render`,
  );
  if (options.benchmark) {
    console.log(
      `Estimated 48s render at this throughput: ${((elapsedSeconds * 48) / exactDuration / 60).toFixed(1)} minutes. Scene complexity may vary.`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return help();
  const { chromium } = require("playwright");
  const { server, url } = await startServer(options.scene);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(options.browser === "chrome" ? { channel: "chrome" } : {}),
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-accelerated-2d-canvas",
      ],
    });
    const count = options.stills
      ? Math.min(options.stills.length, options.workers)
      : options.workers;
    const pages = await Promise.all(
      Array.from({ length: count }, () => createPage(browser, url, options)),
    );
    if (options.stills) {
      await mkdir(options.stillDir, { recursive: true });
      for (
        let index = 0;
        index < options.stills.length;
        index += pages.length
      ) {
        await Promise.all(
          options.stills
            .slice(index, index + pages.length)
            .map(async (seconds, offset) => {
              const output = join(
                options.stillDir,
                `frame-${seconds.toFixed(3).replace(".", "-")}.png`,
              );
              await writeFile(
                output,
                await frame(pages[offset], seconds, options),
              );
              console.log(`Saved ${output}`);
            }),
        );
      }
    } else {
      await encode(pages, options);
    }
  } finally {
    await browser?.close();
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
}

main().catch((error) => {
  console.error(`Render failed: ${error.message}`);
  process.exitCode = 1;
});
