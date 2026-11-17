// The Brief (/brief): the one-minute version of the portfolio, ordered for who is reading.
// Facts come from the other content files (CV, experience, projects, stack, certificates).
// Only `services` and `process` are written here: Joko, edit them to match what you offer.
// Never add prices, clients, testimonials or numbers that aren't real.

export const AUDIENCES = [
  { id: "recruiter", label: "Recruiter", lead: "Availability, education and experience first." },
  { id: "manager", label: "Hiring manager", lead: "The work first: what I made, my part in it, and how I build." },
  { id: "client", label: "Client", lead: "Freelance work: what I can make for you, the proof, and how we'd start." },
] as const;

export type AudienceId = (typeof AUDIENCES)[number]["id"];

export type SectionId = "availability" | "services" | "work" | "craft" | "process" | "experience" | "recognition" | "education" | "skills" | "certificates";

/** What each reader sees, in order. Everything not listed stays off their view. */
export const ORDER: Record<AudienceId, SectionId[]> = {
  recruiter: ["availability", "education", "experience", "recognition", "skills", "certificates", "work"],
  manager: ["work", "craft", "skills", "experience", "recognition", "education", "certificates"],
  client: ["services", "work", "process", "skills", "availability"],
};

/** Projects shown in each view's Work section (slugs from projects.ts). */
export const WORK: Record<AudienceId, string[]> = {
  recruiter: ["avera", "cryolipo", "resqline"],
  manager: ["avera", "cryolipo", "octa-voting", "resqline", "slip"],
  client: ["cryolipo", "slip", "octa-voting"],
};

/** Freelance: what Joko can make, each backed by real work. Edit freely. */
export const services = [
  {
    title: "Interface and UX design",
    detail: "Screens, user flows and clickable prototypes in Figma, ready to build.",
    proof: { label: "OCTA Voting", href: "/projects#octa-voting" },
  },
  {
    title: "Websites and web apps",
    detail: "Designed and built in Next.js, React and TypeScript, fast and easy to keep up.",
    proof: { label: "Slip", href: "/projects#slip" },
  },
  {
    title: "Shopify storefronts",
    detail: "A store designed in Figma and built as reusable Liquid theme sections.",
    proof: { label: "CryoLipo", href: "/projects#cryolipo" },
  },
  {
    title: "Graphic design",
    detail: "Brand marks, pubmats, posters and print.",
    proof: { label: "Graphics", href: "/graphics" },
  },
];

/** Freelance: how a project starts. Edit to match how you like to work. */
export const process = [
  { title: "Tell me about it", detail: "A short email: what you need, who it's for, and when." },
  { title: "Agree the scope", detail: "We settle what's in, the timeline and the price before any work starts." },
  { title: "Design, then review", detail: "Screens in Figma first, so changes are cheap." },
  { title: "Build and hand over", detail: "The real thing, built and tested, with everything you need to run it." },
];

/** Hiring managers: how Joko works, in a few plain lines. */
export const craft = [
  "I design in Figma and build what I design in React, Next.js and TypeScript, so nothing gets lost between the mockup and the code.",
  "I care about structure as much as looks: reusable components, typed data, row-level security on the back end.",
  "This site is the proof: Next.js 16 and Supabase, designed and built by me, scoring 97 to 100 for performance on desktop in Lighthouse and 100 for accessibility.",
];
