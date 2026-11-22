// The Overview's work index and the stills every project uses, built from projects.ts.
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
  /** A short muted loop, played over the still where motion is welcome (see Project.video). */
  loop?: string;
};

const tones: Record<string, WorkTone> = { avera: "ink", cryolipo: "projects", resqline: "overview", statera: "surface", workhive: "playground" };

// Mockup thumbnails, 1920 × 1080 WebP. A project missing here falls back to its drawn title card.
// When a thumbnail changes, bump STILL_VERSION and re-export: a new file name means no browser or CDN
// can keep serving the old picture.
const STILL_VERSION = "v2";
const images: Record<string, Pick<WorkItem, "image" | "imageDark">> = Object.fromEntries(
  projects.map((p) => [p.slug, { image: `/projects/${p.slug}-${STILL_VERSION}.webp` }]),
);

/** The Overview's Selected work, in this order. Everything else is on the Projects page. */
export const FEATURED = ["avera", "cryolipo", "octa-voting", "resqline", "slip", "lotline"] as const;

// Every project opens its own sheet on the Projects page; outside links live inside the sheet.
export const work: WorkItem[] = [
  ...projects.map((p) => ({
    id: p.slug,
    title: p.title,
    kind: [p.kind, ...p.stack.slice(0, 1)].join(", "),
    summary: p.summary,
    href: `/projects#${p.slug}`,
    external: false,
    tone: tones[p.slug] ?? "surface",
    loop: p.video?.loop,
    ...images[p.slug],
  })),
  {
    id: "graphics",
    title: "Graphics",
    kind: "Brand identities, pubmats and posters",
    summary: "Graphic design work: brand identities, pubmats, posters and more.",
    href: "/graphics",
    external: false,
    tone: "graphics",
  },
  {
    id: "playground",
    title: "Playground",
    kind: "3D in the browser",
    summary: "A small 3D island to walk around: my work in its buildings, others walking with you.",
    href: "/playground",
    external: false,
    tone: "playground",
  },
];

export const featuredWork: WorkItem[] = FEATURED.map((id) => work.find((w) => w.id === id)).filter((w): w is WorkItem => Boolean(w));
