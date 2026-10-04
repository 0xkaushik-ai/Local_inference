/* DeviceBench V1 — original, frame-accurate motion design. All coordinates are 1920×1080 design units. */
"use strict";
const canvas = document.getElementById("film");
// CPU-backed rendering keeps repeated glyphs reliable across frame readbacks.
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
const C = {
  bg: "#f6f5f1",
  paper: "#ffffff",
  ink: "#242521",
  muted: "#66685f",
  light: "#e9e8e1",
  line: "#d9dad2",
  rust: "#a43725",
  rose: "#f1e9e3",
  green: "#3c6251",
  mint: "#e7eee7",
  amber: "#8a6a35",
  sand: "#f4eddf",
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 4);
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mix = (a, b, x) => a + (b - a) * x;
const sceneTimes = [0, 4.8, 9.6, 16.8, 24, 31.2, 36, 40.8, 44.4, 48];
const sceneNames = [
  "LOCAL AI, MEET CLARITY",
  "MEET DEVICEBENCH",
  "01 / DIAGNOSE",
  "02 / UNDERSTAND",
  "03 / VERIFY",
  "BUILT AROUND YOUR APP",
  "KEEP THE EVIDENCE",
  "A CLEARER WORKFLOW",
  "DEVICEBENCH / V1 PREVIEW",
];
let now = 0;
function rr(x, y, w, h, r = 16, fill = C.paper, stroke = null, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function line(x1, y1, x2, y2, color = C.line, w = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function text(
  str,
  x,
  y,
  size = 32,
  color = C.ink,
  weight = 400,
  align = "left",
  mono = false,
) {
  ctx.font = `${weight} ${size}px "${mono ? "Plex Mono" : "Plex"}"`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function tracked(str, x, y, size = 15, color = C.muted, spacing = 2.3) {
  ctx.font = `400 ${size}px "Plex Mono"`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  for (const char of str) {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + spacing;
  }
}
function paragraphs(
  lines,
  x,
  y,
  size = 30,
  color = C.muted,
  gap = 42,
  weight = 400,
) {
  for (let i = 0; i < lines.length; i++)
    text(lines[i], x, y + i * gap, size, color, weight);
}
function enter(t, delay, draw, dy = 42, duration = 0.8) {
  const p = ease((t - delay) / duration);
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, (1 - p) * dy);
  draw(p);
  ctx.restore();
}
function panel(
  x,
  y,
  w,
  h,
  draw,
  { rotate = 0, scale = 1, shadow = true } = {},
) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotate);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = "#24252114";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 24;
    rr(0, 0, w, h, 20, C.paper);
    ctx.restore();
  }
  rr(0, 0, w, h, 20, C.paper, C.line);
  draw(w, h);
  ctx.restore();
}
function mark(x, y, s = 56, color = C.ink, accent = C.rust) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 28, s / 28);
  ctx.lineCap = "butt";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(7, 5);
  ctx.lineTo(3, 5);
  ctx.lineTo(3, 23);
  ctx.lineTo(7, 23);
  ctx.moveTo(21, 5);
  ctx.lineTo(25, 5);
  ctx.lineTo(25, 23);
  ctx.lineTo(21, 23);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(10, 19);
  ctx.lineTo(10, 14);
  ctx.moveTo(14, 19);
  ctx.lineTo(14, 9);
  ctx.moveTo(18, 19);
  ctx.lineTo(18, 5);
  ctx.stroke();
  ctx.restore();
}
function brand(x, y, size = 42, color = C.ink) {
  mark(x, y - size * 0.82, size * 1.05, color);
  text("devicebench", x + size * 1.36, y, size, color, 550);
}
function check(x, y, s = 18, color = C.green, progress = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.48, y);
  ctx.lineTo(x - s * 0.1, y + s * 0.38);
  ctx.lineTo(x + s * 0.62, y - s * 0.48);
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.17;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([s * 1.8, s * 1.8]);
  ctx.lineDashOffset = s * 1.8 * (1 - clamp(progress));
  ctx.stroke();
  ctx.restore();
}
function arrow(x, y, s = 22, color = C.ink) {
  line(x - s, y, x + s, y, color, 2.5);
  line(x + s, y, x + s * 0.25, y - s * 0.75, color, 2.5);
  line(x + s, y, x + s * 0.25, y + s * 0.75, color, 2.5);
}
function icon(kind, x, y, s = 64, color = C.rust) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 64, s / 64);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "doctor") {
    ctx.beginPath();
    ctx.moveTo(6, 33);
    ctx.lineTo(19, 33);
    ctx.lineTo(26, 17);
    ctx.lineTo(36, 48);
    ctx.lineTo(44, 28);
    ctx.lineTo(58, 28);
    ctx.stroke();
    rr(1, 1, 62, 62, 15, null, color, 2);
  } else if (kind === "model") {
    rr(13, 13, 38, 38, 8, null, color, 3);
    rr(23, 23, 18, 18, 3, null, color, 2);
    for (const k of [23, 41]) {
      line(k, 4, k, 11, color, 3);
      line(k, 53, k, 60, color, 3);
      line(4, k, 11, k, color, 3);
      line(53, k, 60, k, color, 3);
    }
  } else if (kind === "compat") {
    ctx.beginPath();
    ctx.moveTo(21, 11);
    ctx.lineTo(7, 11);
    ctx.lineTo(7, 53);
    ctx.lineTo(21, 53);
    ctx.moveTo(43, 11);
    ctx.lineTo(57, 11);
    ctx.lineTo(57, 53);
    ctx.lineTo(43, 53);
    ctx.stroke();
    check(32, 32, 21, color);
  } else if (kind === "file") {
    ctx.beginPath();
    ctx.moveTo(14, 3);
    ctx.lineTo(39, 3);
    ctx.lineTo(53, 17);
    ctx.lineTo(53, 61);
    ctx.lineTo(14, 61);
    ctx.closePath();
    ctx.stroke();
    line(39, 3, 39, 18, color, 2);
    line(39, 18, 53, 18, color, 2);
    line(23, 31, 44, 31, color, 2);
    line(23, 41, 44, 41, color, 2);
    line(23, 51, 37, 51, color, 2);
  } else if (kind === "chat") {
    rr(4, 8, 56, 41, 12, null, color, 3);
    ctx.beginPath();
    ctx.moveTo(18, 49);
    ctx.lineTo(18, 61);
    ctx.lineTo(32, 49);
    ctx.stroke();
    [20, 32, 44].forEach((k) => circle(k, 28, 2.5, color));
  } else if (kind === "search") {
    ctx.beginPath();
    ctx.arc(27, 27, 18, 0, Math.PI * 2);
    ctx.stroke();
    line(40, 40, 59, 59, color, 4);
    [18, 27, 36].forEach((k, i) => line(k, 35, k, 25 - i * 5, color, 2.5));
  } else if (kind === "json") {
    text("{ }", 32, 48, 52, color, 400, "center", true);
  }
  ctx.restore();
}
function tag(label, x, y, w, color = C.green, bg = C.mint) {
  rr(x, y - 27, w, 38, 7, bg);
  text(label, x + w / 2, y, 19, color, 500, "center");
}
function ruleLabel(label, x, y) {
  tracked(label, x, y, 14, C.muted, 1.2);
}
function recorded(y = 930) {
  text(
    "Recorded local example · Linux / Ollama / Qwen3 0.6B",
    120,
    y,
    19,
    C.muted,
    400,
    "left",
    true,
  );
}
function footer(t, index) {
  line(120, 1008, 1800, 1008, C.line, 1);
  line(120, 1008, mix(120, 1800, t / 48), 1008, C.rust, 2);
  text("DEVICEBENCH", 120, 1045, 14, C.muted, 400, "left", true);
  text("V1 PREVIEW", 1800, 1045, 14, C.muted, 400, "right", true);
}
function sceneChrome(index) {
  if (index !== 1 && index !== 8) brand(120, 88, 30);
  if (index !== 8)
    text(sceneNames[index], 1800, 80, 15, C.muted, 400, "right", true);
}
function background(t) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, 1920, 1080);
  const g = ctx.createRadialGradient(
    1450 + Math.sin(t * 0.18) * 80,
    450,
    40,
    1450,
    450,
    780,
  );
  g.addColorStop(0, "#ffffffb0");
  g.addColorStop(1, "#ffffff00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
}
function intro(t) {
  const q = ease(t / 0.85);
  enter(t, 0.1, () => text("Local AI.", 120, 386, 132, C.ink, 500), 65);
  enter(t, 0.55, () => text("Ready for", 120, 512, 118, C.ink, 450), 65);
  enter(t, 0.78, () => text("your app?", 120, 640, 118, C.rust, 450), 65);
  enter(
    t,
    1.35,
    () =>
      paragraphs(
        ["Your hardware. Your model.", "A few important questions."],
        125,
        741,
        32,
      ),
    30,
  );
  const tiles = [
    {
      label: "Your setup",
      small: "Can it connect?",
      kind: "doctor",
      x: 1160,
      y: 200,
      w: 510,
      r: -0.035,
    },
    {
      label: "Your model",
      small: "What does it need?",
      kind: "model",
      x: 1060,
      y: 400,
      w: 590,
      r: 0.025,
    },
    {
      label: "Your app",
      small: "Will the features work?",
      kind: "compat",
      x: 1180,
      y: 616,
      w: 500,
      r: -0.018,
    },
  ];
  tiles.forEach((tile, i) =>
    enter(
      t,
      0.3 + i * 0.23,
      (p) => {
        const float = Math.sin(t * 1.1 + i * 1.3) * 4;
        panel(
          tile.x,
          tile.y + float,
          tile.w,
          164,
          () => {
            rr(26, 27, 104, 108, 17, C.rose);
            icon(tile.kind, 46, 48, 64);
            text(tile.label, 153, 70, 33, C.ink, 500);
            text(tile.small, 153, 111, 23, C.muted);
            if (t > 2.7 + i * 0.23) {
              ctx.globalAlpha *= smooth((t - 2.7 - i * 0.23) / 0.5);
              circle(tile.w - 35, 38, 6, C.rust);
            }
          },
          { rotate: tile.r * (1 - 0.6 * q), scale: mix(0.94, 1, p) },
        );
      },
      75,
    ),
  );
}
function meet(t) {
  enter(t, 0.08, () => text("Meet", 960, 244, 58, C.muted, 400, "center"), 35);
  enter(
    t,
    0.18,
    () => {
      mark(557, 291, 113);
      text("devicebench", 700, 394, 113, C.ink, 550);
    },
    50,
  );
  enter(
    t,
    0.5,
    () =>
      text(
        "Three tools. One local workspace.",
        960,
        475,
        39,
        C.muted,
        400,
        "center",
      ),
    24,
  );
  const xs = [250, 756, 1262],
    kinds = ["doctor", "model", "compat"],
    titles = [
      "Diagnose your setup",
      "Understand your model",
      "Test app features",
    ];
  xs.forEach((x, i) =>
    enter(
      t,
      0.76 + i * 0.15,
      (p) =>
        panel(
          x,
          587,
          408,
          234,
          () => {
            icon(kinds[i], 169, 32, 70);
            text(`0${i + 1}`, 31, 43, 17, C.muted, 400, "left", true);
            text(titles[i], 204, 163, 28, C.ink, 500, "center");
            line(150, 192, 258, 192, C.rust, 3);
          },
          { scale: mix(0.95, 1, p) },
        ),
      44,
    ),
  );
  enter(
    t,
    1.4,
    () =>
      text(
        "Run locally. See what’s supported. Keep the evidence.",
        960,
        915,
        26,
        C.muted,
        400,
        "center",
      ),
    18,
  );
}
function doctor(t) {
  enter(
    t,
    0.05,
    () => {
      ruleLabel("01 / LOCAL AI DOCTOR", 120, 233);
      paragraphs(["Start with", "your setup."], 120, 358, 104, C.ink, 113, 450);
    },
    45,
  );
  enter(
    t,
    0.4,
    () =>
      paragraphs(
        ["One place to check your runtime,", "installed models, and hardware."],
        124,
        590,
        31,
        C.muted,
        45,
      ),
    28,
  );
  enter(
    t,
    0.9,
    () => {
      rr(120, 734, 560, 77, 12, C.rose);
      icon("doctor", 144, 751, 40);
      text("Find the next step.", 207, 785, 30, C.rust, 500);
    },
    25,
  );
  enter(
    t,
    0.2,
    (p) =>
      panel(
        838,
        186,
        944,
        678,
        () => {
          ruleLabel("LOCAL AI DOCTOR", 34, 44);
          text("Your local runtime is connected.", 34, 107, 35, C.ink, 500);
          rr(34, 138, 876, 86, 10, C.mint);
          circle(63, 180, 7, C.green);
          text("Ollama native", 88, 174, 26, C.ink, 500);
          text("1 installed model", 88, 205, 20, C.muted);
          tag("Connected", 731, 189, 151);
          const rows = [
            {
              title: "Runtime connection",
              sub: "Your local AI server is responding.",
              kind: "doctor",
            },
            {
              title: "Installed model",
              sub: "Qwen3 0.6B · Q4_K_M",
              kind: "model",
            },
            {
              title: "Hardware information",
              sub: "CPU, system memory, and NVIDIA memory",
              kind: "compat",
            },
          ];
          rows.forEach((r, i) => {
            const yy = 257 + i * 113;
            enter(
              t,
              0.82 + i * 0.28,
              () => {
                line(34, yy - 10, 910, yy - 10);
                icon(r.kind, 41, yy + 14, 38, C.muted);
                text(r.title, 103, yy + 35, 25, C.ink, 500);
                text(r.sub, 103, yy + 70, 21, C.muted);
                if (i < 2) {
                  circle(864, yy + 37, 17, C.mint);
                  check(
                    864,
                    yy + 37,
                    15,
                    C.green,
                    smooth((t - 1.05 - i * 0.28) / 0.5),
                  );
                }
              },
              22,
              0.6,
            );
          });
          text("Read-only checks · No model is loaded", 34, 636, 21, C.muted);
        },
        { rotate: mix(0.014, 0, p), scale: mix(0.965, 1, p) },
      ),
    40,
  );
  recorded();
}
function model(t) {
  enter(
    t,
    0.05,
    () => {
      ruleLabel("02 / MODEL & CONTEXT", 120, 233);
      paragraphs(
        ["Know what", "your model", "needs."],
        120,
        351,
        97,
        C.ink,
        104,
        450,
      );
    },
    45,
  );
  enter(
    t,
    0.55,
    () =>
      paragraphs(
        ["Inspect context limits.", "Estimate memory before integrating."],
        124,
        746,
        29,
        C.muted,
        44,
      ),
    25,
  );
  enter(
    t,
    0.15,
    (p) =>
      panel(
        842,
        178,
        938,
        696,
        () => {
          ruleLabel("MODEL & CONTEXT CHECKER", 36, 44);
          text("Qwen3 0.6B", 36, 102, 40, C.ink, 500);
          tag("Q4_K_M", 743, 89, 154, C.muted, C.bg);
          line(36, 128, 902, 128);
          text("Requested context", 36, 178, 25, C.muted);
          text("4,096", 902, 181, 39, C.ink, 500, "right");
          rr(36, 240, 866, 7, 4, C.light);
          rr(36, 240, 866 * 0.1 * ease((t - 0.5) / 1), 7, 4, C.rust);
          circle(36 + 866 * 0.1 * ease((t - 0.5) / 1), 243, 11, C.rust);
          text("tokens", 902, 215, 18, C.muted, 400, "right");
          enter(
            t,
            0.65,
            () => {
              rr(36, 270, 866, 260, 12, C.rose);
              ruleLabel("ESTIMATED MEMORY", 65, 318);
              text("1.31", 61, 449, 118, C.ink, 450);
              text("GiB", 340, 449, 42, C.rust, 450);
              text(
                "Weights + context cache + runtime allowance",
                65,
                498,
                22,
                C.muted,
              );
            },
            30,
          );
          enter(
            t,
            1.15,
            () => {
              circle(50, 584, 12, C.mint);
              check(50, 584, 12);
              text(
                "Requested context is within the declared limit.",
                77,
                592,
                23,
                C.ink,
              );
              text(
                "Estimate only. Confirm loading with your runtime.",
                36,
                648,
                21,
                C.muted,
              );
            },
            24,
          );
        },
        { rotate: mix(-0.012, 0, p) },
      ),
    40,
  );
  recorded();
}
function compat(t) {
  enter(
    t,
    0.05,
    () => {
      ruleLabel("03 / APP COMPATIBILITY", 120, 233);
      paragraphs(
        ["Check the features", "your app needs."],
        120,
        358,
        88,
        C.ink,
        106,
        450,
      );
    },
    45,
  );
  enter(
    t,
    0.5,
    () =>
      paragraphs(
        [
          "Small requests. Real responses.",
          "Clear results for each requirement.",
        ],
        124,
        633,
        30,
        C.muted,
        44,
      ),
    25,
  );
  enter(
    t,
    1.4,
    () => {
      tag("Streaming", 124, 770, 169);
      tag("Structured JSON", 310, 770, 241);
    },
    25,
  );
  enter(
    t,
    0.2,
    (p) =>
      panel(
        919,
        178,
        861,
        696,
        () => {
          ruleLabel("APP COMPATIBILITY TESTER", 35, 44);
          text("Selected checks passed.", 35, 104, 39, C.ink, 500);
          text("Recorded local example · Qwen3 0.6B", 35, 143, 21, C.muted);
          [
            {
              title: "Streaming",
              sub: "Framed response + completion",
              time: 0.85,
            },
            {
              title: "Structured JSON",
              sub: "Response matches the requested schema",
              time: 1.4,
            },
          ].forEach((r, i) =>
            enter(
              t,
              r.time,
              () => {
                const y = 183 + i * 116;
                rr(35, y, 791, 98, 12, C.bg, C.line);
                circle(77, y + 49, 22, C.mint);
                check(
                  77,
                  y + 49,
                  22,
                  C.green,
                  smooth((t - r.time - 0.12) / 0.4),
                );
                text(r.title, 121, y + 42, 26, C.ink, 500);
                text(r.sub, 121, y + 74, 20, C.muted);
                tag("Passed", 690, y + 58, 105);
              },
              23,
              0.7,
            ),
          );
          enter(
            t,
            2,
            () => {
              rr(35, 441, 791, 128, 12, "#242521");
              text(
                "RESPONSE / STRUCTURED JSON",
                59,
                475,
                14,
                "#b6b9aa",
                400,
                "left",
                true,
              );
              text('{ "ok": true }', 59, 532, 38, "#f6f5f1", 400, "left", true);
              circle(786, 509, 8, "#94bc9e");
            },
            22,
          );
          text("Also check tool calling and embeddings", 35, 620, 23, C.ink);
          text(
            "Support depends on the selected model and server.",
            35,
            657,
            20,
            C.muted,
          );
        },
        { rotate: mix(0.012, 0, p) },
      ),
    40,
  );
  recorded();
}
function presetsScene(t) {
  enter(
    t,
    0.04,
    () => {
      text("Start with what", 960, 247, 83, C.ink, 450, "center");
      text("you’re building.", 960, 342, 83, C.rust, 450, "center");
    },
    38,
  );
  const cards = [
    { title: "Chatbot", desc: "Streaming", kind: "chat" },
    { title: "Data extraction", desc: "Structured JSON", kind: "json" },
    { title: "Tool assistant", desc: "Streaming + tools", kind: "compat" },
    { title: "Semantic search", desc: "Embeddings", kind: "search" },
  ];
  const selected = Math.min(3, Math.floor(Math.max(0, t - 0.7) / 0.72));
  cards.forEach((card, i) =>
    enter(
      t,
      0.3 + i * 0.12,
      () => {
        const x = 132 + i * 424,
          active = i === selected;
        const focusIn = smooth((t - (0.7 + i * 0.72)) / 0.2);
        const focusOut =
          i === 3 ? 1 : 1 - smooth((t - (0.7 + (i + 1) * 0.72)) / 0.2);
        const s = 1 + 0.035 * focusIn * focusOut;
        panel(
          x,
          465,
          384,
          290,
          () => {
            icon(card.kind, 154, 47, 75, active ? C.rust : C.muted);
            text(card.title, 192, 188, 30, C.ink, 500, "center");
            text(card.desc, 192, 238, 22, C.muted, 400, "center");
            if (active) {
              rr(0, 0, 384, 290, 20, null, C.rust, 2);
              circle(345, 37, 15, C.rust);
              check(345, 37, 13, C.paper);
            }
          },
          { scale: s },
        );
      },
      36,
    ),
  );
  enter(
    t,
    0.9,
    () =>
      text(
        "Choose a preset. Adjust the checks. Run when you’re ready.",
        960,
        863,
        30,
        C.muted,
        400,
        "center",
      ),
    22,
  );
  enter(
    t,
    1.3,
    () =>
      text(
        "Presets select API checks; they do not validate a complete application.",
        960,
        926,
        20,
        C.muted,
        400,
        "center",
      ),
    15,
  );
}
function exportScene(t) {
  enter(
    t,
    0.07,
    () => {
      ruleLabel("REPORTS YOU CAN KEEP", 120, 230);
      paragraphs(["Keep the", "evidence."], 120, 370, 116, C.ink, 128, 450);
    },
    45,
  );
  enter(
    t,
    0.5,
    () =>
      paragraphs(
        ["Download a readable report.", "Or take the JSON into your workflow."],
        124,
        632,
        30,
        C.muted,
        44,
      ),
    26,
  );
  enter(
    t,
    1.1,
    () =>
      text(
        "Findings. Settings. Recorded responses.",
        124,
        805,
        23,
        C.rust,
        500,
      ),
    18,
  );
  enter(
    t,
    0.2,
    (p) =>
      panel(
        1070,
        215,
        626,
        585,
        () => {
          text("report.json", 33, 52, 24, C.muted, 400, "left", true);
          text("EXCERPT", 593, 52, 14, C.muted, 400, "right", true);
          line(33, 76, 593, 76);
          text("{", 39, 132, 28, C.rust, 400, "left", true);
          const lines = [
            '  "tool":',
            '    "App Compatibility Tester",',
            '  "protocol": "ollama",',
            '  "findings": [',
            '    { "status": "pass" },',
            '    { "status": "pass" }',
            "  ]",
            "}",
          ];
          lines.forEach((s, i) =>
            enter(
              t,
              0.65 + i * 0.07,
              () =>
                text(
                  s,
                  39,
                  180 + i * 45,
                  21,
                  i === 3 || i === 4 ? C.green : C.ink,
                  400,
                  "left",
                  true,
                ),
              10,
              0.45,
            ),
          );
        },
        { rotate: mix(0.05, 0.027, p) },
      ),
    70,
  );
  enter(
    t,
    0.42,
    (p) =>
      panel(
        871,
        405,
        570,
        439,
        () => {
          icon("file", 33, 30, 44);
          text("Your readiness report", 98, 63, 26, C.ink, 500);
          tag("HTML", 435, 59, 97, C.rust, C.rose);
          line(33, 99, 537, 99);
          text("Selected checks passed.", 33, 155, 30, C.ink, 500);
          ["Streaming", "Structured JSON"].forEach((s, i) => {
            const y = 214 + i * 71;
            circle(51, y - 7, 16, C.mint);
            check(51, y - 7, 15);
            text(s, 84, y, 24, C.ink);
            line(33, y + 26, 537, y + 26);
          });
          text("Open it. Review it. Share it.", 33, 390, 22, C.muted);
        },
        { rotate: mix(-0.04, -0.018, p) },
      ),
    70,
  );
  enter(
    t,
    1.65,
    () => {
      rr(1352, 834, 318, 67, 33, C.ink);
      check(1388, 867, 19, C.paper);
      text("Report downloaded", 1421, 875, 22, C.paper, 500);
    },
    20,
  );
}
function promise(t) {
  enter(
    t,
    0.02,
    () => text("Your machine.", 960, 359, 118, C.ink, 450, "center"),
    40,
  );
  enter(
    t,
    0.24,
    () => text("Clear next steps.", 960, 495, 118, C.rust, 450, "center"),
    40,
  );
  const items = ["Diagnose", "Inspect", "Test", "Export"];
  items.forEach((s, i) =>
    enter(
      t,
      0.68 + i * 0.14,
      () => {
        const x = 375 + i * 385;
        circle(x, 677, 29, C.rose);
        text(`0${i + 1}`, x, 684, 17, C.rust, 400, "center", true);
        text(s, x, 756, 32, C.ink, 500, "center");
        if (i < 3) arrow(x + 193, 692, 19, C.muted);
      },
      22,
    ),
  );
  enter(
    t,
    1.25,
    () =>
      text(
        "One local workspace. No account required.",
        960,
        871,
        28,
        C.muted,
        400,
        "center",
      ),
    20,
  );
}
function outro(t) {
  enter(
    t,
    0.03,
    () => {
      mark(539, 242, 130);
      text("devicebench", 704, 359, 124, C.ink, 550);
    },
    50,
  );
  enter(
    t,
    0.3,
    () => text("Local AI. Ready for you?", 960, 490, 60, C.ink, 450, "center"),
    30,
  );
  enter(
    t,
    0.55,
    () => {
      rr(716, 572, 488, 86, 6, C.ink);
      text("Explore the V1 preview", 960, 628, 31, C.paper, 500, "center");
    },
    24,
  );
  enter(
    t,
    0.83,
    () =>
      text(
        "github.com/0xkaushik-ai/Local_inference",
        960,
        753,
        30,
        C.muted,
        400,
        "center",
        true,
      ),
    20,
  );
  enter(
    t,
    1.15,
    () =>
      text(
        "Python companion + local dashboard",
        960,
        828,
        25,
        C.muted,
        400,
        "center",
      ),
    16,
  );
}
const scenes = [
  intro,
  meet,
  doctor,
  model,
  compat,
  presetsScene,
  exportScene,
  promise,
  outro,
];
window.renderFrame = function (seconds) {
  now = clamp(seconds, 0, 48);
  ctx.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 1920, 1080);
  background(now);
  for (let i = 0; i < scenes.length; i++) {
    const start = sceneTimes[i],
      end = sceneTimes[i + 1],
      local = now - start;
    if (now < start || now > end + 0.34) continue;
    const leave =
      i === scenes.length - 1 ? 1 : 1 - smooth((now - (end - 0.34)) / 0.68);
    if (leave <= 0) continue;
    ctx.save();
    ctx.globalAlpha = leave;
    ctx.translate(0, (1 - leave) * -25);
    sceneChrome(i);
    scenes[i](local);
    ctx.restore();
  }
  footer(now, 0);
};
window.videoReady = Promise.all([
  document.fonts.load('450 60px "Plex"'),
  document.fonts.load('550 60px "Plex"'),
  document.fonts.load('400 32px "Plex Mono"'),
])
  .then(() => document.fonts.ready)
  .then(() => {
    window.renderFrame(0);
    return true;
  });
if (new URLSearchParams(location.search).has("play")) {
  window.videoReady.then(() => {
    let start = null;
    function play(stamp) {
      if (start === null) start = stamp;
      window.renderFrame(((stamp - start) / 1000) % 48);
      requestAnimationFrame(play);
    }
    requestAnimationFrame(play);
  });
}
