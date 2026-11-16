// The Reef: the coral-node mark redrawn as SVG, presented on four 1920 × 1080 boards.
// usage: node scripts/build-reef-marks.mjs "<path to Portfolio-Needs/Graphics>"
// Output: <Graphics>/The Reef/Marks/0N-*.png (originals are left alone).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SRC = process.argv[2];
const EDGE = process.env.EDGE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
if (!SRC || !fs.existsSync(SRC)) {
  console.error("Pass the Graphics source folder.");
  process.exit(1);
}
const OUT = path.join(SRC, "The Reef", "Marks");
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "reef-"));

const NAVY = "#0b1f3a";
const CYAN = "#22c3f3";
const AQUA = "#8fe3ff";
const PALE = "#e8f3fa";

// A short, thick trunk fanning into five full branches, each ending in a node; a twig and one
// loose dot. Wider than tall, like coral. viewBox 260 × 220.
const mark = (fill) => `<svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${fill}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M128 206 C126 188 124 170 128 150" stroke-width="36"/>
  <path d="M136 204 C152 200 162 192 170 182" stroke-width="22"/>
  <path d="M124 160 C96 156 70 140 50 118" stroke-width="24"/>
  <path d="M126 150 C108 128 94 108 88 84" stroke-width="20"/>
  <path d="M128 148 C130 118 132 86 128 50" stroke-width="20"/>
  <path d="M132 150 C150 128 166 110 174 88" stroke-width="20"/>
  <path d="M134 162 C166 160 192 146 212 124" stroke-width="24"/>
  <path d="M128 114 C118 106 112 101 108 96" stroke-width="12"/>
  <g fill="${fill}" stroke="none">
    <circle cx="42" cy="108" r="21"/><circle cx="84" cy="72" r="17"/><circle cx="128" cy="38" r="21"/>
    <circle cx="178" cy="76" r="19"/><circle cx="220" cy="114" r="21"/><circle cx="104" cy="92" r="10"/><circle cx="156" cy="62" r="10"/>
  </g></svg>`;

const word = (color, size) => `<span style="font-family:Inter;font-weight:800;font-size:${size}px;letter-spacing:-0.045em;color:${color};line-height:1">The Reef</span>`;
const lockup = (markColor, wordColor, size) =>
  `<div style="display:flex;align-items:center;gap:${size * 0.28}px"><div style="width:${size * 1.7}px">${mark(markColor)}</div>${word(wordColor, size)}</div>`;
const stacked = (markColor, wordColor, size) =>
  `<div style="display:flex;flex-direction:column;align-items:center;gap:${size * 0.18}px"><div style="width:${size * 2}px">${mark(markColor)}</div>${word(wordColor, size)}</div>`;

