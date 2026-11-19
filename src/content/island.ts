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

// What each hidden paper plane says when found, in the order of collect_plane_01..06 in the island file.
// Facts only from the CV and PRODUCT.md; never invent one.
export const planeFacts: string[] = [
  "5th of 106 schools at SIKAPtala 2026, a national design competition.",
  "Top 12 of 48+ universities at the Batang Techno Hackathon 2026, with ResQLine.",
  "Freelancing since September 2026: a client's Shopify storefront, CryoLipo, designed in Figma and built in Liquid.",
  "Design Team Leader of OCTA's software committee, August 2024 to May 2026: the OCTA website and voting system.",
  "Gave two Figma workshops, in my second and fourth years.",
  "BS Computer Science in Intelligent Systems at LSPU, expected 2027.",
];

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
