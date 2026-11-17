# Design

Source of truth for the visual system. Product truth lives in PRODUCT.md.

## Concept

**The name as a monument; a designer who builds what he designs.**
The page performs Joko's one-line claim: things arrive first as an outline (the design), then fill solid (the build). The loader draws JOKO in outline and fills it; the hero's 3D cursor arrow turns from its blueprint edges into a glossy solid as you scroll or flip the **Design / Build** switch.
The shell stays quiet and black-and-white; colour is the reward for interaction (the cursor, the switch, the work previews).

Direction dealt by design-taste-frontend: *The name as a monument* (seed 743643700), palette kept from the brand.

## Colors

### Base (both themes)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#000000` | Page ground |
| `surface` | `#F3F3F3` | `#161616` | Sidebar, mobile bar, bands, pills |
| `card` | `#F7F7F7` | `#0E0E0E` | Second band tone, cards |
| `ink` | `#000000` | `#FFFFFF` | Text, primary fill, footer ground |
| `muted` | `#6E6E6E` | `#8E8E8E` | Secondary text, inactive work names |
| `line` | `#E2E2E2` | `#262626` | Link underlines only (no rules or outlines) |

### Section colors

| Section | Light | Dark |
|---|---|---|
| Overview | `#1D4ED8` blue | `#7B9CFF` |
| Projects | `#C2410C` orange | `#FF8A3D` |
| Graphics | `#0369A1` sky | `#4FC3F7` |
| Experience | `#6D28D9` violet | `#B69CFF` |
| Certificates | `#15803D` green | `#5EE38B` |
| Stack | `#BE123C` rose | `#FF7A93` |
| Writing | `#0F766E` teal | `#2DD4BF` |
| Playground | `#A64B00` amber | `#FFB547` |
| Community | `#A21CAF` magenta | `#F08CFF` |

Rules:
- The current section's hue is `--accent`; components read `--accent`, never raw hex.
- Hues appear on interaction (active nav icon, hover, the desk) and as whole fields in the work previews. The hero arrow's solid is the Overview hue.
- Surfaces are separated by a tone step, never a line or a shadow. Only the command palette (a real modal) has a shadow.
- No gradients, glass, or tinted near-blacks.

## Typography

- **One family, two cuts: Funnel** by NORD ID (SIL Open Font License, free for commercial use), loaded with `next/font/google`.
  - **Funnel Display**: the monument (hero JOKO, footer JOKO, loader), headings, work names, contact rows. Semibold; tracking -0.05em at monument size, -0.02 to -0.04em for headings.
  - **Funnel Sans**: body, labels, buttons, nav.
- Scale (about six steps): 13–14px small, 16px body, 18px lead, 28px about text, 36px section titles and statements, 72px display rows, and the monument fitted to its container (`40.5cqi`).
- Sentence case. Nothing under 13px. No eyebrows, monospace labels, `01 / 02` numbering, or `→` appended to links.

## Layout

