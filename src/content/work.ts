// The Overview's work index: every project, plus the other two places work lives.
// Drawn previews use these tones until real screenshots exist (set `image` to a /public path).
import { projects } from "./projects";

export type WorkTone = "ink" | "overview" | "projects" | "graphics" | "playground" | "surface";

export type WorkItem = {
  id: string;
  title: string;
  /** What kind of work, shown beside the name. */
  kind: string;
  /** One line under the name in the preview. */
  summary: string;
  href: string;
  external: boolean;
  tone: WorkTone;
  image?: string;
  /** Shown instead of `image` in the dark theme. */
  imageDark?: string;
};

const tones: Record<string, WorkTone> = { avera: "ink", cryolipo: "projects", resqline: "overview", statera: "surface", workhive: "playground" };

// Mockup thumbnails, 1920 × 1080 WebP. A project missing here falls back to its drawn title card.
// When a thumbnail changes, bump STILL_VERSION and re-export: a new file name means no browser or CDN
// can keep serving the old picture.
const STILL_VERSION = "v2";
const withStill = projects.map((p) => p.slug);
const images: Record<string, Pick<WorkItem, "image" | "imageDark">> = Object.fromEntries(
  withStill.map((slug) => [slug, { image: `/projects/${slug}-${STILL_VERSION}.webp` }])
);

export const work: WorkItem[] = [
  ...projects.map((p) => {
    const link = p.links[0]?.href;
    return {
      id: p.slug,
      title: p.title,
      kind: [p.kind, ...p.stack.slice(0, 1)].join(", "),
      summary: p.summary,
      href: link || `/projects#${p.slug}`,
      external: Boolean(link),
      tone: tones[p.slug] ?? "surface",
      ...images[p.slug],
    };
  }),
  {
    id: "graphics",
    title: "Graphics",
    kind: "Pubmats and posters",
    summary: "Graphic design work: pubmats and other print and social pieces.",
    href: "/graphics",
    external: false,
    tone: "graphics",
  },
  {
    id: "playground",
    title: "Playground",
    kind: "3D in the browser",
    summary: "A 3D desk of my tools. Pick something up.",
    href: "/playground",
    external: false,
    tone: "playground",
  },
];
