import Link from "next/link";
import { CvLink } from "@/components/ui";
import { site } from "@/content/site";
import { FooterFold as Fold } from "./FooterFold";
import { NAV } from "./nav";
import { SOCIALS } from "./socials";

const COLOPHON = `Designed and built by ${site.name} with Next.js, three.js and GSAP. Set in Funnel.`;

function Email({ className = "" }: { className?: string }) {
  return site.email ? (
    <a href={`mailto:${site.email}`} className={`footer-email ${className}`}>
      {site.email}
    </a>
  ) : (
    <span>[Add your email]</span>
  );
}

/** CV, the Brief and the social icons on one line. */
function ContactLinks() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <CvLink label="CV" className="footer-link inline-flex items-center gap-1.5" />
      <Link href="/brief" className="footer-link">
        Brief
      </Link>
      <ul className="flex gap-2">
        {SOCIALS.filter((x) => x.external).map(({ id, label, href, icon: Icon }) => (
          <li key={id}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} className="footer-icon pressable">
              <Icon aria-hidden className="size-5" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={className}>
      {NAV.map((n) => (
        <li key={n.id}>
          <Link href={n.href} className="footer-link">
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The close: inverted colours and the name returning margin to margin.
 * Phones: Contact (open), Pages and Colophon as tap-to-open bands. Tablet: Contact, then the pages
 * in a 3 × 3 grid. Desktop: the two side by side. The colophon sits beside the copyright.
 * `overflow-clip`: at line-height 0.8 the huge name's text box runs past the footer and added empty scroll below the page.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="@container mx-3 mb-3 grid overflow-clip min-h-[80svh] grid-rows-[auto_1fr_auto] rounded-[2rem] bg-ink px-5 pb-5 pt-8 text-bg md:mx-4 md:mb-4 md:px-10 md:pt-12">
      {/* Phones */}
      <div className="flex flex-col gap-2 md:hidden">
        <Fold title="Contact" defaultOpen>
          <Email className="text-xl" />
          <div className="mt-4">
            <ContactLinks />
          </div>
        </Fold>
        <Fold title="Pages">
          <PageLinks className="grid grid-cols-2 gap-x-6 gap-y-2" />
        </Fold>
        <Fold title="Colophon">
          <p className="footer-quiet max-w-[34ch]">{COLOPHON}</p>
        </Fold>
      </div>

      {/* Tablet and desktop */}
      <div className="hidden gap-x-16 gap-y-10 md:grid xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="footer-quiet text-sm">Get in touch</p>
          <Email className="mt-2 block text-[clamp(1.5rem,2.6vw,2.25rem)]" />
          <div className="mt-6">
            <ContactLinks />
          </div>
        </div>
        <nav aria-label="Footer">
          <p className="footer-quiet text-sm">Pages</p>
          <PageLinks className="mt-3 grid grid-cols-3 gap-x-10 gap-y-2" />
        </nav>
      </div>

      <div aria-hidden />
      <div>
        <p aria-hidden className="footer-mark">
          {site.name.toUpperCase()}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
          <p>
            © {year} {site.name}
          </p>
          <p className="footer-quiet hidden md:block">{COLOPHON}</p>
        </div>
      </div>
    </footer>
  );
}
