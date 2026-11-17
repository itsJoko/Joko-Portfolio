import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

/**
 * Blog: one Markdown file per post in src/content/posts, named <slug>.md.
 * Files starting with "_" (like _template.md) are ignored.
 *
 * Front matter, between two `---` lines at the top:
 *   title: The post's title
 *   date: 2026-10-30
 *   summary: One line for the list
 *   linkedin: https://www.linkedin.com/posts/... (optional, where it was first posted)
 *
 * Pictures live in public/posts/<slug>/ and go in the body as:
 *   ![What the picture shows](/posts/<slug>/photo.webp "Optional caption")
 */
export type Post = { slug: string; title: string; date: string; summary: string; linkedin?: string; body: string };

const DIR = path.join(process.cwd(), "src/content/posts");

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Pictures render as figures: the alt text for screen readers, the Markdown title as a visible caption.
const markdown = new Marked({
  renderer: {
    image({ href, title, text }) {
      const caption = title ? `<figcaption>${attr(title)}</figcaption>` : "";
      return `<figure><img src="${attr(href)}" alt="${attr(text)}" loading="lazy" decoding="async" />${caption}</figure>`;
    },
  },
});

function parse(file: string): Post {
  const raw = fs.readFileSync(path.join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return {
    slug: file.replace(/\.md$/, ""),
    title: meta.title || file,
    date: meta.date || "",
    summary: meta.summary || "",
    linkedin: meta.linkedin || undefined,
    body: match?.[2] ?? raw,
  };
}

/** Newest first. */
export function getPosts(): Post[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map(parse)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

/** The post's own Markdown, written by Joko, rendered to HTML at build time. */
export function renderPost(post: Post): string {
  // A picture alone on its line arrives wrapped in <p>, where a <figure> isn't allowed.
  return markdown.parse(post.body, { async: false }).replace(/<p>(<figure>[\s\S]*?<\/figure>)<\/p>/g, "$1");
}

export type PostImage = { src: string; alt: string; caption?: string; width?: number; height?: number };

/** A WebP's pixel size from its header (public/…), so the page can reserve the space before it loads. */
function webpSize(src: string): { width: number; height: number } | undefined {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", src));
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return undefined;
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  } catch {
    // Missing or unreadable: the picture still shows, just without reserved space.
  }
  return undefined;
}

const unattr = (value: string) => value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");

/**
 * The post split in two for the reading layout: the text (every picture taken out) and the
 * pictures in order, which sit in their own column beside the text and open large on a click.
 */
export function renderPostParts(post: Post): { html: string; images: PostImage[] } {
  const images: PostImage[] = [];
  const html = renderPost(post).replace(/<figure>([\s\S]*?)<\/figure>/g, (_, inner: string) => {
    const src = inner.match(/src="([^"]*)"/)?.[1];
    const alt = inner.match(/alt="([^"]*)"/)?.[1] ?? "";
    const caption = inner.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1];
    if (src) {
      const clean = unattr(src);
      images.push({ src: clean, alt: unattr(alt), caption: caption ? unattr(caption) : undefined, ...webpSize(clean) });
    }
    return "";
  });
  return { html, images };
}

export function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
