"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PiArrowUpRight, PiCaretLeft, PiCaretRight, PiX } from "react-icons/pi";
import { Chip } from "@/components/ui";
import type { Project } from "@/content/projects";
import { work, type WorkItem } from "@/content/work";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Same `sizes` on the card and under the sheet's sharp layer, so the sheet starts from the
// picture the browser already has and the flight never shows an empty frame.
const CARD_SIZES = "(min-width: 768px) 45vw, 100vw";
const SHEET_SIZES = "(min-width: 1280px) 1200px, 100vw";

const stillOf = (slug: string) => work.find((w) => w.id === slug);
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The project's thumbnail, or its drawn title card until one exists. */
function Still({ item, sizes, className = "" }: { item?: WorkItem; sizes: string; className?: string }) {
  if (!item) return null;
  if (item.image) return <Image src={item.image} alt="" fill sizes={sizes} className={`object-cover ${className}`} />;
  return (
    <span className={`flex items-end bg-surface p-6 font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] ${className}`}>
      {item.title}
    </span>
  );
}

/**
 * Projects as framed thumbnails with only a name and a kind. Tapping one flies its thumbnail into a
 * full-screen sheet with the details (role, result, stack, links); closing flies it back to its card.
 * `/projects#slug` opens that project's sheet, so the palette and the Overview can link straight to it.
 */
