"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const STORAGE_KEY = "intro-seen";
const FILL_S = 1.6; // the count and the fill, together
/** Fired on window when the intro has left (or was never shown), so the hero can start. */
export const INTRO_DONE = "intro:done";

/** True once the intro has finished or will not play in this session. */
export function introFinished() {
  const root = document.documentElement;
  return root.classList.contains("intro-seen") || root.dataset.introDone === "true";
}

function finish() {
  document.documentElement.dataset.introDone = "true";
  window.dispatchEvent(new Event(INTRO_DONE));
}

/**
 * First-visit loader, about two and a half seconds, once per session, skippable. Everything that moves is a
 * promoted layer moved by transform, so the huge letters are painted once, not on every frame.
 * The name is drawn as an outline (designed), then filled solid (built) while a counter
 * runs to 100; the panel then lifts away to reveal the page.
 */
export function Intro({ name }: { name: string }) {
  const [gone, setGone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const letters = name.toUpperCase().split("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Already seen (or reduced motion): CSS hid it before paint.
    if (document.documentElement.classList.contains("intro-seen")) {
      finish();
      return;
    }
    // The script has taken over: switch off the CSS safety net that hides the panel after 5 s
    // (it's there for when scripts never run). On a slow load the timeline can start near 5 s,
    // and the net used to remove the panel just as it began.
    root.style.animation = "none";
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    document.documentElement.classList.add("is-loading");

    const counter = { v: 0 };
    let shown = -1;
    let tl: gsap.core.Timeline | undefined;
    // A context so cleanup puts every element back exactly as it was (React runs this effect twice
    // in development, and the second run must start from a clean panel).
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      tl = gsap.timeline({
        paused: true,
        onComplete: () => {
          gsap.ticker.lagSmoothing(0); // back to what the smooth scroll wants
          // Unlocking scroll causes layout, so it waits until the panel has gone.
          document.documentElement.classList.remove("is-loading");
          setGone(true);
        },
      });
      // The outline is there from the first paint and stays still; only the fill and the count move.
      tl.to(
          counter,
          {
            v: 100,
            duration: FILL_S,
            ease: "power2.inOut",
            onUpdate: () => {
              const v = Math.round(counter.v);
              if (v === shown) return;
              shown = v;
              if (countRef.current) countRef.current.textContent = String(v).padStart(3, "0");
              if (statusRef.current) statusRef.current.textContent = v < 50 ? "Designing" : "Building";
            },
          },
          0.2,
        )
        // The reveal: a clipping frame slides in while its contents slide the other way, holding the letters still.
        .fromTo(q(".intro-fill"), { xPercent: -100, autoAlpha: 1 }, { xPercent: 0, duration: FILL_S, ease: "power2.inOut" }, 0.2)
        .fromTo(q(".intro-fill-inner"), { xPercent: 100 }, { xPercent: 0, duration: FILL_S, ease: "power2.inOut" }, 0.2)
        .addLabel("exit", "+=0.15") // a beat on the finished word before it leaves
        .to(q(".intro-word"), { yPercent: -40, duration: 0.7, ease: "expo.inOut" }, "exit")
        .to(root, { yPercent: -100, duration: 0.7, ease: "expo.inOut" }, "exit")
        // Let the hero start as the panel clears the top half of the screen.
        .add(finish, "exit+=0.4");
    }, root);

    const skip = () => {
      if (!tl || tl.currentLabel() === "exit" || tl.time() >= tl.labels.exit) return;
      tl.seek("exit");
    };
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    // Start once the display face is in (so the outline never draws in a fallback font), but never
    // wait more than 0.8 s for it: a slow font shouldn't keep the loader standing still.
    let cancelled = false;
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(() => {
      if (cancelled) return;
      // The smooth scroll turns GSAP's lag smoothing off. While the intro plays it goes back on:
      // a stall (the first load still parsing scripts, a tab opened in the background) would
      // otherwise jump the timeline to its end, so the counter and fill never seemed to move.
      gsap.ticker.lagSmoothing(250, 33);
      tl?.play();
    });

    return () => {
      cancelled = true;
      ctx.revert();
      gsap.ticker.lagSmoothing(0);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      document.documentElement.classList.remove("is-loading");
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={rootRef} className="intro fixed inset-0 z-50 flex flex-col justify-between bg-ink p-5 text-bg md:p-8">
      <div className="flex items-start justify-between text-sm">
        <span aria-hidden>{name}, portfolio</span>
        <button type="button" className="pressable rounded-full bg-bg/10 px-4 py-2 text-bg">
          Skip intro
        </button>
      </div>

      <div aria-hidden className="intro-word relative">
        {/* Outline: the design. */}
        <div className="intro-type intro-outline overflow-hidden">
          {letters.map((c, i) => (
            <span key={i} className="intro-char inline-block">
              {c}
            </span>
          ))}
        </div>
        {/* Fill, revealed left to right: the build. */}
        <div className="intro-fill absolute inset-0 overflow-hidden" style={{ visibility: "hidden" }}>
          <div className="intro-fill-inner intro-type overflow-hidden">
            {letters.map((c, i) => (
              <span key={i} className="intro-char inline-block">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden className="flex items-end justify-between text-sm">
        <span ref={statusRef}>Designing</span>
        <span ref={countRef} className="font-display text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-none tabular-nums">
          000
        </span>
      </div>
    </div>
  );
}
