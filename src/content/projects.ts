// TODO: fill bracketed placeholders and empty hrefs before launch.
// Never add metrics or outcomes that didn't happen.

export type ProjectLink = { label: string; href: string };

/**
 * Optional project video. Put files in public/projects/video/ and point at them here:
 * - `loop`: 5–8 s, muted, 1280 × 720 MP4 (H.264) under ~2 MB; plays over the still on the card under
 *   the pointer and in the Overview's Selected work. Never on phones or under reduced motion.
 * - `full`: the walkthrough, 1920 × 1080 MP4; plays with controls in the project's sheet.
 * Encode commands are in DESIGN.md (Projects → Video).
 */
export type ProjectVideo = { loop?: string; full?: string };

export type Project = {
  slug: string;
  title: string;
  /** What kind of work this is, shown as the first chip. */
  kind: string;
  summary: string;
  role: string;
  result: string;
  stack: string[];
  highlight: boolean;
  media: string; // describes the placeholder until a real image is added
  links: ProjectLink[];
  video?: ProjectVideo;
};

export const projects: Project[] = [
  {
    slug: "avera",
    title: "AVERA",
    kind: "Team thesis",
    summary: "Android app that verifies handwritten signatures with Siamese neural networks and explains its decisions.",
    role: "UI/UX designer and front-end developer: admin and analyst flows in Figma, and the React Native interface",
    result: "Team thesis at LSPU San Pablo City, in progress since April 2026.",
    stack: ["React Native", "Expo", "Figma", "Machine learning"],
    highlight: true,
    media: "AVERA app screenshot (1600 × 1000)",
    // The repo is private for now; add the link back once it is public.
    links: [],
  },
  {
    slug: "cryolipo",
    title: "CryoLipo",
    kind: "Freelance Shopify storefront",
    summary: "A client's Shopify storefront, designed in Figma and built as reusable theme sections.",
    role: "UI/UX designer and front-end developer: the full interface and user flow, and the Liquid components",
    result: "In progress since September 2026, with a development partner.",
    stack: ["Figma", "Shopify", "Liquid"],
    highlight: true,
    media: "CryoLipo store screenshot (1600 × 1000)",
    links: [{ label: "Visit the store", href: "" }],
  },
  {
    slug: "octa-website",
    title: "OCTA Website",
    kind: "Student organization website",
    summary: "The website of OCTA, the computing and technology student organization of LSPU San Pablo City: news, academics, organizations and committees.",
    role: "UI/UX designer and design team leader: designed most of the screens and guided the team through reviews with the SDA Director, the Dean and the Adviser",
    result: "Built and launched as the organization's website for desktop and mobile; it is offline for now while the domain is renewed.",
    stack: ["Figma"],
    highlight: false,
    media: "OCTA website screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "octa-voting",
    title: "OCTA Voting",
    kind: "Student election system",
    summary: "An election system for student organizations: set up positions, candidates and voters, run the election, and follow the tally live.",
    role: "UI/UX designer and design team leader: the admin dashboard, the voting flow and the results screens",
    result: "Launched and in use: OCTA runs its officer elections on it.",
    stack: ["Figma"],
    highlight: false,
    media: "OCTA Voting screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "resqline",
    title: "ResQLine",
    kind: "Course project and hackathon entry",
    summary: "Emergency reporting with an AI disaster classifier, a mobile app for reports and a live dispatcher map for responders.",
    role: "Web developer and UI/UX designer: redesigned the admin dashboard and built its responder and reports panels, map interactions and tests; prepared the pitch deck and documentation with the team leader",
    result: "Built as a course final project, then taken to the Batang Techno Hackathon, where the team placed Top 12 of 48+ universities (April 2026).",
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "Mapbox", "React Native", "Figma"],
    highlight: false,
    media: "ResQLine screenshot (1600 × 1000)",
    links: [{ label: "View on GitHub", href: "https://github.com/nathsuki73/resqline-admin" }],
  },
  {
    slug: "slip",
    title: "Slip",
    kind: "Personal project, web app",
    summary: "Design one layout, then turn a number range or pasted list into up to 500 print-ready designs, such as race bibs, name badges, stickers and tickets, in one PDF.",
    role: "Designer and developer: the editor, paper sizes and borders, shapes and images, layering, undo/redo, batch data and PDF export",
    result: "Working editor with print preview, reprint selections and a spam-protected suggestions form.",
    stack: ["Next.js", "TypeScript", "pdf-lib", "GSAP"],
    highlight: false,
    media: "Slip editor screenshot (1600 × 1000)",
    links: [{ label: "Try Slip", href: "https://slip-studio.vercel.app/" }],
  },
  {
    slug: "lotline",
    title: "Lotline",
    kind: "Personal project, web app",
    summary: "A private ledger for a homeowners association: dues, water bills, payments and expenses, where every peso is traceable.",
    role: "Designer and developer: built in five phased pull requests, from Supabase auth and row-level security to features, a security test record, hardening and tests",
    result: "Corrections are signed voids with a reason, never deletions, and the database computes every total.",
    stack: ["Next.js", "TypeScript", "Supabase", "PostgreSQL"],
    highlight: false,
    media: "Lotline dashboard screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "sona",
    title: "Sona",
    kind: "Team project, web app",
    summary: "Discover music that matches your personality: a personality profile, then songs picked for that type.",
    role: "UI/UX designer, and one of two front-end developers",
    result: "Built as a team project at LSPU San Pablo City.",
    stack: ["Figma"],
    highlight: false,
    media: "Sona screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "nimbus",
    title: "Nimbus",
    kind: "Team project, desktop app",
    summary: "A desktop music player for your own library: songs, favorites, albums, artists, playlists and a queue.",
    role: "UI/UX designer, and one of two front-end developers",
    result: "Built as a team project at LSPU San Pablo City.",
    stack: ["Figma"],
    highlight: false,
    media: "Nimbus screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "statera",
    title: "Statera",
    kind: "Team project, mobile app",
    summary: "A mobile app that helps students understand their digital habits and find balance.",
    role: "UI/UX designer and front-end developer",
    result: "Built as a team project at LSPU San Pablo City.",
    stack: ["React Native", "Expo", "Figma"],
    highlight: false,
    media: "Statera screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "workhive",
    title: "WorkHive",
    kind: "Team project, desktop app",
    summary: "A project management app for teams, individuals and business owners: assign tasks, track progress and talk in one place.",
    role: "UI/UX designer and front-end developer",
    result: "Built as a team coursework project at LSPU San Pablo City.",
    stack: ["C#", "WinForms", "Bunifu UI", "Figma"],
    highlight: false,
    media: "WorkHive screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "figmanual",
    title: "FigManual",
    kind: "Workshop UI/UX concept",
    summary: "A concept website that teaches UI/UX design in Figma with step-by-step guides.",
    role: "UI/UX designer, and the guest speaker who taught with it",
    result: "Made for my Figma workshop for 1st- to 3rd-year students at LSPU San Pablo City.",
    stack: ["Figma"],
    highlight: false,
    media: "FigManual screenshot (1600 × 1000)",
    links: [],
  },
  {
    slug: "learn",
    title: "L.E.A.R.N.",
    kind: "Desktop app",
    summary: "An interactive learning system built in Java, with role-based access, quizzes, a chatbot and data visualization.",
    role: "Developer: the desktop interface, role-based flows and the app's structure",
    result: "Public on GitHub.",
    stack: ["Java"],
    highlight: false,
    media: "L.E.A.R.N. screenshot (1600 × 1000)",
    links: [{ label: "View on GitHub", href: "https://github.com/itsJoko/L.E.A.R.N.-An-Interactive-Java-Based-Learning-System" }],
  },
];

export const highlightedProjects = projects.filter((p) => p.highlight);
