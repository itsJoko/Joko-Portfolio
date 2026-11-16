"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PiArrowRight } from "react-icons/pi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { WorkItem, WorkTone } from "@/content/work";

gsap.registerPlugin(useGSAP);

// Field and text colour for each drawn preview. Hue fields take the page ground as text,
// which reads on the saturated light-theme hues and on the pale dark-theme ones.
const FIELD: Record<WorkTone, string> = {
  ink: "bg-ink text-bg",
  overview: "bg-[var(--c-overview)] text-bg",
  projects: "bg-[var(--c-projects)] text-bg",
  graphics: "bg-[var(--c-graphics)] text-bg",
  playground: "bg-[var(--c-playground)] text-bg",
  surface: "bg-surface text-ink",
};

/**
 * A still for the work: its screenshot when one exists, otherwise its title card drawn in its colour.
 * `compact` drops the card's words, for thumbnails too small to hold them.
 */
export function WorkStill({ item, className = "", compact = false }: { item: WorkItem; className?: string; compact?: boolean }) {
  if (item.image) {
    const alt = `${item.title} screenshot`;
    const sizes = compact ? "6rem" : "(min-width: 1024px) 40vw, 100vw";
    if (item.imageDark) {
      return (
        <>
          <Image src={item.image} alt={alt} fill sizes={sizes} className={`object-cover dark:hidden ${className}`} />
          <Image src={item.imageDark} alt={alt} fill sizes={sizes} className={`hidden object-cover dark:block ${className}`} />
        </>
      );
    }
    return <Image src={item.image} alt={alt} fill sizes={sizes} className={`object-cover ${className}`} />;
  }
  return (
    <div role="img" aria-label={`${item.title} title card`} className={`flex flex-col justify-end p-6 ${FIELD[item.tone]} ${className}`}>
      {!compact && (
        <span>
          <span className="mb-3 block font-display text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.9] tracking-[-0.04em]">
            {item.title}
          </span>
          <span className="block max-w-[24ch] text-base leading-snug">{item.summary}</span>
        </span>
      )}
    </div>
  );
}

/** Fine pointer and motion allowed: the only case where loops play. */
function useMotionVideo() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const set = () => setOk(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return ok;
}

/**
 * Selected work as a stage. Big names on the left; from lg a framed still on the right wipes to the
 * project under the pointer or focus (in the direction the pointer moved), plays its loop when one
 * exists, and an info strip under it gives the one-line summary and a way into the project's sheet.
 * Phones have no hover, so each row carries its own thumbnail instead.
 */
export function WorkIndex({ items }: { items: WorkItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(items[0]?.id);
  const activeIndex = useRef(0);
  const topLayer = useRef(1);
  const playLoops = useMotionVideo();
  const current = items.find((i) => i.id === active) ?? items[0];

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scrollTrigger = { trigger: root.current, start: "top 80%", once: true };
      if (reduce) {
        gsap.from(q(".work-line, .work-stage"), { opacity: 0, duration: 0.4, scrollTrigger });
        return;
      }
      gsap.from(q(".work-line-inner"), { yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.06, scrollTrigger });
      gsap.from(q(".work-line-meta"), { opacity: 0, duration: 0.6, delay: 0.3, stagger: 0.06, scrollTrigger });
      gsap.fromTo(q(".work-stage-media"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.out", clearProps: "clipPath", scrollTrigger });
      gsap.from(q(".work-stage-info"), { opacity: 0, y: 16, duration: 0.8, delay: 0.35, ease: "expo.out", scrollTrigger });
    },
    { scope: root },
  );

  const activate = (item: WorkItem, index: number) => {
    if (item.id === active) return;
    setActive(item.id);
    const from = index > activeIndex.current ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)";
    activeIndex.current = index;

    const still = root.current?.querySelector<HTMLElement>(`[data-still="${item.id}"]`);
    if (!still) return;
    still.style.zIndex = String(++topLayer.current);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(still, { opacity: 0 }, { opacity: 1, duration: 0.2, overwrite: true });
      return;
    }
    gsap.fromTo(still, { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "expo.out", overwrite: true });
    gsap.fromTo(still.firstElementChild, { scale: 1.12 }, { scale: 1, duration: 0.9, ease: "expo.out", overwrite: true });
    // The info strip follows: the new line slides up as the old one gives way.
    if (info.current) gsap.fromTo(info.current.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: 0.04, overwrite: true });
  };

  return (
    <div ref={root} className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <ul className="flex flex-col gap-4 lg:col-span-5 lg:gap-1">
        {items.map((item, i) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`work-line ${item.id === active ? "is-active" : ""}`}
              data-cursor="View"
              onPointerEnter={() => activate(item, i)}
              onFocus={() => activate(item, i)}
            >
              <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl lg:hidden">
                <WorkStill item={item} compact className="absolute inset-0" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="work-line-mask block overflow-hidden pb-[0.12em] pr-[0.08em]">
                  <span className="work-line-name work-line-inner block">{item.title}</span>
                </span>
                <span className="work-line-meta block text-base text-muted lg:hidden">{item.kind}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="work-stage hidden lg:col-span-7 lg:block">
        <div aria-hidden className="rounded-3xl bg-surface p-3">
          <div className="work-stage-media relative aspect-video overflow-hidden rounded-2xl">
            {items.map((item, i) => (
              <div key={item.id} data-still={item.id} className="absolute inset-0 overflow-hidden" style={{ zIndex: i === 0 ? 1 : 0 }}>
                <div className="absolute inset-0">
                  <WorkStill item={item} className="absolute inset-0" />
                  {playLoops && item.loop && item.id === active && (
                    <video src={item.loop} autoPlay muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Left-aligned so the corner, where Folio stands, stays clear. */}
        <div ref={info} className="work-stage-info mt-6 flex flex-col items-start gap-5 px-1">
          <div className="min-w-0">
            <p className="text-sm text-muted">{current?.kind}</p>
            <p className="mt-1.5 max-w-[48ch] text-lg leading-snug">{current?.summary}</p>
          </div>
          {current && (
            <Link href={current.href} className="btn pressable">
              Open project
              <PiArrowRight aria-hidden data-nudge="right" className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
