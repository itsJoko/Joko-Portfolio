// From Joko's CV. Newest first. Never add metrics or outcomes that didn't happen.

export type Experience = {
  role: string;
  org: string;
  /** The name alone, for the Overview. */
  short: string;
  kind: string;
  /** e.g. "Sep 2026" */
  start: string;
  /** Leave empty while it's ongoing; shown as "Present". */
  end: string;
  location: string;
  /** Outcome first: what was done and what came of it. */
  points: string[];
  skills: string[];
  href?: string;
};

export const experience: Experience[] = [
  {
    role: "UI/UX designer and front-end developer",
    org: "CryoLipo, a client's Shopify storefront",
    short: "CryoLipo",
    kind: "Freelance",
    start: "Sep 2026",
    end: "",
    location: "Remote",
    points: [
      "Designed the full interface and user flow of the storefront in Figma.",
      "Turned wireframes and high-fidelity mockups into reusable Shopify theme sections and responsive components in Liquid.",
      "Planned the site structure and visual hierarchy with a development partner.",
    ],
    skills: ["Figma", "Shopify", "Liquid"],
  },
  {
    role: "UI/UX designer and front-end developer",
    org: "AVERA capstone, LSPU San Pablo City",
    short: "AVERA",
    kind: "Team thesis",
    start: "Apr 2026",
    end: "",
    location: "San Pablo City, Laguna",
    points: [
      "Designed the admin and analyst flows in Figma: case lists and review states, filter sheets and statistics screens.",
      "Built the React Native mobile interface, including navigation, card layouts and bottom sheets.",
    ],
    skills: ["Figma", "React Native"],
  },
  {
    role: "Design team leader",
    org: "OCTA Software Development and Applications Committee, LSPU San Pablo City",
    short: "OCTA",
    kind: "Student organization",
    start: "Aug 2024",
    end: "May 2026",
    location: "San Pablo City, Laguna",
    points: [
      "Designed most of the UI/UX for the OCTA Website and the OCTA Voting system, from user flows to high-fidelity Figma screens.",
      "Split each project into design tasks, assigned them to team members, and taught them how to think and work as UI/UX designers.",
      "Presented designs to the SDA Director, the Dean and the Adviser, turned their comments into revisions, and coached members on handling that feedback.",
      "Created the brand identity for the campus AWS Learning Club at the SDA Director's request: logos, a mascot, badges, stickers and banners.",
      "Produced committee and team logos, event pubmats and social media content in Figma and Canva.",
    ],
    skills: ["Figma", "Canva", "Design leadership", "Branding"],
  },
  {
    role: "UI/UX designer and front-end developer",
    org: "Team software projects, LSPU San Pablo City",
    short: "Team software projects",
    kind: "Coursework",
    start: "Jan 2024",
    end: "",
    location: "San Pablo City, Laguna",
    points: [
      "The UI/UX designer on every team project: user flows, screens and visual systems from first sketch to handoff.",
      "Designed Sona, a personalized music-discovery app, and Nimbus, a desktop music player, then built both front ends as one of two developers.",
      "Redesigned the ResQLine admin dashboard for real-time emergency response in Next.js, TypeScript and Tailwind CSS: responder and reports panels, incident status handling, map interactions and tests.",
      "Designed and built Statera, a digital-habits app for students, and WorkHive, a team productivity interface, in HTML, CSS, JavaScript and React through GitHub pull requests.",
    ],
    skills: ["Figma", "React", "Next.js", "TypeScript", "GitHub"],
  },
];

export type Activity = { title: string; org: string; when: string; detail?: string };

export const leadership: Activity[] = [
  {
    title: "Guest speaker, Figma workshop: Figma-nificent, One Frame at a Time",
    org: "Laguna State Polytechnic University",
    when: "Sep 2026",
    detail: "Taught Figma fundamentals and core features to 1st- to 3rd-year students, in my 4th year.",
  },
  {
    title: "Guest speaker, Figma workshop: Front-First Back-Later",
    org: "Laguna State Polytechnic University",
    when: "Apr 2025",
    detail: "Taught Figma fundamentals and core features to 1st- to 3rd-year students, in my 2nd year.",
  },
  {
    title: "Class president",
    org: "Laguna State Polytechnic University",
    when: "Aug 2024 – May 2025",
  },
];

/** `short` names the event inside a sentence (the Overview preview). */
export type Competition = {
  place: string;
  field: string;
  event: string;
  short: string;
  host: string;
  when: string;
  detail: string;
};

export const competitions: Competition[] = [
  {
    place: "5th",
    field: "nationally, of 106 schools",
    event: "Design Competition, SIKAPtala 2026: The National CS & IT Competition",
    short: "SIKAPtala 2026",
    host: "CICS Student Government, De La Salle University Dasmariñas",
    when: "May 2026",
    detail: "Designed web interfaces for the theme Innovation Through Accessibility.",
  },
  {
    place: "Top 12",
    field: "finalists, of 48+ universities",
    event: "Batang Techno Hackathon, Team ALGORIZZMS",
    short: "the Batang Techno Hackathon",
    host: "CICS Student Council, Batangas State University Alangilan",
    when: "Apr 2026",
    detail:
      "My first hackathon. Built ResQLine as web developer and UI/UX designer: an AI disaster classifier and a live dispatcher map. Prepared the pitch deck and documentation with the team leader.",
  },
];

export const education = {
  school: "Laguna State Polytechnic University, San Pablo City Campus",
  degree: "BS Computer Science, Intelligent Systems",
  when: "Expected 2027",
  thesis:
    "AVERA: Assistive Android Application for Handwritten Signature Verification Using Siamese Neural Networks with Explainable AI",
  coursework: ["Web Development", "UI/UX Design", "Human-Computer Interaction", "Systems Analysis and Design"],
};
