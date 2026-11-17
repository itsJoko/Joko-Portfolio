"use client";

import { useState } from "react";
import { PiArrowUpRight } from "react-icons/pi";
import { Segmented } from "@/components/ui/Segmented";
import { CertBadge } from "./CertBadge";
import { CERT_FIELDS, FEATURED_CERTS, certField, type Certificate } from "@/content/certificates";

type Filter = "All" | (typeof CERT_FIELDS)[number];

function Row({ c }: { c: Certificate }) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-5">
        <CertBadge c={c} />
        <span className="min-w-0">
          <span className="cert-title">{c.title}</span>
          <span className="mt-2 block text-base text-muted">
            {c.issuer}, {c.year}
          </span>
        </span>
      </span>
      {c.href ? (
        <span aria-hidden className="cert-arrow">
          <PiArrowUpRight />
        </span>
      ) : (
        <span className="shrink-0 text-sm text-muted">[Add link]</span>
      )}
    </>
  );
  return c.href ? (
    <a href={c.href} target="_blank" rel="noopener noreferrer" className="cert-row">
      {body}
      <span className="sr-only"> (verify, opens in a new tab)</span>
    </a>
  ) : (
    <div className="cert-row">{body}</div>
  );
}

/**
 * Certificates as one consistent set: a featured row of the three that matter most, then every
 * certificate, filtered by field. Each badge is drawn in code (CertBadge), so every issuer reads
 * as one set.
 */
export function CertificateShelf({ certificates }: { certificates: Certificate[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const featured = FEATURED_CERTS.map((t) => certificates.find((c) => c.title === t)).filter((c): c is Certificate => !!c);
  const fields = CERT_FIELDS.filter((f) => certificates.some((c) => certField(c.title) === f));
  const options: Filter[] = ["All", ...fields];
  const shown = filter === "All" ? certificates : certificates.filter((c) => certField(c.title) === filter);

  return (
    <>
      {featured.length > 0 && (
        <section aria-labelledby="featured-certs" className="mb-20 md:mb-28">
          <h2 id="featured-certs" className="sr-only">
            Featured
          </h2>
          <ul className="grid gap-2 md:grid-cols-3">
            {featured.map((c) => (
              <li key={c.title}>
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="cert-card">
                  <CertBadge c={c} size="lg" />
                  <span className="mt-auto block pt-10">
                    <span className="block text-sm text-muted">{certField(c.title)}</span>
                    <span className="cert-card-title mt-1 block">{c.title}</span>
                    <span className="mt-2 block text-base text-muted">
                      {c.issuer}, {c.year}
                    </span>
                  </span>
                  <span className="sr-only"> (verify, opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="All certificates">
        <Segmented options={options} value={filter} onChange={setFilter} label="Filter certificates by field" className="mb-8 md:mb-10" />
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <li key={`${c.title}-${c.date ?? c.year}`}>
              <Row c={c} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
