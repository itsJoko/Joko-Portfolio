// Turns the Graphics source folder into web-ready WebP files and src/content/graphics.data.ts.
// usage: node scripts/build-graphics.mjs "<path to Portfolio-Needs/Graphics>"  (run build-graphic-covers.mjs first for composed covers)
// Edit COLLECTIONS to add, remove or reorder work; re-run to regenerate. Output: public/graphics/<slug>/NN.webp.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error("Pass the Graphics source folder.");
  process.exit(1);
}
const OUT_DIR = "public/graphics";
const MAX_EDGE = 1600;

const files = (dir, names) => (names ?? fs.readdirSync(path.join(SRC, dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))).map((f) => path.join(dir, f));

// `cols` is how many across a section shows in the viewer: 1 = stacked full width.
const COLLECTIONS = [
  {
    slug: "aws-learning-club",
    title: "AWS Learning Club",
    category: "Branding",
    summary: "The brand identity for the campus AWS Learning Club, made at the SDA Director's request: logo, badges, stickers and banners.",
    cover: "AWS LEARNING CLUB/Logo.png",
    sections: [
      { label: "Logo", cols: 2, files: ["AWS LEARNING CLUB/Logo.png", ...files("AWS LEARNING CLUB/LOGOS")] },
      { label: "Banners", cols: 1, files: ["AWS LEARNING CLUB/Banner 1.png", "AWS LEARNING CLUB/Banner 2.png"] },
      { label: "Badges", cols: 4, files: files("AWS LEARNING CLUB/BADGES") },
      { label: "Stickers", cols: 4, files: files("AWS LEARNING CLUB/STICKERS") },
    ],
  },
  {
    slug: "the-reef",
    title: "The Reef",
    category: "Branding",
    summary: "An identity system for The Reef: the mark and wordmark, colour and type, graphic language, the mascot, and the system in use.",
    cover: "The Reef/The Reef signature identity-3.png",
    sections: [
      {
        label: "Identity",
        cols: 1,
        files: [
          "The Reef/Independent minds, one connected identity-1.png",
          "The Reef/The Reef color and typography-2.png",
          "The Reef/The Reef signature identity-3.png",
          "The Reef/The Reef graphic language-4.png",
          "The Reef/A friendly face for The Reef-5.png",
          "The Reef/The Reef identity in use-6.png",
          "The Reef/The Reef signature system-7.png",
        ],
      },
      { label: "Marks and covers", cols: 2, files: ["The Reef/Primary.png", "The Reef/Logo.png", "The Reef/HorizontalWordmark.png", "The Reef/banner.png", "The Reef/fbcover.png"] },
    ],
  },
  {
    slug: "octa-logos",
    title: "OCTA committee logos",
    category: "Branding",
    summary: "A logo for each of OCTA's fifteen committees, plus the Software Development and Applications Committee and its teams.",
    cover: "Logo/OCTA Committees Logo/LOGO Designs/Committee on Software Development.png",
    sections: [
      { label: "Committees", cols: 3, files: files("Logo/OCTA Committees Logo/LOGO Designs") },
      {
        label: "SDA and its teams",
        cols: 4,
        files: ["Logo/SDA Logo.png", "Logo/Team Leaders Logo.png", "Logo/Design Team Logo.png", "Logo/Frontend Team Logo.png", "Logo/Backend Team Logo.png", "Logo/Database Team Logo.png", "Logo/Mobile Dev Team Logo.png"],
      },
    ],
  },
  {
    slug: "app-logos",
    title: "App logos",
    category: "Branding",
    summary: "Logos for two team projects: Sona, the music-discovery app, and WorkHive, the team productivity app.",
    cover: "Logo/Sona Logo.png",
    sections: [{ cols: 2, files: ["Logo/Sona Logo.png", "Logo/logo.jpg"] }],
  },
  {
    slug: "codyssey",
    title: "Codyssey",
    category: "Pubmats",
    summary: "Pubmats, banners and a pixel-art leaderboard for Codyssey, a coding event.",
    cover: "Pubmats/Codyssey/Codyssey_1.png",
    sections: [{ cols: 2, files: files("Pubmats/Codyssey") }],
  },
  {
    slug: "strasuc-2025",
    title: "STRASUC 2025 awardees",
    category: "Pubmats",
    summary: "The STRASUC Olympics 2025 pubmat and a series of forty awardee pubmats for the Ka-Piyu champions.",
    cover: "Pubmats/STRASUC 2025 PUBMAT.png",
    sections: [
      { cols: 1, files: ["Pubmats/STRASUC 2025 PUBMAT.png"] },
      { label: "Awardees", cols: 3, files: files("Pubmats/STRASUC AWARDEES PUBMAT") },
    ],
  },
  {
    slug: "teachers-day",
    title: "Teacher's Day",
    category: "Pubmats",
    summary: "A Teacher's Day pubmat series.",
    cover: "Pubmats/Teacher's Day Pubmat/1.png",
    sections: [{ cols: 3, files: files("Pubmats/Teacher's Day Pubmat") }],
  },
  {
    slug: "invitations",
    title: "Invitation posts",
    category: "Pubmats",
    summary: "A set of four invitation posts.",
    cover: "Pubmats/Invitation Post/1.png",
    sections: [{ cols: 2, files: files("Pubmats/Invitation Post") }],
  },
  {
    slug: "campus-pubmats",
    title: "Campus pubmats",
    category: "Pubmats",
    summary: "Pubmats for campus events and announcements: launches, elections, sports, outreach and a donation drive.",
    cover: "Pubmats/Website Launch.jpg",
    sections: [
      {
        cols: 2,
        files: [
          "Pubmats/Website Launch.jpg",
          "Pubmats/Election Launch (1).jpg",
          "Pubmats/Election Launch (2).jpg",
          "Pubmats/Representative Pubmat.png",
          "Pubmats/1.jpg",
          "Pubmats/SCUAA PUBMAT.png",
          "Pubmats/KA-PIYU.png",
          "Pubmats/Kapiyu Open Donation Poster.png",
          "Pubmats/Climate Change Poster.png",
          "DP-Blast/DP Blast FUNRUN Frame.png",
        ],
      },
      { label: "Outreach tarpaulin", cols: 1, files: ["Pubmats/OUTREACH PROGRAM TARP.png"] },
    ],
  },
  {
    slug: "dial",
    title: "DIAL",
    category: "Posters",
    summary: "A movie poster series for DIAL, “It Started With a Number”.",
    cover: "DIAL Movie Poster/2.png",
    sections: [{ cols: 2, files: files("DIAL Movie Poster") }],
  },
  {
    slug: "ka-piyu-merch",
    title: "Jersey and ID lace",
    category: "Print & merch",
    summary: "Two jersey designs for the Ka-Piyu Sports Club and a College of Computer Studies ID lace.",
    cover: "Shirts/LSPU Jersey D1.png",
    sections: [
      { label: "Jersey", cols: 1, files: ["Shirts/LSPU Jersey D1.png", "Shirts/LSPU Jersey D2.png"] },
      { label: "ID lace", cols: 2, files: ["ID-Lace/ID-Lace.png"] },
    ],
  },
  {
    slug: "memory-infographics",
    title: "Semiconductor memory",
    category: "Infographics",
    summary: "Three infographics on semiconductor memory: the memory types, ROM and mask ROM, and EPROM and EEPROM.",
    cover: "Infographics/Infograph Semiconductor Memory Types.png",
    sections: [{ cols: 3, files: ["Infographics/Infograph Semiconductor Memory Types.png", "Infographics/ROM Infographics.jpg", "Infographics/EPROM and EEPROM Infographics.jpg"] }],
  },
  {
    slug: "paintings",
    title: "Painting activities",
    category: "Art",
    summary: "Five paintings: poster painting, acrylic, minimalism, pointillism and abstract.",
    cover: "Colored-Drawing/Activity 2 Acrylic Painting.jpg",
    sections: [{ cols: 2, files: files("Colored-Drawing") }],
  },
];

