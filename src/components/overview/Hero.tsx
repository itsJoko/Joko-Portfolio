import Image from "next/image";
import Link from "next/link";
import { CvLink, SocialButtons } from "@/components/ui";
import { site } from "@/content/site";

// The results a reviewer looks for, from the CV. Each one opens the page that backs it up.
const proof = [
  { title: "5th of 106 schools", detail: "SIKAPtala 2026 national design competition" },
  { title: "Top 12 of 48+ universities", detail: "Batang Techno Hackathon, 2026" },
  { title: "Freelance since Sep 2026", detail: "CryoLipo, a client's Shopify storefront" },
  { title: "BS Computer Science", detail: "LSPU San Pablo City, expected 2027" },
];

/**
 * The Overview's first screen as a summary: who this is, what he does, how to reach him and what he has
 * to show for it, all in one view. The portrait sits beside the text, centred on it.
 */
export function Hero({ name, role }: { name: string; role: string }) {
  const letters = name.toUpperCase().split("");

  // The entrance is CSS (globals.css, "Hero entrance"), so it starts with the first paint.
  return (
    <section aria-labelledby="hero-title" className="-mt-10 flex flex-col gap-6 pt-2 md:-mt-16 md:min-h-svh md:gap-5 md:py-5">
      <div className="hero-grid md:flex-1">
        <h1 id="hero-title" className="hero-name">
          {/* Body size, so this hidden line doesn't stretch the heading's text box to the monument's width. */}
          <span className="sr-only text-base">
            {name}, {role}
          </span>
          <span aria-hidden className="block overflow-hidden">
            {letters.map((c, i) => (
              <span key={i} className="hero-char inline-block" style={{ "--i": i } as React.CSSProperties}>
                {c}
              </span>
            ))}
          </span>
        </h1>

        {/* A surface frame, so the dark studio backdrop doesn't dissolve into the dark page. */}
        {site.photo && (
          <div className="hero-photo hero-fade rounded-[1.75rem] bg-surface p-1" style={{ "--i": 0 } as React.CSSProperties}>
            <Image
              src={site.photo}
              alt={`Portrait of ${site.brandName}`}
              width={1200}
              height={1600}
              sizes="(min-width: 48rem) 34rem, 7rem"
              priority
              className="size-full rounded-3xl object-cover"
            />
          </div>
        )}

        <div className="hero-role hero-fade" style={{ "--i": 1 } as React.CSSProperties}>
          {/* The sidebar names him from md; the phone bar only has the mark. */}
          <p className="font-display text-lg font-semibold leading-tight tracking-[-0.02em] md:hidden">{site.brandName}</p>
          <p className="mt-0.5 text-base font-medium leading-snug md:mt-0 md:text-lg">{role}</p>
          <p className="text-base leading-snug text-muted md:text-lg">{site.location}</p>
        </div>

        <div className="hero-copy flex flex-col gap-5">
          <div className="hero-fade" style={{ "--i": 2 } as React.CSSProperties}>
            <p className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">I design it. I build it.</p>
            <p className="mt-2 text-base text-muted">Open to OJT and freelance work.</p>
          </div>
          {/* The first things a reviewer reaches for: the work, the CV, and a way to get in touch. */}
          <div className="hero-fade hero-actions flex flex-wrap items-center gap-2" style={{ "--i": 3 } as React.CSSProperties}>
            <a href="#work" className="btn btn-primary pressable">
              See the work
            </a>
            <CvLink className="btn pressable" />
            <SocialButtons className="ml-1" />
          </div>
        </div>
      </div>

      <ul className="hero-fade grid grid-cols-2 gap-2 lg:grid-cols-4" style={{ "--i": 4 } as React.CSSProperties}>
        {proof.map((p) => (
          <li key={p.title}>
            <Link href="/experience" className="proof-tile">
              <span className="block font-display text-lg font-semibold leading-tight tracking-[-0.02em] md:text-xl">{p.title}</span>
              <span className="proof-detail mt-1 block text-sm leading-snug text-muted">{p.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
