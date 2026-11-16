// From Joko's CV. Only tools Joko actually uses; `level` only where the CV states one.
// `featured` tools make the Overview's one-line summary; the Stack page shows them all.
export type StackItem = { name: string; level?: "Advanced" | "Basic"; featured?: boolean };
export type StackGroup = { id: string; label: string; items: StackItem[] };

export const stack: StackGroup[] = [
  {
    id: "design",
    label: "Design",
    items: [
      { name: "Figma", level: "Advanced", featured: true },
      { name: "Canva", level: "Advanced", featured: true },
      { name: "Prototyping" },
      { name: "Illustrator", level: "Basic" },
      { name: "Photoshop", level: "Basic" },
    ],
  },
  {
    id: "frontend",
    label: "Front-end",
    items: [
      { name: "TypeScript", featured: true },
      { name: "JavaScript" },
      { name: "React", featured: true },
      { name: "Next.js", featured: true },
      { name: "React Native", featured: true },
      { name: "Tailwind CSS" },
      { name: "HTML" },
      { name: "CSS" },
      { name: "GSAP" },
      { name: "Three.js" },
      { name: "Shopify Liquid" },
    ],
  },
  {
    id: "backend",
    label: "Back end and data",
    items: [{ name: "Supabase", featured: true }, { name: "PostgreSQL" }, { name: "Authentication" }, { name: "Row-level security" }],
  },
  {
    id: "tools",
    label: "Code and tools",
    items: [{ name: "Git and GitHub" }, { name: "Vitest" }, { name: "Java" }, { name: "C#" }, { name: "C++" }, { name: "Agent context files (CLAUDE.md, AGENTS.md)" }],
  },
];

export const interests = ["User interface design", "E-commerce websites", "Educational technology", "Photography"];
