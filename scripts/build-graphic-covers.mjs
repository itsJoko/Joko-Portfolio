// Composes a cover for each Graphics collection from its real pieces and renders it with headless Edge.
// usage: node scripts/build-graphic-covers.mjs "<path to Portfolio-Needs/Graphics>"
// Output: public/graphics/<slug>/cover.webp (build-graphics.mjs uses it as the collection's cover).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const SRC = process.argv[2];
const EDGE = process.env.EDGE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
if (!SRC || !fs.existsSync(SRC)) {
  console.error("Pass the Graphics source folder.");
  process.exit(1);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "covers-"));
const url = (f) => {
  const [drive, ...rest] = path.resolve(SRC, f).split(path.sep).join("/").split("/");
  return `file:///${drive}/${rest.map(encodeURIComponent).join("/")}`;
};
const FOLD = "#1d4ed8"; // the brand blue (Overview hue)

// w: share of the canvas width; x/y: centre in %; r: degrees.
// Slot y is shifted down 12% when drawn, centring the pieces now that covers carry no title
// (the title sits under each cover on the page).
const SLOTS = {
  scatter4: [
    { x: 29, y: 22, w: 38, r: -8 },
    { x: 71, y: 20, w: 36, r: 7 },
    { x: 30, y: 50, w: 36, r: 6 },
    { x: 70, y: 48, w: 38, r: -5 },
  ],
  fan3: [
    { x: 28, y: 34, w: 36, r: -10 },
    { x: 72, y: 34, w: 36, r: 10 },
    { x: 50, y: 38, w: 42, r: 0 },
  ],
  hero2: [
    { x: 32, y: 32, w: 46, r: -6 },
    { x: 68, y: 40, w: 46, r: 5 },
  ],
  stickers5: [
    { x: 25, y: 16, w: 32, r: -12 },
    { x: 75, y: 15, w: 28, r: 10 },
    { x: 50, y: 36, w: 42, r: -3 },
    { x: 22, y: 52, w: 28, r: 8 },
    { x: 78, y: 50, w: 30, r: -9 },
  ],
  stack3: [
    { x: 50, y: 20, w: 70, r: -4 },
    { x: 50, y: 36, w: 70, r: 3 },
    { x: 50, y: 52, w: 70, r: -2 },
  ],
};

const COVERS = [
  { slug: "aws-learning-club", title: "AWS Learning Club", ratio: 4 / 5, bg: "#ff9b21", ink: "#1a1205", layout: "stickers5", pieces: ["AWS LEARNING CLUB/STICKERS/1.png", "AWS LEARNING CLUB/BADGES/2.png", "AWS LEARNING CLUB/Logo.png", "AWS LEARNING CLUB/STICKERS/7.png", "AWS LEARNING CLUB/STICKERS/12.png"], plain: true },
  { slug: "the-reef", title: "The Reef", ratio: 1, bg: "#0b2a4a", ink: "#ffffff", layout: "stack3", pieces: ["The Reef/The Reef signature identity-3.png", "The Reef/The Reef color and typography-2.png", "The Reef/The Reef identity in use-6.png"] },
  { slug: "octa-logos", title: "OCTA committee logos", ratio: 1, bg: "#151515", ink: "#ffffff", layout: "scatter4", pieces: ["Logo/OCTA Committees Logo/LOGO Designs/Committee on Software Development.png", "Logo/OCTA Committees Logo/LOGO Designs/Graphic Design Committee.png", "Logo/OCTA Committees Logo/LOGO Designs/Photography Committee.png", "Logo/OCTA Committees Logo/LOGO Designs/Sports Committee.png"] },
  { slug: "app-logos", title: "App logos", ratio: 1, bg: "#f2f0ea", ink: "#111111", layout: "hero2", pieces: ["Logo/Sona Logo.png", "Logo/logo.jpg"] },
  { slug: "codyssey", title: "Codyssey", ratio: 4 / 5, bg: "#140f33", ink: "#ffffff", layout: "scatter4", pieces: ["Pubmats/Codyssey/Codyssey_1.png", "Pubmats/Codyssey/Pixel Art Leaderboard_ First Place.png", "Pubmats/Codyssey/Variant2.png", "Pubmats/Codyssey/Codyssey_3.jpg"] },
  { slug: "strasuc-2025", title: "STRASUC 2025 awardees", ratio: 4 / 5, bg: "#f4c20d", ink: "#111111", layout: "scatter4", pieces: ["Pubmats/STRASUC 2025 PUBMAT.png", "Pubmats/STRASUC AWARDEES PUBMAT/3.png", "Pubmats/STRASUC AWARDEES PUBMAT/12.png", "Pubmats/STRASUC AWARDEES PUBMAT/27.png"] },
  { slug: "teachers-day", title: "Teacher's Day", ratio: 3 / 4, bg: "#24513a", ink: "#ffffff", layout: "fan3", pieces: ["Pubmats/Teacher's Day Pubmat/2.png", "Pubmats/Teacher's Day Pubmat/5.png", "Pubmats/Teacher's Day Pubmat/1.png"] },
  { slug: "invitations", title: "Invitation posts", ratio: 1, bg: "#efe6d8", ink: "#111111", layout: "fan3", pieces: ["Pubmats/Invitation Post/2.png", "Pubmats/Invitation Post/3.png", "Pubmats/Invitation Post/1.png"] },
  { slug: "campus-pubmats", title: "Campus pubmats", ratio: 4 / 5, bg: "#b01632", ink: "#ffffff", layout: "scatter4", pieces: ["Pubmats/Website Launch.jpg", "Pubmats/Election Launch (1).jpg", "Pubmats/SCUAA PUBMAT.png", "Pubmats/KA-PIYU.png"] },
  { slug: "dial", title: "DIAL", ratio: 3 / 4, bg: "#0b0b0b", ink: "#ffffff", layout: "fan3", pieces: ["DIAL Movie Poster/3.png", "DIAL Movie Poster/5.png", "DIAL Movie Poster/2.png"] },
  { slug: "ka-piyu-merch", title: "Jersey and ID lace", ratio: 1, bg: "#e9eefb", ink: "#111111", layout: "hero2", pieces: ["Shirts/LSPU Jersey D1.png", "Shirts/LSPU Jersey D2.png"] },
  { slug: "memory-infographics", title: "Semiconductor memory", ratio: 4 / 5, bg: "#fff2dc", ink: "#111111", layout: "fan3", scale: 0.55, pieces: ["Infographics/ROM Infographics.jpg", "Infographics/EPROM and EEPROM Infographics.jpg", "Infographics/Infograph Semiconductor Memory Types.png"] },
  { slug: "paintings", title: "Painting activities", ratio: 4 / 5, bg: "#f4eee4", ink: "#111111", layout: "scatter4", pieces: ["Colored-Drawing/Activity 1 - Poster Painting.jpg", "Colored-Drawing/Activity 2 Acrylic Painting.jpg", "Colored-Drawing/Activity 4 -Pointilism.jpg", "Colored-Drawing/Activity 5 - Abstract.jpg"] },
];

