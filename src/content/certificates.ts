// Credly badges are added automatically (see src/lib/credly.ts and `credly` in site.ts).
// Add certificates here only when they aren't on Credly. `date` (YYYY-MM-DD) sorts them among the badges.
export type Certificate = {
  title: string;
  issuer: string;
  year: string;
  href: string;
  date?: string;
  /** Badge or certificate image, shown beside the title. */
  image?: string;
};

// Not on Credly. Each has its certificate in public/certificates; `href` opens it.
const img = (file: string) => `/certificates/${file}`;

export const certificates: Certificate[] = [
  {
    title: "TOPCIT, Level 3",
    issuer: "IITP Korea",
    year: "2026",
    date: "2026-07-23",
    href: img("topcit-level-3.jpg"),
    image: img("topcit-level-3.jpg"),
  },
  {
    title: "Planning a Machine Learning Project",
    issuer: "AWS Training & Certification",
    year: "2025",
    date: "2025-08-30",
    href: img("aws-planning-ml-project.jpg"),
    image: img("aws-planning-ml-project.jpg"),
  },
];

/** Hand-added certificates with real details; placeholders never reach the page. */
export const realCertificates = certificates.filter((c) => !c.title.startsWith("["));

// ---- Grouping for the Certificates page ----

export const CERT_FIELDS = ["Design & product", "Development", "AI, data & cloud", "Other"] as const;
export type CertField = (typeof CERT_FIELDS)[number];

/**
 * The field a certificate belongs to, from its title. Credly badges arrive on their own, so this
 * sorts new ones too; anything unmatched lands in "Other".
 */
export function certField(title: string): CertField {
  const t = title.toLowerCase();
  if (/\b(ux|ui|user experience|design|figma|project management|agile|scrum|product)\b/.test(t)) return "Design & product";
  if (/\b(ai|artificial intelligence|machine learning|data|cloud|aws|azure)\b/.test(t)) return "AI, data & cloud";
  if (/(javascript|typescript|python|\bjava\b|c\+\+|programming|software|\bweb\b|topcit|operating system|network|linux|developer)/.test(t)) return "Development";
  return "Other";
}

/** Shown first, larger: the ones that matter most for UI/UX and front-end work. Matched by title. */
export const FEATURED_CERTS = ["TOPCIT, Level 3", "IT Specialist - Artificial Intelligence", "User Experience Design Fundamentals"];