const titleFrom = (file) =>
  path
    .basename(file, path.extname(file))
    .replace(/[_-]+/g, " ")
    .replace(/\s+\d+$/, (m) => m)
    .trim();

const data = [];
for (const c of COLLECTIONS) {
  const dir = path.join(OUT_DIR, c.slug);
  fs.mkdirSync(dir, { recursive: true });
  const done = new Map();
  let n = 0;
  const convert = async (file) => {
    if (done.has(file)) return done.get(file);
    n += 1;
    const name = `${String(n).padStart(2, "0")}.webp`;
    const info = await sharp(path.join(SRC, file))
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(dir, name));
    const img = { src: `/graphics/${c.slug}/${name}`, width: info.width, height: info.height, alt: `${c.title}: ${titleFrom(file)}` };
    done.set(file, img);
    return img;
  };
  let cover = await convert(c.cover);
  const sections = [];
  for (const s of c.sections) sections.push({ label: s.label, cols: s.cols, images: await Promise.all(s.files.map(convert)) });
  // A composed cover from build-graphic-covers.mjs wins over the first piece.
  const composed = path.join(dir, "cover.webp");
  if (fs.existsSync(composed)) {
    const m = await sharp(composed).metadata();
    cover = { src: `/graphics/${c.slug}/cover.webp`, width: m.width, height: m.height, alt: `${c.title}: cover` };
  }
  const count = new Set(c.sections.flatMap((s) => s.files)).size;
  data.push({ slug: c.slug, title: c.title, category: c.category, summary: c.summary, count, cover, sections });
  console.log(`${c.slug}: ${count} pieces`);
}

const header = "// Generated by scripts/build-graphics.mjs. Edit COLLECTIONS there and re-run; don't edit by hand.\n";
fs.writeFileSync(
  "src/content/graphics.data.ts",
  `${header}import type { GraphicCollection } from "./graphics";\n\nexport const collections: GraphicCollection[] = ${JSON.stringify(data, null, 2)};\n`,
);
console.log("wrote src/content/graphics.data.ts");
