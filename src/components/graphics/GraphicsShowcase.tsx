"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PiCaretLeft, PiCaretRight, PiX } from "react-icons/pi";
import { Segmented } from "@/components/ui/Segmented";
import type { GraphicCategory, GraphicCollection } from "@/content/graphics";

gsap.registerPlugin(useGSAP);

type Tab = "All" | GraphicCategory;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The brand's fold: a diagonal edge leaning down-left. `a` is where it meets the top edge;
// 130% is fully off to the right, 0% covers the screen.
const fold = (a: number) => `polygon(${a}% 0%, 200% 0%, 200% 100%, ${a - 30}% 100%)`;

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

/**
 * Graphic design work as collections. Tabs filter a masonry of covers at their real shapes; a cover
 * opens its collection in a full-screen sheet, Behance-style: the title block, then every piece in
 * sections. The sheet arrives on the brand's diagonal fold. `/graphics#slug` opens a collection.
 */
export function GraphicsShowcase({ collections, categories }: { collections: GraphicCollection[]; categories: GraphicCategory[] }) {
  const tabs = useMemo<Tab[]>(() => ["All", ...categories.filter((c) => collections.some((x) => x.category === c))], [categories, collections]);
  const [tab, setTab] = useState<Tab>("All");
  const shown = tab === "All" ? collections : collections.filter((c) => c.category === tab);

  const grid = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const opening = useRef(false);
  const closing = useRef(false);
  const openTl = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);
  const current = index === null ? null : collections[index];

  // Covers rise in as they scroll into view, and again, quickly, whenever the tab changes.
  const firstRun = useRef(true);
  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".gx-card", grid.current);
      if (reduced()) {
        gsap.from(items, { opacity: 0, duration: 0.3, stagger: 0.02 });
        return;
      }
      if (firstRun.current) {
        firstRun.current = false;
        gsap.set(items, { clipPath: "inset(100% 0% 0% 0%)" });
        gsap.set(items.map((i) => i.querySelector(".gx-settle")), { scale: 1.12 });
        const io = new IntersectionObserver(
          (entries) => {
            const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
            if (!seen.length) return;
            seen.forEach((el) => io.unobserve(el));
            gsap.to(seen, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "expo.out", stagger: 0.07 });
            gsap.to(seen.map((i) => i.querySelector(".gx-settle")), { scale: 1, duration: 1.3, ease: "expo.out", stagger: 0.07, clearProps: "transform" });
          },
          { rootMargin: "0px 0px -10% 0px" },
        );
        items.forEach((i) => io.observe(i));
        return () => io.disconnect();
      }
      gsap.fromTo(items, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.035, clearProps: "transform,opacity,clipPath" });
    },
    { scope: grid, dependencies: [tab] },
  );

  const open = useCallback((i: number) => {
    if (closing.current) return;
    opening.current = true;
    setIndex(i);
  }, []);

  // Opening: the blue fold sweeps across, the ground follows it, then the title and pieces rise.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d || index === null) return;
    const slug = collections[index].slug;
    d.scrollTop = 0;
    history.replaceState(null, "", `#${slug}`);
    const q = gsap.utils.selector(d);
    if (!opening.current) {
      if (!reduced()) gsap.fromTo(q(".gx-in"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.04 });
      return;
    }
    opening.current = false;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>("[data-sheet-close]")?.focus();
    if (reduced()) {
      openTl.current = gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" });
      return;
    }
    const tl = gsap.timeline();
    openTl.current = tl;
    tl.fromTo(q(".gx-fold"), { clipPath: fold(130) }, { clipPath: fold(0), duration: 0.6, ease: "expo.inOut" }, 0);
    tl.fromTo(q(".gx-ground"), { clipPath: fold(130) }, { clipPath: fold(0), duration: 0.6, ease: "expo.inOut" }, 0.12);
    tl.fromTo(q(".gx-title-inner"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out" }, 0.5);
    tl.fromTo(q(".gx-bar, .gx-in"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.05 }, 0.55);
    return () => {
      tl.progress(1).kill();
    };
  }, [index, collections]);

  // Closing is quicker: the content drops, the ground folds away to the left.
  const close = useCallback(() => {
    const d = dialog.current;
    if (!d || index === null || closing.current) return;
    openTl.current?.progress(1).kill();
    openTl.current = null;
    closing.current = true;
    const finish = () => {
      d.close();
      gsap.set([d, ...d.querySelectorAll(".gx-fold, .gx-ground, .gx-bar, .gx-in, .gx-title-inner")], { clearProps: "all" });
      closing.current = false;
      history.replaceState(null, "", window.location.pathname);
      setIndex(null);
    };
    if (reduced()) {
      gsap.to(d, { opacity: 0, duration: 0.15, ease: "none", onComplete: finish });
      return;
    }
    const q = gsap.utils.selector(d);
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(q(".gx-bar, .gx-in, .gx-title-inner"), { opacity: 0, duration: 0.15, ease: "power1.out" }, 0);
    // Folding away: the edge keeps travelling left until nothing is covered.
    tl.to(q(".gx-ground"), { clipPath: "polygon(-30% 0%, -30% 0%, -60% 100%, -60% 100%)", duration: 0.45, ease: "expo.inOut" }, 0.05);
    tl.to(q(".gx-fold"), { clipPath: "polygon(-30% 0%, -30% 0%, -60% 100%, -60% 100%)", duration: 0.45, ease: "expo.inOut" }, 0.12);
  }, [index]);

  const step = (dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + collections.length) % collections.length));

  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      const i = collections.findIndex((c) => c.slug === slug);
      if (i >= 0 && !dialog.current?.open) open(i);
    };
    const frame = requestAnimationFrame(fromHash);
    window.addEventListener("hashchange", fromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [collections, open]);

  return (
    <>
      <Segmented options={tabs} value={tab} onChange={setTab} label="Filter graphics by category" className="mb-10 md:mb-14" />

      <ul ref={grid} className="gx-masonry">
        {shown.map((c) => {
          const i = collections.indexOf(c);
          return (
            <li key={c.slug} id={c.slug} className="gx-card mb-8 break-inside-avoid md:mb-10">
              <button type="button" onClick={() => open(i)} aria-haspopup="dialog" data-cursor="Open" className="gx-open block w-full text-left">
                <span className="relative block overflow-hidden rounded-2xl bg-surface" style={{ aspectRatio: `${c.cover.width} / ${c.cover.height}` }}>
                  <span className="gx-zoom absolute inset-0 block">
                    <span className="gx-settle absolute inset-0 block">
                      <Image src={c.cover.src} alt="" fill sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 50vw" className="object-cover" />
                    </span>
                  </span>
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-3 px-0.5">
                  <span className="gx-name">{c.title}</span>
                  <span className="shrink-0 text-sm text-muted">{c.count}</span>
                </span>
                <span className="block px-0.5 text-sm text-muted">{c.category}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialog}
        aria-labelledby="gx-title"
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
        <div className="gx-fold" aria-hidden />
        <div className="gx-ground" aria-hidden />
        {current && (
          <div className="relative mx-auto max-w-[1200px] px-4 pb-24 md:px-8">
            <div className="gx-bar sticky top-0 z-10 -mx-4 flex items-center justify-between gap-4 bg-bg px-4 py-4 md:-mx-8 md:px-8">
              <p className="text-sm text-muted">
                {(index ?? 0) + 1} of {collections.length}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => step(-1)} aria-label="Previous collection" className="btn pressable !p-3">
                  <PiCaretLeft aria-hidden data-nudge="left" className="size-5" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next collection" className="btn pressable !p-3">
                  <PiCaretRight aria-hidden data-nudge="right" className="size-5" />
                </button>
                <button type="button" data-sheet-close onClick={close} aria-label="Close" className="btn btn-primary pressable !p-3">
                  <PiX aria-hidden data-nudge="turn" className="size-5" />
                </button>
              </div>
            </div>

            <header className="grid gap-8 pt-8 pb-12 md:pt-14 md:pb-20 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <span className="block overflow-hidden pb-[0.08em]">
                  <h2 id="gx-title" className="gx-title-inner sheet-title block">
                    {current.title}
                  </h2>
                </span>
                <p className="gx-in mt-6 max-w-[40ch] text-[clamp(1.25rem,2vw,1.75rem)] leading-snug">{current.summary}</p>
              </div>
              <dl className="gx-in flex gap-10 text-base lg:col-span-4 lg:flex-col lg:gap-5 lg:pt-4">
                <div>
                  <dt className="text-sm text-muted">Category</dt>
                  <dd className="mt-1">{current.category}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Pieces</dt>
                  <dd className="mt-1">{current.count}</dd>
                </div>
              </dl>
            </header>

            <div className="flex flex-col gap-14 md:gap-20">
              {current.sections.map((s, si) => (
                <section key={si} aria-label={s.label ?? current.title} className="gx-in">
                  {s.label && <h3 className="mb-5 font-display text-2xl font-semibold tracking-[-0.02em] md:mb-6">{s.label}</h3>}
                  <div className={`grid gap-3 md:gap-4 ${COLS[s.cols] ?? COLS[2]}`}>
                    {s.images.map((img) => (
                      <figure key={img.src} className="overflow-hidden rounded-2xl bg-surface">
                        <Image
                          src={img.src}
                          alt={img.alt}
                          width={img.width}
                          height={img.height}
                          sizes={s.cols === 1 ? "(min-width: 1280px) 1200px, 100vw" : `(min-width: 1024px) ${Math.round(100 / s.cols)}vw, 50vw`}
                          className="block h-auto w-full"
                        />
                      </figure>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
