# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** OJT (on-the-job training) supervisors and hiring managers deciding whether to take Joko on for a UI/UX design or design-engineering placement. Limited time: they skim the overview, open one or two highlighted projects, and decide whether to reach out.
- **Secondary:** peers and general visitors who come for the Playground and the Community page.

## Product Purpose

Personal portfolio for Joko Ymmanuel Comia (GitHub: itsJoko). Its job right now is to win an OJT placement in UI/UX design, front-end or software development, or context engineering.

Success: within about 30 seconds a reviewer understands that Joko is a designer who builds, opens a highlighted project, and knows how to contact him.

## Positioning

UI/UX designer and Frontend developer: creates striking visual design, reads code, and cares about code structure. One-line message: **a designer who builds what he designs.**

Personality: composed and minimalist on the outside, playful and creative on the inside.

## Operating Context

- Structured as a dashboard with a persistent sidebar. Groups: **Work** (Overview, the default landing with a short about and contact; Projects; Graphics), **Profile** (Experience, Stack, Certificates, Writing) and **Play** (Playground; Community).
- Everything Joko has made is shown somewhere (projects, graphic design, certificates), but the Overview highlights a curated few.
- Visitors arrive on desktop and phone; sidebar navigation is used repeatedly in one visit.
- Deployed on Vercel, linked to the GitHub repo.

## Capabilities and Constraints

- **Projects (13):** AVERA, CryoLipo, OCTA Website, OCTA Voting, ResQLine, Slip, Lotline, Sona, Nimbus, Statera, WorkHive, FigManual, L.E.A.R.N. Each opens a detail sheet on the Projects page (role, result, stack, link). **AVERA and CryoLipo are highlighted.**
- **Overview's Selected work:** a curated six: AVERA, CryoLipo, OCTA Voting, ResQLine, Slip, Lotline. Everything else stays on Projects.
- **Links:** Slip (slip-studio.vercel.app), ResQLine admin and L.E.A.R.N. on GitHub. **No link yet** for AVERA (repo private) or CryoLipo (store in handover); Lotline is private by design.
- **Project media:** mockup thumbnails now; a short video per project later (a muted loop on the card under the pointer, the full video in the sheet). No embedded interactive demos.
- **Graphics:** 163 pieces in 13 collections (branding, pubmats, posters, print and merch, infographics, art), each with a composed cover. Joko will supply his own redesigns of The Reef marks and the STRASUC awardee set; AI-generated mockups and work that isn't his stay out.
- **Certificates:** Credly badges load live from `joko-comia`; TOPCIT Level 3 and AWS are added by hand.
- **Writing:** posts mirrored from LinkedIn (SIKAPtala 2026, Batang Techno), with pictures.
- **Playground:** interactive pieces for visitors, 3D and small games (neal.fun-like). 3D appears only here and in the Folio mascot. The main piece is the **Studio island** (`docs/studio.md`): an island to walk around with other visitors, where Joko's work sits in its buildings and every fact is a real one.
- **Community:** "Design by committee": everyone online votes every few seconds on the next design decision for one shared poster; finished posters are archived. Talk is live emoji reactions and preset quick phrases only (no free text). Nickname plus a Cloudflare Turnstile bot check. Supabase backend (Postgres, Realtime presence, row-level security, Edge Functions). A live "N designing now" teaser on the Overview.
- **Later:** "Walk the studio", a multiplayer 2D studio with Folio-style avatars, reusing the Community backend.
- **First visit:** one intro moment, skippable, shown once per session. No other loading screens.
- **Launch:** from the `redesign` branch to `main` on Vercel, after the build and motion checks.

## Brand Commitments

- Name: Joko (Joko Comia). Repo: Joko-Portfolio. Brand: the JC fold mark, black and white with one electric blue, and diagonal fold cuts (from Joko's brand identity sheet).
- References Joko chose: bryllim.com, neal.fun, jesperlandberg.com, satriabahari.my.id/en.
- Portfolio principles Joko set: prioritized content, clean design, strategic project selection, transformation-driven, shows focus, tries to explain, leads with outcomes, visuals as a story.

## Evidence on Hand

- **AVERA:** Android app for handwritten signature verification (Siamese neural networks with explainable AI); team thesis at LSPU, in progress since April 2026. Joko: UI/UX designer and front-end developer (admin and analyst flows in Figma, the React Native interface).
- **CryoLipo:** the freelance client Shopify storefront from the CV (Sep 2026–present): Joko designed it in Figma and builds it as reusable Liquid theme sections with a development partner.
- **ResQLine:** a course final project later taken to the Batang Techno Hackathon (April 2026, Top 12 of 48+ universities): AI disaster classifier, mobile reporting app and live dispatcher map. Joko was web developer and UI/UX designer: redesigned the Next.js admin dashboard and built its responder and reports panels, map interactions and tests.
- **OCTA (student organization, Aug 2024–May 2026):** Joko was Design Team Leader of the Software Development and Applications Committee. He designed most of the UI/UX for the OCTA Website (launched; domain currently lapsed) and OCTA Voting (launched, used for officer elections), divided and mentored the design work, presented to the SDA Director, Dean and Adviser, and created the AWS Learning Club identity at the Director's request.
- **Slip:** solo project, a browser batch design tool (Next.js, TypeScript, pdf-lib). **Lotline:** solo project, a private HOA dues ledger (Next.js, Supabase, row-level security, phased PRs).
- **Sona and Nimbus:** team projects (a music discovery web app; a desktop music player); Joko was the UI/UX designer and one of two front-end developers.
- **WorkHive:** team coursework, a C# WinForms (Bunifu UI) project management app. **Statera:** team project, a React Native app on students' digital habits. Joko is the designer on every team project.
- **FigManual:** a UI/UX learning website concept made for Joko's Figma workshop. **L.E.A.R.N.:** Java desktop learning system (public on GitHub).
- **CV (source of truth for facts):** the Harvard-format CV (`public/joko-comia-cv.pdf`): freelance Shopify storefront (Sep 2026–present), LSPU BS Computer Science in Intelligent Systems (expected 2027), two Figma workshop talks (2nd and 4th year), OCTA design team leader, class president, SIKAPtala 2026 (5th of 106 schools), Batang Techno (Top 12), 13 certifications.
- **No testimonials or client quotes on hand.** The only results to state are the ones in the CV. Do not fabricate any.

## Product Principles

1. Lead with outcomes and clarity — a reviewer should never have to hunt for what Joko did.
2. Curate the front, keep the rest available — highlight a few, show everything elsewhere.
3. Composed shell, creative core — navigation and reading stay restrained; play is concentrated in the Playground and the Community page.
4. The site itself is the proof of "designer who builds" — its craft must hold up to inspection.

## Accessibility & Inclusion

- Respect `prefers-reduced-motion`: Playground falls back to a static poster with fades; other motion becomes gentler, not removed; project videos show their poster.
- Hover effects only on hover-capable pointers; everything works on touch.
- Full keyboard navigation with visible focus.
