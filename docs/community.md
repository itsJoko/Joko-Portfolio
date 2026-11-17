# Community: "Design by committee"

Everyone on the page designs **one poster together**. Every 15 seconds the crowd votes on the next design
decision; the winning option is applied and the poster changes for everyone at once. After eight decisions
the poster is finished, goes into the archive with how many people made it, and a fresh one starts.

Nobody can type anything. People talk with live emoji reactions and preset quick phrases, and their names
are generated ("Bold Kerning", "Teal Gutter"), so there is nothing to moderate.

---

## Part 1 — How it works

### The eight decisions (one poster)

| # | Decision | Example options (3 drawn at random each round) |
|---|---|---|
| 1 | Theme word | Signal, Bloom, Orbit, Grain, Pulse, Tide, Static, Ember |
| 2 | Layout | Centred, Split, Grid, Diagonal fold |
| 3 | Typeface | Funnel Display, an editorial serif, a condensed grotesk, a wide grotesk |
| 4 | Palette | Ink on paper, Fold blue, Signal orange, Acid lime, Night teal |
| 5 | Motif | Circles, Folds, Stripes, Dots |
| 6 | Scale | Huge, Balanced, Tiny |
| 7 | Texture | Clean, Grain, Halftone |
| 8 | Stamp | "Vol. 1", "Made together", "Est. 2026", "No notes" |

All words come from fixed lists in the code, so a poster can never say anything you didn't write.

### What visitors see and do

- **Join:** a generated name and colour (shuffle until they like it). An invisible Cloudflare Turnstile check
  runs in the background; bots can't join.
- **Vote:** three option cards and a 15-second ring. The live tally fills as people vote; ties go to the
  option that reached the count first.
- **Talk:** tap an emoji (it floats up over the poster for everyone) or a quick phrase ("Bold choice",
  "Go blue!", "Trust the process"). Only these preset items ever show.
- **Who's here:** a strip of name tags of everyone online, and "N designing now" on the Overview.
- **Archive:** finished posters, newest first, each with its contributor count.

### Architecture (where each piece lives)

```
Browser (Next.js page /community)
 ├─ signs in anonymously, with the Turnstile token ─────────► Supabase Auth
 ├─ calls current_state() every 2 s, cast_vote(choice) ─────► Postgres functions (the rules live here)
 └─ joins channel "studio": presence (names), broadcast ────► Supabase Realtime
        (reactions, phrases, "someone voted")
```

- **Postgres is the referee.** Rounds, timing and winners are decided by database functions, so no visitor
  can cheat by editing the page. There is no server to run: an expired round is closed by the next
  `current_state()` call (safely, even if two people trigger it at once).
- **Row-level security (RLS)** locks every table: visitors can read posters and rounds, and can only write
  through `cast_vote`, one vote per person per round.
- **Realtime messages are untrusted.** Anyone with the public key could send anything on the channel, so the
  page only renders a message if it is one of the known emoji, phrases or generated names. Everything else
  is dropped.

### Cost

Everything fits the free tiers: Supabase Free (500 MB database, 50,000 monthly active users, 200 concurrent
Realtime connections, 2 million Realtime messages a month) and Cloudflare Turnstile (free). A free Supabase project pauses after a week with no
activity; open the dashboard to wake it, or upgrade later if the page gets busy.

---

## Part 2 — Your setup (about 20 minutes)

You only do this once. Each step says what it is and why. Keep a note open to paste values into.

### Words you'll see

- **Project:** your own copy of Supabase: a Postgres database plus login, realtime and an API.
- **Publishable key** (`sb_publishable_…`): safe to put in the website. It can only do what RLS allows.
- **Secret key** (`sb_secret_…`): bypasses every rule. **Never** put it in the website or in Git. This page
  doesn't need it at all.
- **Environment variables:** settings the site reads at build time, kept in `.env.local` on your computer
  (ignored by Git) and in Vercel's settings for the live site.

### Step 1 — Create the Supabase project

1. Go to **supabase.com** → **Start your project** → sign in with GitHub (`itsJoko`).
2. **New project**: organisation = your personal one; name `joko-portfolio`; region **Southeast Asia
   (Singapore)**, the closest to your visitors; plan **Free**.