export function ProjectGrid({ projects }: { projects: Project[] }) {
  const root = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const opening = useRef(false);
  // The open flight, so Close can cut it short; `closing` stops a second close or open mid-exit.
  const openTl = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);
  const closing = useRef(false);

  const project = index === null ? null : projects[index];

  // Cards wipe up through their frames as they scroll in, the image settling from 1.12.
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (reduced()) {
        gsap.from(q(".project-card"), { opacity: 0, duration: 0.4, stagger: 0.04 });
        return;
      }
      gsap.set(q(".project-media"), { clipPath: "inset(100% 0% 0% 0%)" });
      gsap.set(q(".project-settle"), { scale: 1.12 });
      gsap.set(q(".project-name-inner"), { yPercent: 110 });
      ScrollTrigger.batch(q(".project-card"), {
        start: "top 88%",
        once: true,
        onEnter: (cards) => {
          const pick = (sel: string) => cards.map((c) => c.querySelector(sel));
          gsap.to(pick(".project-media"), { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.out", stagger: 0.08 });
          gsap.to(pick(".project-settle"), { scale: 1, duration: 1.4, ease: "expo.out", stagger: 0.08, clearProps: "transform" });
          gsap.to(pick(".project-name-inner"), { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.08, delay: 0.15 });
        },
      });
    },
    { scope: root },
  );

  const frameOf = (slug: string) => document.querySelector<HTMLElement>(`#${CSS.escape(slug)} .project-frame`);
  const onScreen = (el: HTMLElement | null) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  const open = useCallback((i: number) => {
    if (closing.current) return;
    opening.current = true;
    setIndex(i);
  }, []);

  // Opening: the thumbnail flies from its card into the sheet while the ground comes up behind it,
  // then the title rises through its mask and the details follow.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d || index === null) return;
    const slug = projects[index].slug;
    if (!opening.current) {
      // Stepping between projects: swap in place, back to the top.
      d.scrollTop = 0;
      history.replaceState(null, "", `#${slug}`);
      return;
    }
    opening.current = false;
    if (!d.open) d.showModal();
    // showModal focuses the first button; start on Close instead.
    d.querySelector<HTMLElement>("[data-sheet-close]")?.focus();
    d.scrollTop = 0;
    history.replaceState(null, "", `#${slug}`);

    const q = gsap.utils.selector(d);
    if (reduced()) {
      openTl.current = gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" });
      return;
    }
    const media = q(".sheet-media")[0] as HTMLElement;
    const from = frameOf(slug);
    const tl = gsap.timeline();
    openTl.current = tl;
    tl.fromTo(q(".sheet-ground"), { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, 0);
    if (onScreen(from)) {
      const a = from!.getBoundingClientRect();
      const b = media.getBoundingClientRect();
      tl.fromTo(
        media,
        { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: "0 0" },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.9, ease: "expo.out", clearProps: "transform" },
        0,
      );
    } else {
      tl.fromTo(media, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", clearProps: "transform" }, 0.1);
    }
    tl.fromTo(q(".sheet-title-inner"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out" }, 0.25);
    tl.fromTo(q("[data-sheet-in]"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 }, 0.35);
    tl.fromTo(q(".sheet-bar"), { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0.2);
    // Stepping or leaving mid-flight lands the sheet in its open state instead of half-drawn.
    return () => {
      tl.progress(1).kill();
    };
  }, [index, projects]);

  // Closing is quicker than opening: details drop away, the thumbnail flies home to its card.
  const close = useCallback(() => {
    const d = dialog.current;
    if (!d || index === null || closing.current) return;
    // Closing mid-flight: land the opening first, then fly back from there.
    openTl.current?.progress(1).kill();
    openTl.current = null;
    const finish = () => {
      d.close();
      gsap.set([d, ...d.querySelectorAll(".sheet-media, .sheet-ground, [data-sheet-in], .sheet-title-inner, .sheet-bar")], { clearProps: "all" });
      closing.current = false;
      history.replaceState(null, "", window.location.pathname);
      setIndex(null);
    };
    closing.current = true;
    if (reduced()) {
      gsap.to(d, { opacity: 0, duration: 0.15, ease: "none", onComplete: finish });
      return;
    }
    const q = gsap.utils.selector(d);
    const media = q(".sheet-media")[0] as HTMLElement;
    const to = frameOf(projects[index].slug);
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(q("[data-sheet-in], .sheet-title-inner, .sheet-bar"), { opacity: 0, duration: 0.15, ease: "power1.out" }, 0);
    if (onScreen(to)) {
      const a = to!.getBoundingClientRect();
      const b = media.getBoundingClientRect();
      tl.to(
        media,
        { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: "0 0", duration: 0.55, ease: "expo.inOut" },
        0,
      );
    } else {
      tl.to(media, { opacity: 0, y: 24, duration: 0.25, ease: "power2.out" }, 0);
    }
    tl.to(q(".sheet-ground"), { opacity: 0, duration: 0.35, ease: "power2.inOut" }, 0.2);
  }, [index, projects]);

  const step = (dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + projects.length) % projects.length));

  // Deep links: /projects#slug opens that sheet on arrival and whenever the hash changes.
  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      const i = projects.findIndex((p) => p.slug === slug);
      if (i >= 0 && !dialog.current?.open) open(i);
    };
    const frame = requestAnimationFrame(fromHash);
    window.addEventListener("hashchange", fromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [projects, open]);

  const link = project?.links[0];
  const still = project ? stillOf(project.slug) : undefined;

  return (
    <>
      <ul ref={root} className="grid gap-x-6 gap-y-14 md:grid-cols-2 md:gap-y-20 xl:gap-x-8">
        {projects.map((p, i) => (
          <li key={p.slug} id={p.slug} className="project-anchor project-card scroll-mt-16">
            <button
              type="button"
              onClick={() => open(i)}
              aria-haspopup="dialog"
              data-cursor="View"
              className="project-open block w-full text-left"
            >
              <span className="project-frame block rounded-3xl bg-surface p-2.5 md:p-3">
                <span className="project-media relative block aspect-video overflow-hidden rounded-2xl">
                  <span className="project-zoom absolute inset-0 block">
                    <span className="project-settle absolute inset-0 block">
                      <Still item={stillOf(p.slug)} sizes={CARD_SIZES} className="absolute inset-0" />
                    </span>
                  </span>
                </span>
              </span>
              <span className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1">
                <span className="block overflow-hidden pb-[0.08em]">
                  <h2 className="project-name-inner project-card-name block">{p.title}</h2>
                </span>
                <span className="text-base text-muted">{p.kind}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-labelledby="sheet-title"
        data-cursor-keep
        className="project-sheet"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <div className="sheet-ground" aria-hidden />
        {project && (
          <div className="relative mx-auto max-w-[1200px] px-4 pb-24 md:px-8">
            <div className="sheet-bar sticky top-0 z-10 -mx-4 flex items-center justify-between gap-4 bg-bg px-4 py-4 md:-mx-8 md:px-8">
              <p className="text-sm text-muted">
                {(index ?? 0) + 1} of {projects.length}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => step(-1)} aria-label="Previous project" className="btn pressable !p-3">
                  <PiCaretLeft aria-hidden data-nudge="left" className="size-5" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next project" className="btn pressable !p-3">
                  <PiCaretRight aria-hidden data-nudge="right" className="size-5" />
                </button>
                <button type="button" data-sheet-close onClick={close} aria-label="Close" className="btn btn-primary pressable !p-3">
                  <PiX aria-hidden data-nudge="turn" className="size-5" />
                </button>
              </div>
            </div>

            <div className="sheet-media rounded-3xl bg-surface p-2.5 md:p-3">
              <div className="relative aspect-video overflow-hidden rounded-2xl">
                <Still item={still} sizes={CARD_SIZES} className="absolute inset-0" />
                <Still item={still} sizes={SHEET_SIZES} className="absolute inset-0" />
              </div>
            </div>

            <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-7">
                <span className="block overflow-hidden pb-[0.08em]">
                  <h2 id="sheet-title" className="sheet-title-inner sheet-title block">
                    {project.title}
                  </h2>
                </span>
                <p data-sheet-in className="mt-3 text-lg text-muted">
                  {project.kind}
                </p>
                <p data-sheet-in className="mt-8 max-w-[34ch] text-[clamp(1.25rem,2vw,1.75rem)] leading-snug">
                  {project.summary}
                </p>
              </div>

              <div className="lg:col-span-5 lg:pt-4">
                <dl className="flex flex-col gap-6 text-base">
                  <div data-sheet-in>
                    <dt className="text-sm text-muted">Role</dt>
                    <dd className="mt-1.5 leading-relaxed">{project.role}</dd>
                  </div>
                  <div data-sheet-in>
                    <dt className="text-sm text-muted">Result</dt>
                    <dd className="mt-1.5 leading-relaxed">{project.result}</dd>
                  </div>
                  {project.stack.length > 0 && (
                    <div data-sheet-in>
                      <dt className="text-sm text-muted">Built with</dt>
                      <dd className="mt-2.5 flex flex-wrap gap-1.5">
                        {project.stack.map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
                {link && (
                  <div data-sheet-in className="mt-10">
                    {link.href ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`btn pressable ${project.highlight ? "btn-primary" : ""}`}
                      >
                        {link.label}
                        <PiArrowUpRight aria-hidden data-nudge="out" className="size-4" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-sm text-muted">[Add link: {link.label}]</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
