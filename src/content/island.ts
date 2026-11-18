// Landmarks on the Playground's Studio island (docs/studio.md). Each one points at real work; keep the copy
// factual. `object` and `door` are node names in public/playground/island.glb (from art/island/island.blend).
export type LandmarkId = "studio" | "gallery" | "board" | "poster";

export type Landmark = {
  id: LandmarkId;
  object: string;
  door: string;
  label: string;
  title: string;
  body: string;
  links: { label: string; href: string }[];
};

export const islandLandmarks: Landmark[] = [
  {
    id: "studio",
    object: "lm_studio",
    door: "door_studio",
    label: "Café",
    title: "Projects",
    body: "Apps and sites I designed and built, from team theses to client work.",
    links: [
      { label: "See the projects", href: "/projects" },
      { label: "AVERA", href: "/projects#avera" },
      { label: "CryoLipo", href: "/projects#cryolipo" },
    ],
  },
  {
    id: "gallery",
    object: "lm_gallery",
    door: "door_gallery",
    label: "Gallery",
    title: "Graphics",
    body: "Branding, pubmats, posters, merch and art.",
    links: [{ label: "See the graphics", href: "/graphics" }],
  },
  {
    id: "board",
    object: "lm_board",
    door: "door_board",
    label: "Notice board",
    title: "Experience",
    body: "Roles, education and certificates, the one-minute brief and my CV.",
    links: [
      { label: "Experience", href: "/experience" },
      { label: "One-minute brief", href: "/brief" },
      { label: "Download the CV", href: "/joko-comia-cv.pdf" },
    ],
  },
  {
    id: "poster",
    object: "lm_poster",
    door: "door_poster",
    label: "Poster stand",
    title: "Community",
    body: "Everyone on the page designs one poster together, one vote at a time.",
    links: [{ label: "Design a poster", href: "/community" }],
  },
];