3. Click **Generate a password** for the database and save it in your password manager. You won't need it
   for this page, but you can't see it again.
4. **Security** (on the same form):
   - **Enable Data API:** on. The site talks to the database through it.
   - **Automatically expose new tables:** **off**. The migrations grant access table by table, so nothing
     becomes public by accident.
   - **Enable automatic RLS:** **on**. A safety net: any new table gets row-level security switched on.
   - **Connect GitHub:** skip; the SQL migrations live in this repo instead.
5. Click **Create new project** and wait about two minutes while it sets up.

### Step 2 — Turn on anonymous sign-ins

Visitors get a temporary account with no email, so each one can vote once per round.

1. Left sidebar: **Authentication**. A second menu opens; under **Configuration** click **Sign In / Providers**.
2. At the top, in **User Signups**, turn on **Allow anonymous sign-ins** → **Save changes**.
3. Can't find it? Press `Ctrl K` in Supabase and type "anonymous".

### Step 3 — Create the Turnstile widget (Cloudflare)

Turnstile is a free, invisible "are you a human?" check. It stops scripts from creating thousands of fake
voters.

1. Go to **dash.cloudflare.com**, create a free account (or sign in).
2. Sidebar: **Turnstile** → **Add widget**.
3. Name `joko-portfolio`; hostnames: `localhost` and `joko-comia.vercel.app` (add your custom domain too if
   you have one); widget mode **Managed**.
4. Create it. You get two values: a **Site key** (public) and a **Secret key**. Keep both for the next steps.

### Step 4 — Connect Turnstile to Supabase

1. Supabase: **Project Settings** (bottom of the sidebar) → **Authentication** → **Bot and Abuse Protection**
   (some dashboard versions show it as **Authentication** → **Attack Protection**).
2. Turn on **Enable CAPTCHA protection**, choose **Cloudflare Turnstile**.
3. Paste the Turnstile **Secret key** → **Save**.

Now Supabase rejects any sign-in that doesn't carry a valid Turnstile token.

### Step 5 — Put the public values in `.env.local`

1. Supabase: click **Connect** (top of the project) or **Project Settings** → **API Keys**. Copy the
   **Project URL** and the **Publishable key**.
2. In the project folder, create a file named `.env.local` (copy `.env.example` once it exists) with:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...
   ```

3. Restart `npm run dev` so it picks them up.

All three are public by design; that's why they start with `NEXT_PUBLIC_`. The secrets stay in Supabase and
Cloudflare.

### Step 6 — Add the same three to Vercel

1. vercel.com → your `joko-portfolio` project → **Settings** → **Environment Variables**.
2. Add the three lines above for **Production** and **Preview**.
3. They apply on the next deploy.

### Step 7 — Let Claude build the database (pick one)

- **A. Connect the Supabase MCP server (recommended).** Claude can then create the tables, run the security
  advisors and test everything itself. Send Claude your Project URL (public); Claude adds a `.mcp.json` that
  points to Supabase's official server (`https://mcp.supabase.com/mcp`) limited to this project. When the
  session reloads, approve the connection in the browser window Supabase opens.
- **B. Paste SQL yourself.** Claude writes `supabase/migrations/*.sql`; you paste each file into Supabase →
  **SQL Editor** → **Run**, and paste the result back.

Either way the SQL is saved in the repo, so the database can be rebuilt from scratch.

### When you're done

Tell Claude which option you picked in Step 7. Don't paste any **secret** key into the chat; Claude never
needs one.

---

## Part 3 — Build plan (Claude)

1. **Database:** tables (`posters`, `rounds`, `votes`, `profiles`), RLS policies with explicit grants (new
   tables aren't exposed to the API automatically), and the `current_state()` / `cast_vote()` functions in
   a private schema with thin public wrappers. Checked with the Supabase security advisors.
2. **Page `/community`:** the poster renderer (the eight decisions as CSS), the voting cards and timer ring,
   emoji reactions and quick phrases over Realtime, presence tags, the archive. Reduced motion and phones
   covered.
3. **Shell:** "Community" under Play in the sidebar and palette, and the live "N designing now" teaser on the
   Overview.
4. **Tests:** Playwright with several browsers at once (several "visitors"), voting in the same round.