- **Sidebar (desktop)**: the horizontal lockup on `bg` (the JC mark in `currentColor` beside "Joko Comia" in Funnel Display; `src/components/ui/Logo.tsx`), Search (⌘K / Ctrl K), nav grouped **Work** (Overview, Projects, Graphics), **Profile** (Experience, Stack, Certificates, Writing) and **Play** (Playground, Community), and the Light / Dark switch at the bottom. Nav text 14px, icons 16px, sized so the whole sidebar fits a 720px-tall window without scrolling. Community carries a live "N here" pill (see Community). Socials and the CV live in the Overview hero and the footer, not here. Tone step off the page, no border.
- **Mobile**: a 3.875rem top bar (`--bar-h`) with the JC mark, search icon and a list icon that morphs into a close icon. The menu wipes down from the bar over a 50% black scrim (280ms open, 180ms close), its items rising 8px 30ms apart. Scrim, Escape or a link closes it; the page behind doesn't scroll. Reduced motion: fades only.
- **Browser icon**: `src/app/icon.svg`, the white mark on a black rounded tile, so it reads on light and dark tabs.
- **Content column**: fills the space beside the sidebar; its right inset matches the sidebar's left one, so the page has one pair of outer margins.
- **Overview, top to bottom**:
  1. **Hero** (one screen from md): JOKO fitted to the text column, role and location, the statement "I design it. I build it." with one sentence and availability, the actions (See the work, CV, LinkedIn, GitHub, Email), and the 3:4 portrait at the side, vertically centred on the text. A row of four proof tiles from the CV closes the screen. On phones: JOKO, portrait beside the role, copy, actions, tiles two across, at natural height.
  2. **Selected work** (`WorkIndex`): the curated six from `FEATURED` in `src/content/work.ts` (AVERA, CryoLipo, OCTA Voting, ResQLine, Slip, Lotline) as a stage, about one screen. Graphics and All projects link from the heading; the Playground is reached from Play words. Phones: a thumbnail and the kind in each row.
  3. **Profile** (`ExperiencePreview` → `ProfileTabs`): Experience, Certificates and Stack in one section, switched by a segmented control (tabs) beside the title. Only what a recruiter scans: role, organisation, kind and dates (all roles); the six latest verifiable certificates with their badges; the featured tools by group. Each panel ends with a button to its full page.
  6. **Play words**: "I DESIGN / I CODE / I BUILD" as three display rows fitted margin to margin (`25.5cqi`), every letter loose (see Play words), plus text links to the Playground and to Community ("N designing a poster now" while anyone is there, otherwise "Design a poster together").
  7. **Contact**: display-size rows on alternating bands (email, GitHub, LinkedIn), then "Say hello" with a round arrow.
  8. **Footer** (every page): inverted. Desktop: "Get in touch" with the email at heading size, then CV · 1-minute brief · LinkedIn · GitHub on one line, and the pages in a 3 × 3 grid beside it (stacked under it on tablets). Phones: Contact (open), Pages and Colophon as tap-to-open bands (`FooterFold`: a button with aria-expanded and a region; the height eases open through grid-rows 0fr → 1fr in 260ms while the contents fade in, and closes in 200ms; the caret turns 180°; reduced motion snaps). JOKO fitted margin to margin, the copyright with the colophon on one quiet line beside it.
- Rhythm: tight inside a group (8–20px), generous between groups (40–56px), and very generous between sections: 112px on phones, 176px from md, 208px from xl. Each section opens with a heading, with its "see everything" link beside or under it, and 48–56px before its content. The hero keeps name and role together, then pauses before the statement and again before the actions; the proof tiles sit 48px off the hero copy.

## Components

Primitives live in `src/components/ui`, shell pieces in `src/components/shell`, Overview pieces in `src/components/overview`.

### Shape
One button shape: fully round, flat fill. Cards and bands 24px (`rounded-3xl`), the footer 32px, the drop cap 16px.

### Buttons (`btn`, `btn-primary`)
Round, flat. `btn` on `surface`, `btn-primary` on `ink`. Pair with `pressable`. Magnetic under the custom cursor. Hover (fine pointers): `btn` inverts to `ink`, `btn-primary` takes the section hue, and an icon tagged `data-nudge` moves the way the button goes (`out` 2px up-right, `left` / `right` 3px, `turn` 90° for Close), 220ms ease-out; none of it under reduced motion.

