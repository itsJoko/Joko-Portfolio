// Turns a raw screen recording into a project's web video files with ffmpeg.
// usage: node scripts/encode-project-video.mjs <slug> <recording.mp4|mov> [loopStartSeconds=0] [loopLength=6]
// Writes public/projects/video/<slug>-loop.mp4 (muted, 1280 × 720, short) and <slug>-full.mp4 (1920 × 1080),
// then add to that project in src/content/projects.ts:
//   video: { loop: "/projects/video/<slug>-loop.mp4", full: "/projects/video/<slug>-full.mp4" },
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [slug, input, start = "0", length = "6"] = process.argv.slice(2);
if (!slug || !input || !fs.existsSync(input)) {
  console.error("usage: node scripts/encode-project-video.mjs <slug> <recording> [loopStartSeconds] [loopLength]");
  process.exit(1);
}
const dir = "public/projects/video";
fs.mkdirSync(dir, { recursive: true });
const run = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

// Loop: no audio, fits 1280 × 720, H.264 at a modest quality so it stays around 1–2 MB.
run(["-ss", start, "-t", length, "-i", input, "-an", "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(dir, `${slug}-loop.mp4`)]);
// Full: keeps audio, fits 1920 × 1080, faststart so it begins playing before it finishes loading.
run(["-i", input, "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path.join(dir, `${slug}-full.mp4`)]);

for (const f of [`${slug}-loop.mp4`, `${slug}-full.mp4`]) console.log(f, `${(fs.statSync(path.join(dir, f)).size / 1048576).toFixed(1)} MB`);
console.log(`Add to "${slug}" in src/content/projects.ts:\n  video: { loop: "/projects/video/${slug}-loop.mp4", full: "/projects/video/${slug}-full.mp4" },`);
