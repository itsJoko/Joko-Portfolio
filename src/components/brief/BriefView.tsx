"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PiArrowUpRight, PiPrinter } from "react-icons/pi";
import { CertBadge } from "@/components/certificates/CertBadge";
import { CvLink, SocialButtons } from "@/components/ui";
import { Segmented } from "@/components/ui/Segmented";
import { AUDIENCES, ORDER, WORK, craft, process, services, type AudienceId, type SectionId } from "@/content/brief";
import type { Certificate } from "@/content/certificates";
import { competitions, education, experience } from "@/content/experience";
import { projects } from "@/content/projects";
import { site } from "@/content/site";
import { stack } from "@/content/stack";

// ---- The audience lives in the address (?for=recruiter), so every view is a link you can send ----
const IDS = AUDIENCES.map((a) => a.id) as readonly string[];
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
function readAudience(): AudienceId {
  const v = new URLSearchParams(window.location.search).get("for");
  return v && IDS.includes(v) ? (v as AudienceId) : "recruiter";
}
function writeAudience(id: AudienceId) {
  const url = new URL(window.location.href);
  url.searchParams.set("for", id);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

const LABELS: Record<SectionId, string> = {
  availability: "At a glance",
  services: "What I can make",
  work: "Work",
  craft: "How I work",
  process: "How we'd start",
  experience: "Experience",
  recognition: "Recognition",
  education: "Education",
  skills: "Skills",
  certificates: "Certificates",
};

const range = (start: string, end: string) => `${start} – ${end || "Present"}`;

/**
 * The one-minute version of the portfolio. One page of facts, re-ordered for the reader:
 * a recruiter, a hiring manager or a freelance client. Quiet on purpose (no entrances, a plain
 * fade when the view changes) and it prints as a tidy summary.
 */
export function BriefView({ certificates, certificateCount }: { certificates: Certificate[]; certificateCount: number }) {
  const audience = useSyncExternalStore(subscribe, readAudience, () => "recruiter" as AudienceId);
  const current = AUDIENCES.find((a) => a.id === audience)!;

  const sections: Record<SectionId, React.ReactNode> = {
    availability: (
      <dl className="brief-facts">
        <div>
          <dt>Looking for</dt>
          <dd>An OJT placement in UI/UX design, front-end or software development, and freelance work.</dd>
        </div>
        <div>
          <dt>Based in</dt>
          <dd>{site.location}</dd>
        </div>
        <div>
          <dt>Studying</dt>
          <dd>
            {education.degree}, {education.when.toLowerCase()}
          </dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <a href={`mailto:${site.email}`} className="link">
              {site.email}
            </a>
          </dd>
        </div>
      </dl>
    ),
    services: (
      <ul className="grid gap-2 md:grid-cols-2">
        {services.map((s) => (
          <li key={s.title} className="brief-card">
            <p className="brief-card-title">{s.title}</p>
            <p className="mt-2 text-muted">{s.detail}</p>
            <Link href={s.proof.href} className="link mt-4 inline-block text-sm">
              See {s.proof.label}
            </Link>
          </li>
        ))}
      </ul>
    ),
    work: (
      <ul className="flex flex-col gap-2">
        {WORK[audience].map((slug) => {
          const p = projects.find((x) => x.slug === slug);
          if (!p) return null;
          return (
            <li key={slug}>
              <Link href={`/projects#${slug}`} className="brief-row">
                <span className="min-w-0">
                  <span className="brief-card-title block">{p.title}</span>
                  <span className="mt-1 block text-sm text-muted">{p.kind}</span>
                  <span className="mt-3 block">{p.role.split(":")[0]}.</span>
                  <span className="mt-1 block text-muted">{p.result}</span>
                </span>
                <PiArrowUpRight aria-hidden className="brief-arrow size-5 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    ),
    craft: (
      <div className="flex max-w-[60ch] flex-col gap-4 text-lg leading-relaxed">
        {craft.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    ),
    process: (
      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {process.map((s) => (
          <li key={s.title} className="brief-card">
            <p className="brief-card-title">{s.title}</p>
            <p className="mt-2 text-muted">{s.detail}</p>
          </li>
        ))}
      </ol>
    ),
    experience: (
      <ul className="flex flex-col gap-5">
        {experience.map((e) => (
          <li key={e.org} className="grid gap-1 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-6">
            <span className="text-sm text-muted md:pt-1">{range(e.start, e.end)}</span>
            <span>
              <span className="block font-medium">{e.role}</span>
              <span className="block text-muted">
                {e.short} · {e.kind}
              </span>
            </span>
          </li>
        ))}
      </ul>
    ),
    recognition: (
      <ul className="grid gap-2 md:grid-cols-2">
        {competitions.map((c) => (
          <li key={c.event} className="brief-card">
            <p className="brief-card-title">
              {c.place} <span className="text-muted">{c.field}</span>
            </p>
            <p className="mt-2">{c.event}</p>
            <p className="mt-1 text-sm text-muted">{c.when}</p>
          </li>
        ))}
      </ul>
    ),
    education: (
      <div>
        <p className="font-medium">{education.degree}</p>
        <p className="text-muted">
          {education.school} · {education.when}
        </p>
        <p className="mt-3 max-w-[60ch]">Thesis: {education.thesis}</p>
        <p className="mt-3 text-sm text-muted">Coursework: {education.coursework.join(", ")}</p>
      </div>
    ),
    skills: (
      <dl className="brief-facts">
        {stack
          .filter((g) => audience !== "client" || g.id !== "tools")
          .map((g) => (
            <div key={g.id}>
              <dt>{g.label}</dt>
              <dd>{g.items.map((i) => (i.level ? `${i.name} (${i.level.toLowerCase()})` : i.name)).join(", ")}</dd>
            </div>
          ))}
      </dl>
    ),
    certificates: (
      <div>
        <ul className="flex flex-col gap-3">
          {certificates.map((c) => (
            <li key={c.title}>
              <a href={c.href} target="_blank" rel="noopener noreferrer" className="cert-mini flex items-center gap-4">
                <CertBadge c={c} size="sm" />
                <span>
                  <span className="block font-medium">{c.title}</span>
                  <span className="block text-sm text-muted">
                    {c.issuer}, {c.year}
                  </span>
                </span>
                <span className="sr-only"> (verify, opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <Link href="/certificates" className="link mt-5 inline-block text-sm">
          All {certificateCount} certificates
        </Link>
      </div>
    ),
  };

  return (
    <>
      <header className="flex flex-col gap-6 pb-10 md:pb-14">
        <h1 className="page-title" data-split="chars">
          Brief
        </h1>
        <p className="max-w-[40ch] text-lg leading-snug text-muted md:text-xl">The one-minute version. {current.lead}</p>
        <div data-print-hide className="flex flex-wrap items-center gap-2">
          <CvLink className="btn btn-primary pressable" />
          <SocialButtons className="hero-actions" />
          <button type="button" className="btn pressable" onClick={() => window.print()}>
            <PiPrinter aria-hidden className="size-4" />
            Print
          </button>
        </div>
      </header>

      <div data-print-hide className="sticky top-[var(--bar-h)] z-20 -mx-2 mb-10 bg-bg px-2 py-3 md:mb-14">
        <Segmented
          options={AUDIENCES.map((a) => a.label)}
          value={current.label}
          onChange={(label) => writeAudience(AUDIENCES.find((a) => a.label === label)!.id)}
          label="Show the brief for"
        />
      </div>

      {/* Who this is, for every reader. */}
      <section aria-label="Summary" className="brief-hero">
        <p className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-none tracking-[-0.03em]">{site.fullName}</p>
        <p className="mt-3 text-lg">{site.role}</p>
        <p className="text-muted">
          {site.location} · Open to OJT and freelance work
        </p>
      </section>

      <div key={audience} className="brief-swap">
        {ORDER[audience].map((id) => (
          <section key={id} aria-labelledby={`brief-${id}`} className="brief-section">
            <h2 id={`brief-${id}`} className="brief-label">
              {LABELS[id]}
            </h2>
            <div className="min-w-0">{sections[id]}</div>
          </section>
        ))}
      </div>
    </>
  );
}