const page = (bg, body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=block" rel="stylesheet">
<style>*{box-sizing:border-box}html,body{margin:0;overflow:hidden}
.b{position:relative;width:1920px;height:1080px;overflow:hidden;background:${bg};font-family:Inter,sans-serif}
.cap{position:absolute;left:96px;bottom:72px;font:500 26px Inter;letter-spacing:-0.01em}
.tile{display:flex;align-items:center;justify-content:center;border-radius:28px}
svg{display:block;width:100%;height:auto}</style></head><body><div class="b">${body}</div></body></html>`;

const rings = (color) =>
  [520, 760, 1000]
    .map((d) => `<div style="position:absolute;left:${960 - d / 2}px;top:${540 - d / 2}px;width:${d}px;height:${d}px;border:1.5px solid ${color};border-radius:50%"></div>`)
    .join("");

const BOARDS = [
  {
    name: "01-primary-mark",
    html: page(
      NAVY,
      `${rings("rgba(143,227,255,.14)")}
       <div style="position:absolute;left:660px;top:250px;width:600px">${mark(CYAN)}</div>
       <div class="cap" style="color:${AQUA}">Primary mark</div>`,
    ),
  },
  {
    name: "02-lockups",
    html: page(
      "#ffffff",
      `<div style="position:absolute;left:96px;top:96px;right:96px;height:520px;background:${PALE};border-radius:32px;display:flex;align-items:center;justify-content:center">${lockup(CYAN, NAVY, 150)}</div>
       <div style="position:absolute;left:96px;top:648px;width:848px;height:336px;border:2px solid ${PALE};border-radius:32px;display:flex;align-items:center;justify-content:center">${stacked(CYAN, NAVY, 70)}</div>
       <div style="position:absolute;left:976px;top:648px;width:848px;height:336px;background:${NAVY};border-radius:32px;display:flex;align-items:center;justify-content:center">${lockup("#ffffff", "#ffffff", 84)}</div>`,
    ),
  },
  {
    name: "03-on-colour",
    html: page(
      PALE,
      `<div style="position:absolute;inset:96px 96px 96px 96px;display:grid;grid-template-columns:repeat(4,1fr);gap:32px">
        <div class="tile" style="background:${NAVY}"><div style="width:62%">${mark(CYAN)}</div></div>
        <div class="tile" style="background:${CYAN}"><div style="width:62%">${mark(NAVY)}</div></div>
        <div class="tile" style="background:#ffffff"><div style="width:62%">${mark(CYAN)}</div></div>
        <div class="tile" style="background:#05080f"><div style="width:62%">${mark("#ffffff")}</div></div>
        <div class="tile" style="background:transparent"><div style="width:250px;height:250px;border-radius:58px;background:${NAVY};display:flex;align-items:center;justify-content:center;box-shadow:0 24px 48px rgba(11,31,58,.22)"><div style="width:66%">${mark(CYAN)}</div></div></div>
        <div class="tile" style="background:transparent"><div style="width:250px;height:250px;border-radius:50%;background:${CYAN};display:flex;align-items:center;justify-content:center;box-shadow:0 24px 48px rgba(11,31,58,.18)"><div style="width:62%">${mark("#ffffff")}</div></div></div>
        <div class="tile" style="background:transparent"><div style="width:250px;height:250px;border-radius:58px;background:#ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 24px 48px rgba(11,31,58,.14)"><div style="width:66%">${mark(CYAN)}</div></div></div>
        <div class="tile" style="background:transparent"><div style="width:120px;height:120px;border-radius:28px;background:${NAVY};display:flex;align-items:center;justify-content:center"><div style="width:68%">${mark(CYAN)}</div></div></div>
      </div>`,
    ),
  },
  {
    name: "04-social",
    html: page(
      "#dfe9f1",
      `<div style="position:absolute;left:96px;top:120px;width:1728px;height:560px;border-radius:32px;overflow:hidden;background:${NAVY};box-shadow:0 30px 60px rgba(11,31,58,.25)">
         ${[420, 640, 860].map((d) => `<div style="position:absolute;left:${1500 - d / 2}px;top:${280 - d / 2}px;width:${d}px;height:${d}px;border:1.5px solid rgba(143,227,255,.16);border-radius:50%"></div>`).join("")}
         <div style="position:absolute;left:1270px;top:90px;width:460px;opacity:.95">${mark(CYAN)}</div>
         <div style="position:absolute;left:96px;top:150px">${word("#ffffff", 150)}</div>
         <div style="position:absolute;left:100px;top:330px;font:500 40px Inter;color:${AQUA};letter-spacing:-0.01em">Learn. Build. Ship.</div>
       </div>
       <div style="position:absolute;left:196px;top:560px;width:260px;height:260px;border-radius:50%;background:${CYAN};border:10px solid #dfe9f1;display:flex;align-items:center;justify-content:center"><div style="width:62%">${mark("#ffffff")}</div></div>
       <div style="position:absolute;left:500px;top:720px">${word(NAVY, 64)}</div>
       <div style="position:absolute;left:502px;top:800px;font:500 30px Inter;color:#4b5d73">A community for builders, creators and problem-solvers.</div>`,
    ),
  },
];

for (const b of BOARDS) {
  const file = path.join(TMP, `${b.name}.html`);
  fs.writeFileSync(file, b.html);
  const png = path.join(OUT, `${b.name}.png`);
  execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1920,1080", "--virtual-time-budget=6000", `--user-data-dir=${path.join(TMP, "profile")}`, `--screenshot=${png}`, "file:///" + file.replace(/\\/g, "/")], { stdio: "ignore" });
  console.log(png);
}
fs.writeFileSync(path.join(OUT, "the-reef-mark.svg"), mark(CYAN));