const W = 1200;
const html = (c) => {
  const H = Math.round(W / c.ratio);
  const slots = SLOTS[c.layout];
  const pieces = c.pieces
    .map((p, i) => {
      const s = slots[i];
      return `<img src="${url(p)}" style="left:${s.x}%;top:${s.y + 12}%;width:${s.w * (c.scale ?? 1)}%;transform:translate(-50%,-50%) rotate(${s.r}deg)" class="${c.plain ? "plain" : ""}">`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@600&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;overflow:hidden}
.c{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${c.bg};color:${c.ink};font-family:'Funnel Display',sans-serif}
img{position:absolute;display:block;border-radius:18px;box-shadow:0 30px 60px rgba(0,0,0,.32),0 6px 14px rgba(0,0,0,.18)}
img.plain{border-radius:0;box-shadow:none;filter:drop-shadow(0 24px 30px rgba(0,0,0,.28))}
.fold{position:absolute;right:0;bottom:0;width:34%;height:${Math.round(W * 0.34)}px;background:${FOLD};clip-path:polygon(100% 0,100% 100%,0 100%)}
.fold2{position:absolute;right:0;bottom:0;width:20%;height:${Math.round(W * 0.2)}px;background:#0b0b0b;clip-path:polygon(100% 0,100% 100%,0 100%)}
h1{position:absolute;left:64px;bottom:56px;margin:0;font-weight:600;font-size:${c.title.length > 16 ? 92 : 120}px;line-height:.92;letter-spacing:-0.045em;max-width:62%}
.mark{position:absolute;left:64px;top:56px;width:88px;height:auto}
</style></head><body><div class="c">${pieces}<div class="fold"></div><div class="fold2"></div></div></body></html>`;
};

for (const c of COVERS) {
  const H = Math.round(W / c.ratio);
  const file = path.join(TMP, `${c.slug}.html`);
  const png = path.join(TMP, `${c.slug}.png`);
  fs.writeFileSync(file, html(c));
  execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", `--window-size=${W},${H}`, "--virtual-time-budget=6000", `--user-data-dir=${path.join(TMP, "profile")}`, `--screenshot=${png}`, "file:///" + file.replace(/\\/g, "/")], { stdio: "ignore" });
  const out = path.join("public/graphics", c.slug, "cover.webp");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(png).webp({ quality: 82 }).toFile(out);
  fs.copyFileSync(png, path.join(TMP, `${c.slug}-keep.png`));
  console.log(`${c.slug}: ${W}x${H}`);
}
console.log("previews in", TMP);
