"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { PiArrowRight, PiArrowUpRight } from "react-icons/pi";
import { Segmented, segmentedIds } from "@/components/ui/Segmented";

export type ProfileRole = { short: string; role: string; kind: string; when: string };
export type ProfileCert = { title: string; issuer: string; year: string; href: string; image?: string };
export type ProfileTools = { label: string; names: string[] };

const TABS = ["Experience", "Certificates", "Stack"] as const;
type Tab = (typeof TABS)[number];
const ID = "profile";

/**
 * The Overview's Profile: what a recruiter scans for, in one section instead of three.
 * A segmented control switches Experience, Certificates and Stack; the panel's rows rise in
 * 40ms apart on each switch (opacity only under reduced motion). Each panel ends with a way
 * to its full page.
 */
export function ProfileTabs({ roles, certs, tools }: { roles: ProfileRole[]; certs: ProfileCert[]; tools: ProfileTools[] }) {
  const [tab, setTab] = useState<Tab>("Experience");
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const rows = panel.current?.querySelectorAll("[data-row]");
    if (!rows?.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.fromTo(rows, { opacity: 0, y: reduce ? 0 : 16 }, { opacity: 1, y: 0, duration: reduce ? 0.2 : 0.5, ease: "expo.out", stagger: reduce ? 0 : 0.04, overwrite: true, clearProps: "transform" });
  }, [tab]);

  const ids = segmentedIds(ID, tab);
  const more = { Experience: ["/experience", "Full history"], Certificates: ["/certificates", "All certificates"], Stack: ["/stack", "All tools"] }[tab];

  return (
    <section aria-labelledby="profile-title" className="reveal pt-24 md:pt-32">
      <div className="section-head">
        <h2 id="profile-title" className="section-title" data-split="chars">
          Profile
        </h2>
        <Segmented options={TABS} value={tab} onChange={setTab} label="Profile" mode="tabs" idBase={ID} />
      </div>

      <div ref={panel} role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} tabIndex={0} className="mt-8 md:mt-10">
        {tab === "Experience" && (
          <ol className="flex flex-col gap-2">
            {roles.map((r) => (
              <li key={r.short} data-row>
                <Link href="/experience" className="profile-row">
                  <span className="profile-when">{r.when}</span>
                  <span className="min-w-0 flex-1">
                    <span className="ledger-item block">{r.short}</span>
                    <span className="mt-1 block text-base">{r.role}</span>
                  </span>
                  <span className="profile-kind">{r.kind}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        {tab === "Certificates" && (
          <ul className="grid gap-2 md:grid-cols-2">
            {certs.map((c) => (
              <li key={c.title} data-row>
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="profile-row">
                  {c.image && <Image src={c.image} alt="" width={64} height={64} className="size-14 shrink-0 object-contain md:size-16" />}
                  <span className="min-w-0 flex-1">
                    <span className="profile-cert block">{c.title}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {c.issuer}, {c.year}
                    </span>
                  </span>
                  <PiArrowUpRight aria-hidden className="profile-arrow size-5 shrink-0" />
                  <span className="sr-only"> (verify, opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {tab === "Stack" && (
          <dl className="flex flex-col gap-2">
            {tools.map((g) => (
              <div key={g.label} data-row className="profile-row profile-row-static">
                <dt className="profile-when">{g.label}</dt>
                <dd className="ledger-item min-w-0 flex-1">{g.names.join(", ")}</dd>
              </div>
            ))}
          </dl>
        )}

        <Link href={more[0]} className="btn pressable mt-8">
          {more[1]}
          <PiArrowRight aria-hidden data-nudge="right" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