### Sidebar nav
The active item is an `ink` pill with `bg` text (the switch's active fill) that slides between items. Inactive items are `muted`; on hover they turn `ink` and their icon takes that item's section hue.

### Pressable (`pressable`)
Scales to 0.97 on `:active`. Owns its transitions (transform 160ms, colours 150ms, `--ease-out`); don't add `transition-colors` beside it.

### Custom cursor (`Cursor`)
A 12px mid-grey dot pinned to the mouse (GSAP `quickSetter`, no easing: a trailing cursor read as lag). Over links and buttons it grows to 56px and inverts what's beneath; difference blending runs only in that state, because it re-composites the page. `data-cursor="Word"` shows a solid circle with that word (work rows: "View", Say hello: "Write"). Shrinks on press. Re-checks on scroll. `.btn` and `[data-magnetic]` lean 30% toward it via `translate`. Off for touch and reduced motion; the system cursor returns in text fields and while a dialog is open, except dialogs marked `data-cursor-keep` (the project and graphics sheets). While such a dialog is open the cursor element lives inside it (a modal dialog is in the top layer, above any z-index); it returns to `<body>` when the dialog closes. The element is built in script, not JSX, so React never owns a node that moves.

### Loader (`Intro`)
About 2s, once per session, skippable (click, key, Skip intro). JOKO rises in outline, a solid fill sweeps left to right while a counter runs 000→100 ("Designing" → "Building"), then the panel lifts away (`expo.inOut`) and fires `INTRO_DONE` for the hero. Waits for fonts, locks scroll, hides itself after 5s if script fails. Skipped under reduced motion; `?nointro` skips it for testing.

### Hero (`Hero`)
- The `h1` is the monument; its visually hidden line carries the role at body size.
- Letters rise through a mask after the loader (0.9s, 60ms stagger), other parts follow; settled in about 1.1s. Plain CSS keyframes (not GSAP), gated on the intro being done, so the hero paints with the page and counts as fast content. Reduced motion: fade only.
- JOKO's letters take a section hue the moment the pointer touches them and fade back over 700ms, leaving a trail. Fine pointers only.
- **Proof tiles**: `surface` / `card` bands that invert to `ink` under the pointer; each opens Experience. CV facts only.

### Folio (`FolioCorner`, `FolioScene`)
The mascot, built in code from the brand character sheet (a bevelled page with a blue fold, jointed limbs and a face). A 112 × 144px companion fixed in the bottom-right corner from md, on every page; phones skip it. Clicking makes it hop and turn and opens its speech bubble ("Where to?", `ink` fill, a tail pointing at Folio, growing from that corner in 180ms): Brief summary (1 min, first), Surprise me (a random project's sheet), Community (with the live count), Playground, Download CV, Say hello, and Show my blueprint / Build me back (the flip between the solid build and the blueprint outline). It waves while the bubble is open; Escape, a click elsewhere, a new page or a choice closes it. A hidden button that rings Folio on focus opens it from the keyboard (focus starts on the first item, Escape returns to it). It waves on arrival, on hover and at the footer, blinks, breathes and leans toward the pointer. Decorative and `aria-hidden`. Loads after the intro on the visitor's first move (pointer, scroll, key), never during page load, so its 900 KB 3D engine doesn't cost first-load speed; renders on demand (every frame while changing, 20 a second at rest, only while on screen). Reduced motion: poses snap, nothing idles.

### Work index (`WorkIndex`)
- **Names** on five of twelve columns, up to 72px in tight rows, muted until active. Hover or focus activates a row: the name turns ink and leans in.
- **Stage** on the other seven (from lg): the 16:9 still framed in a `surface` band (12px padding, 24px / 16px radii) wipes to the active project in the direction the pointer moved (`clip-path`, 0.7s `expo.out`, its image settling from `scale(1.12)`). When the project has a `video.loop`, it plays muted over the still (fine pointers without reduced motion only). Under the frame, the info strip (kind, one-line summary, "Open project" to `/projects#slug`) slides up 10px as it changes. Left-aligned so the bottom-right corner stays clear for Folio.
- **Entrance:** names rise through masks 60ms apart, the stage wipes up through its frame, the info strip follows. Reduced motion: a fade.
- Every work item links to its project's sheet; outside links (GitHub, live sites) live inside the sheet.

### Profile tabs (`ProfileTabs`)
Rows on alternating `surface` / `card` bands (24px radius), like the contact rows: dates in a fixed muted column, the name at `ledger-item` size, the role beneath, the kind at the right. Certificates sit two across with their badge and an arrow that nudges up-right. A linked row inverts to `ink` under the pointer; press scales it to 0.99. On a tab change the new panel's rows rise 16px, 40ms apart (0.5s `expo.out`); reduced motion fades them. Phones: the dates move above the name and the kind hides.

### Segmented control (`Segmented`)
One round `surface` track with an ink pill that slides to the active option (0.35s `expo.out`; a jump under reduced motion); inactive labels are `muted`, `ink` on hover. Two modes: `filter` (toggle buttons with `aria-pressed`, used by Graphics) and `tabs` (a WAI-ARIA tablist with arrow, Home and End keys, used by Profile). The track scrolls sideways when it overflows.

### Smooth scrolling (`SmoothScroll`)
Lenis eases wheel and trackpad scrolling (`lerp: 0.1`), run from GSAP's ticker so ScrollTrigger stays in step. Touch keeps native scrolling. Off under reduced motion, inside dialogs (native `<dialog>` and `[role="dialog"]`) and over canvases, and while the phone menu or loader locks the page.

### Contact rows
Bands of `surface` / `card`, value at display size, left-aligned, lower part of the band. A linked row inverts to `ink` under the pointer; the round arrow turns 45°. Labels go to `aria-label`, not above the value.

### Play words (`PlayWords`)
The Overview's one place to play. Fine pointers grab and throw letters (GSAP Draggable + InertiaPlugin, bounded to the section, tilt and 1.08 scale while held); touch taps make a letter hop, so the section never traps scrolling. A moved letter takes its row's hue (Overview, Projects, Playground). **Scatter** throws all letters to random spots; **Put back** springs them home (`elastic.out(1, 0.6)`, random 25ms stagger) and clears the hue. The `h2` carries the sentence for screen readers; letters are `aria-hidden`. Entrance: the letters are never hidden; the three rows slide in from alternating sides (14%), scrubbed to the scroll from the section entering to its top reaching 30% of the view. The section clips sideways overflow. Reduced motion: no slide; drag without momentum, Scatter and Put back jump.

### Page header (`PageHeader`)
Inner pages open with the title at display size (`.page-title`, `clamp(3.5rem, 10vw, 9rem)`, letters rising in), the item count in muted display type at its top right (`aria-hidden`), and one lead line.

### Projects (`ProjectGrid`)
- **Grid:** two columns from md (one on phones). Each card is the 16:9 thumbnail framed in a `surface` band (12px padding, 24px outer and 16px inner radius, never cropped edge to edge), then the name (`.project-card-name`, `clamp(1.75rem, 2.6vw, 2.5rem)`) and the kind in muted. Nothing else: role, result and stack live in the sheet. Hover (fine pointers): the image leans in to 1.04 over 700ms and the name takes the section hue; press scales the frame to 0.985; the "View" cursor.
- **Entrance:** as cards scroll in (ScrollTrigger batch, 80ms apart) the image wipes up through its frame (`clip-path`, 1.1s `expo.out`) while settling from `scale(1.12)`, and the name rises through its mask. Reduced motion: a fade.
- **Sheet:** tapping a card opens a full-screen native `<dialog>`. The one authored moment on the page: the thumbnail flies from its card into place (FLIP with GSAP, 0.9s `expo.out`) while the `bg` ground fades up behind it, then the title (`.sheet-title`, `clamp(3rem, 7vw, 6rem)`) rises through its mask and the details follow 60ms apart. Below the framed image: title, kind and summary on seven columns; Role, Result, Built with (chips) and the link on five. A sticky bar holds "n of 13", previous, next and Close (focused on open). Arrow keys step without animating; Escape, Close or the back of the flight closes it, faster than it opened (0.55s `expo.inOut` back to its card, or a short fade when the card is off screen). Closing mid-flight lands the opening first. Reduced motion: 200ms fade in, 150ms out.
- **Links:** `/projects#slug` opens that project's sheet (palette, Overview index), and the hash follows the open sheet. The sheet's low-resolution layer uses the card's `sizes`, so the flight starts from the picture already loaded.
- **Thumbnails:** `public/projects/<slug>-<STILL_VERSION>.webp` (1920 × 1080); bump `STILL_VERSION` in `src/content/work.ts` when they change.
- **Video:** optional per project (`video` in `src/content/projects.ts`). `loop` (5–8 s, muted, 1280 × 720) fades in over the card's still while it's hovered and plays in the Overview stage; `full` (1920 × 1080) plays with controls in the sheet, its poster the still. Phones and reduced motion keep the still. Encode a recording with `node scripts/encode-project-video.mjs <slug> <recording> [loopStart] [loopLength]`, which writes both files to `public/projects/video/` and prints the line to add.

### Graphics (`GraphicsShowcase`)
- **Collections:** the work is grouped (AWS Learning Club, The Reef, OCTA committee logos, Codyssey, DIAL and more). Files, sizes and alt text are generated by `scripts/build-graphics.mjs` into `public/graphics/<slug>/` and `src/content/graphics.data.ts`; edit `COLLECTIONS` there and re-run.
- **Tabs:** All plus each category that has work (Branding, Pubmats, Posters, Print & merch, Infographics, Art), in the `Segmented` control's filter mode.
- **Covers:** composed from each collection's real pieces by `scripts/build-graphic-covers.mjs` (run it before `build-graphics.mjs`): a colour field per collection, three to five pieces tilted like a collage with a soft offset shadow, and the brand fold (blue, then black) in the bottom-right corner. No text: the title sits under the cover. 4:5, 1:1 or 3:4, so the masonry keeps its rhythm.
- **Masonry:** covers at their real shapes in CSS columns (two, three from lg), each with the title (`.gx-name`), the piece count and the category. They wipe up through a clip as they enter (once) and rise 24px on a tab change, 35ms apart. Hover leans the image to 1.04 and turns the title the section hue; the cursor reads "Open".
- **Sheet:** a full-screen native `<dialog>`, Behance-style: the title block (display title, one-line summary, Category and Pieces), then every piece in sections, each with its own column count (boards stacked full width, posters in two, stickers in four). It arrives on the brand's diagonal fold: an Overview-blue panel sweeps in from the right on a down-left diagonal, the `bg` ground follows 120ms behind (0.6s `expo.inOut`), then the title rises and the rest follows. Closing folds it away to the left in 0.45s. Previous / next, arrow keys, Escape; focus starts on Close; `/graphics#slug` opens a collection. Reduced motion: fades.

### CV (`CvLink`)
One PDF, `public/joko-comia-cv.pdf` (one page), offered as a download (`download` attribute, saved as `Joko-Comia-CV.pdf`) in the Overview hero's action row, the Experience header (`btn-primary`), the footer's Contact column and the palette's Actions. To update it, replace the file.

### Blog
`/blog` (was Writing; `/writing` links redirect permanently) lists posts newest first: date in a three-column side column, the title at heading size, its summary beneath. The whole row is one link with the "View" cursor; its title takes the section hue under the pointer. With no posts, one surface band says the first posts are coming and links to LinkedIn. A post (`/blog/[slug]`) opens with "All posts", a display title, the date and "First posted on LinkedIn" when set. Then the text (18px / 1.6 within 65ch, `.post-body`) and the pictures in their own column: side by side from 80rem (pictures at least 16rem), two across under the text on tablets, one under the text on phones. Each picture sits in a `surface` frame, leans in on hover, shows "View", and opens in the picture viewer: a modal dialog sized to the window (never scrolls), caret buttons and arrow keys step through the post's pictures, X or Escape closes; it only fades, like the poster viewer, so the cursor stays put. Posts are Markdown files in `src/content/posts` (see `_template.md`); pictures live in `public/posts/<slug>/` as WebP, their sizes read from the file at build time so the page never jumps.

### Stack
Each group (Design, Front-end, Code and tools) has its heading in a three-column side column and its tools as words at heading size (`.stack-item`, `clamp(2rem, 4.5vw, 4rem)`), wrapping like a set of type; under a fine pointer each word lifts 0.08em, turns 2° and takes its own section hue (all eight hues, ordered so neighbours differ), 180–220ms ease-out, colour only under reduced motion; the CV's stated levels are one muted sentence beneath the group ("Advanced in Figma and Canva; basic in Illustrator and Photoshop."). Interests close the page as one statement paragraph. Tools marked `featured` in `src/content/stack.ts` make the Overview's one-line "Works with" summary, which links to the page.

### Experience
One band per role (`surface` / `card` alternating), newest first. On wide screens the dates take three of twelve columns; the role at heading size, then organisation (linked when it has a site), kind and location in muted, the outcome lines, and skill chips. Content lives in `src/content/experience.ts`.

### Certificates
Credly badges (public, accepted) come from Credly's public profile JSON for `site.credly`, fetched on the server and revalidated daily (`src/lib/credly.ts`), merged with any hand-added entries in `src/content/certificates.ts`, newest first. Bands like the contact rows: the badge image (64–80px) beside the title at heading size, issuer and year beneath, a round arrow at the right that turns 45° as the band inverts to `ink`; each links to the badge's public Credly page to verify it. The Overview's Experience section lists the three latest.

### Brief (`/brief`, `BriefView`)
The one-minute version of the portfolio, for people who won't browse. A quiet résumé page: the page title, one lead line, CV / socials / Print, then a sticky segmented switch **Recruiter · Hiring manager · Client** that re-orders the same facts (order and project picks in `src/content/brief.ts`; only the freelance services and process are written there, everything else comes from the CV content). The view lives in the address (`?for=recruiter|manager|client`), so each view is a link Joko can send with an application. Sections are a label column beside the content, cards on `surface`; switching views is a 200ms fade, nothing moves. Print hides the shell and prints the current view black on white. In the sidebar under Work, right after Overview, with a "1 min" pill (the same pill as Community's "N here"), so it is on every page, in the phone menu, the footer and search (which also finds it by "resume", "recruiter", "hire"). Also the hero's "Brief" button and the footer's Contact line.

**Tour (`BriefTour`).** Joko's cursor, like a collaborator's in a design file: a pointer in the section hue with a "Joko" tag and an `ink` speech bubble. First Brief visit per session, after about a second, it glides in and points at the summary: "Hi, I'm Joko. Want a quick tour?" with Show me / No thanks; unanswered, it fades after 10 s. The tour visits five stops (the switch, the summary, two sections that depend on the view, the CV/Print row), about 2.6 s each plus a 0.7 s glide on `--ease-in-out`; each stop scrolls to the middle and gets a 2px ring in the hue; lines fade in, "n of 5" and Skip sit under them. Escape or Skip ends it; the header's Tour button replays it. The bubble slides left as needed to stay on screen. Reduced motion: the cursor jumps. Lines live in `BriefTour.tsx`.

### Certificates (`CertificateShelf`)
A featured row (TOPCIT Level 3, IT Specialist AI, UX Design Fundamentals; `FEATURED_CERTS`) as three tall `surface` cards, then every certificate filtered by field (Design & product, Development, AI data & cloud, Other; sorted by title keywords in `certField`, so new Credly badges file themselves). Every badge is drawn in code (`CertBadge`) as a type-specimen card on `bg`: the issuer small at the top, two initials in Funnel Display, the JC fold cut into the top-right corner in the section hue, and a ruler of the twelve months with a tall tick at the month it was earned (56 / 80 / 112px, container units inside). Issuer artwork never shows, so every issuer reads as one set; the real badge is on the verify link. Used on Certificates, the Overview's certificate tab and the Brief.

### Command palette (`CommandPalette`)
Native `<dialog>` with combobox and grouped listbox (Pages, Projects, Links, Actions). Opens instantly (no animation). Round, the only shadow on the site. Project rows jump to `/projects#slug`, which opens that project's sheet (`ProjectGrid`).

### Text link (`link`)
Underlined in `line`, `--accent` on hover. External links say "(opens in a new tab)" to screen readers; an empty href shows an `[Add link: …]` reminder.

### Chip (`Chip`)
Round, filled: `surface` with ink text, or `strong` (ink fill) for the leading chip.

### Community (`CommunityStudio`, `Poster`, `Archive`)
"Design by committee": everyone on the page designs one poster in eight 15-second votes. Rules and backend: `docs/community.md`.
- **Poster** (`Poster`): drawn entirely from the eight decision ids (theme word, layout, typeface, palette, motif, scale, texture, stamp) in CSS, sized with container-query units so the same component is the live stage, an archive thumbnail and the viewer. Undecided parts are a **blueprint**: outline type on a faint grid; the poster fills solid once a palette wins (the site's design-then-build idea). Poster palettes are artwork hexes in `globals.css`, not UI tokens. Type never leaves the poster except the Cropped scale, on purpose.
- **Stage:** the poster in a `surface` band (12px padding, 24/16px radii). Hovering or focusing an option previews it on your poster ("Preview" chip); your vote shows as "Your pick". When a decision lands, an ink sweep crosses the poster (750ms `--ease-in-out`, like the loader's fill); none under reduced motion.
- **Vote:** "Decision n of 8", the decision at section-title size, a 15-second ring (CSS animation started at the server's elapsed time, in the section hue) and four option cards: display-size labels on `surface` with the tally as a bar behind (`scaleX`, 450ms). Your pick inverts to `ink`. Cards rise 12px, 50ms apart, when a round opens.
- **Talk:** six emoji and six preset phrases (fixed lists in `src/content/community-words.json`); they float up over the poster for everyone (1.9s / 2.8s, fade only under reduced motion). Nothing else is ever shown.
- **Here now:** round name tags (colour dot + generated name), yours first with Shuffle.
- **Archive:** finished posters, newest first (the database keeps 48), two across, four from lg; the thumbnail leans in on hover, the name takes the hue, the cursor reads "Open". A tap opens the **viewer**: a native modal dialog sized to fit the window with no scrolling (poster as tall as the window beside its decisions; on phones the poster takes the height the details leave). Caret buttons and arrow keys step, the black X or Escape closes. The dialog only fades; the 0.96 zoom runs on its contents, because a transform on the dialog would become the frame for the custom cursor.
- **Live count:** `online_count()` polled every 20s (one shared request) feeds the sidebar pill (a breathing magenta dot, opacity only) and the Overview link.

## Playground pieces

### Design desk (`DeskPiece`, `DeskScene`)
Joko's tools as monochrome clay; each object opens real work. The selected object takes Playground amber; the swatch fan opens into the four section hues. Filled round chips are the accessible control; the canvas is `aria-hidden`. Springs, draw-ins and orbit only for fine pointers without reduced motion. `frameloop="demand"`, loaded with `dynamic(..., { ssr: false })`, materials disposed on unmount.

## Motion

Emil-design-eng rules (CLAUDE.md) hold: transform and opacity, `--ease-out`, hover gated to fine pointers, reduced motion keeps opacity and colour only.

- **Signature**: the theme change through the cursor arrow, and Folio in the corner.
- **Loader**: the one long showpiece (see Loader).
- **Section entrances** (`Reveals`, GSAP ScrollTrigger): in each `.reveal` section the heading, then every `[data-reveal]` part, rise 24px and fade, 70ms apart, once at 80% of the viewport. Hidden only by the tween, so content stays if script fails. Tall, display-size sections (Play words, Contact) never hide their content on entry: a late fade there reads as a blank page while scrolling.
- **Text** (`Reveals`, GSAP SplitText): `data-split="chars"` headings rise letter by letter through their line masks (0.9s, 22ms stagger, once); `data-split="words"` paragraphs fill from 18% to full ink, scrubbed as they cross the view (reading pace). Screen readers get the whole text. Reduced motion: headings fade, paragraphs stay solid.
- **Play words** is the one spring outside the Playground, by request: it is play, and only runs when the visitor asks for it.
- **Feedback**: cursor states, magnetic buttons, press scale, active nav item fills with `ink` (colour 150ms), contact band inversion, work preview crossfade.
- **Theme change** (`switchTheme` in `src/lib/themeTransition.ts`): a view transition where the new theme grows in through the cursor arrow. The arrow launches whole from the pressed control, aimed at the page centre and righting a 28° turn, then floods the page (950ms, `--ease-in-out`, exponential scale). The palette's theme action uses it from the centre. Reduced motion: 200ms crossfade. No view transitions: instant.

## Theme

- Follows the system; the sidebar's Light / Dark switch overrides (`next-themes`, class on `<html>`). It is the hero switch at sidebar size on `bg`, with Phosphor sun and moon icons.
- Icons: Phosphor only (`react-icons/pi`), everywhere.
- Tailwind v4 dark mode: `@custom-variant dark (&:where(.dark, .dark *));`.

## Performance budget

LCP < 2.5s, INP < 200ms, CLS < 0.1. One font family. Three.js only in the hero arrow and the Playground, both loaded on demand and rendered only while visible. `next/image` for all images.

## Still needed (not inventable)

- **Project links:** CryoLipo's live store (in handover) and AVERA's repo (private for now). Both show no link until then.
- **Project videos:** AVERA, CryoLipo, ResQLine and Slip have theirs (loops at 0:23, 0:05, 0:25 and 0:09, 7 s each; Slip was recorded vertical, so it sits centred on its own purple #861972). The other projects keep their stills until Joko records them.
- **Graphics redesigns:** Joko's own versions of The Reef marks and the STRASUC awardee set; drop them into the Graphics source folder and re-run `scripts/build-graphic-covers.mjs`, then `scripts/build-graphics.mjs`.
