"use client";

import { useEffect, useState } from "react";
import type { AudienceId } from "@/content/brief";

/** Fired by the Brief's "Tour" button to (re)start the tour. */
export const TOUR_START = "brief-tour:start";

type Step = { target: string; text: string };

const STEP_MS = 2600; // reading time per stop
const MOVE_MS = 700; // the glide between stops
const GREET_KEY = "brief-greeted";

// Lines Joko's cursor says at each stop. The middle two follow the view.
const MIDDLE: Record<AudienceId, [Step, Step]> = {
  recruiter: [
    { target: '[data-tour="section-availability"]', text: "Open to OJT and freelance. Here's how to reach me." },
    { target: '[data-tour="section-experience"]', text: "My experience, newest first." },
  ],
  manager: [
    { target: '[data-tour="section-work"]', text: "Start here: what I built and my part in it." },
    { target: '[data-tour="section-craft"]', text: "How I work, in three lines." },
  ],
  client: [
    { target: '[data-tour="section-services"]', text: "What I can make for you, each with real proof." },
    { target: '[data-tour="section-work"]', text: "Projects you can open and judge yourself." },
  ],
};

const stepsFor = (audience: AudienceId): Step[] => [
  { target: '[data-tour="switch"]', text: "Pick who you are. The page reorders for you." },
  { target: '[data-tour="summary"]', text: "The short version: designer and front-end developer." },
  ...MIDDLE[audience],
  { target: '[data-tour="actions"]', text: "Grab my CV or print this page. Thanks for stopping by!" },
];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const corner = () => ({ x: window.innerWidth - 72, y: window.innerHeight - 96 });

/**
 * A guided cursor for the Brief, like a collaborator's cursor in a design file: a pointer in the
 * section hue with a "Joko" tag and a speech bubble. First visit per session it glides in and
 * offers a tour; the tour visits five spots (about 2.6 s each), ringing each one. Skip, Escape or
 * ignoring the greeting ends it; the header's Tour button replays it. Reduced motion: it jumps.
 */
export function BriefTour({ audience }: { audience: AudienceId }) {
  const [phase, setPhase] = useState<"idle" | "greet" | "tour">("idle");
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const steps = stepsFor(audience);
  const target = phase === "greet" ? '[data-tour="summary"]' : phase === "tour" ? steps[step]?.target : undefined;

  // Greet once per session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(GREET_KEY)) return;
    } catch {
      // Storage blocked: greet anyway, it only happens on this load.
    }
    const t = setTimeout(() => {
      // Marked only when the greeting really shows (React runs effects twice in development).
      try {
        sessionStorage.setItem(GREET_KEY, "1");
      } catch {}
      setPos((p) => p ?? corner());
      setPhase("greet");
    }, 900);
    return () => clearTimeout(t);
  }, []);

  // An unanswered greeting fades away on its own.
  useEffect(() => {
    if (phase !== "greet") return;
    const t = setTimeout(() => setPhase("idle"), 10_000);
    return () => clearTimeout(t);
  }, [phase]);

  // The header's Tour button.
  useEffect(() => {
    const start = () => {
      setPos((p) => p ?? corner());
      setStep(0);
      setPhase("tour");
    };
    window.addEventListener(TOUR_START, start);
    return () => window.removeEventListener(TOUR_START, start);
  }, []);

  // Go to the current stop: bring it into view (tour only), ring it, and point at it.
  useEffect(() => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    const motion = !reduced();
    if (phase === "tour") el.scrollIntoView({ block: "center", behavior: motion ? "smooth" : "auto" });
    el.setAttribute("data-tour-active", "");
    const place = () => {
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + Math.min(r.width * 0.25, 140), 8), window.innerWidth - 48);
      const y = Math.min(Math.max(r.top + 18, 8), window.innerHeight - 48);
      setPos({ x, y });
    };
    // While the page scrolls, follow the stop once per frame.
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const t = setTimeout(place, phase === "tour" && motion ? 450 : 0);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(frame);
      el.removeAttribute("data-tour-active");
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [target, phase]);

  // Advance through the stops, then leave.
  useEffect(() => {
    if (phase !== "tour") return;
    const t = setTimeout(() => {
      if (step < steps.length - 1) setStep(step + 1);
      else setPhase("idle");
    }, STEP_MS + MOVE_MS);
    return () => clearTimeout(t);
  }, [phase, step, steps.length]);

  // Escape ends it.
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhase("idle");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (!pos) return null;
  const visible = phase !== "idle";
  // The bubble sits just right of the arrow, slid left as far as needed to stay on screen.
  const bubbleW = Math.min(272, window.innerWidth - 32);
  const bubbleLeft = Math.min(20, window.innerWidth - 16 - bubbleW - pos.x);

  return (
    <div
      className="tour"
      data-visible={visible}
      aria-hidden={!visible}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      data-print-hide
    >
      <svg aria-hidden viewBox="0 0 24 24" className="tour-arrow">
        <path d="M3 2.5 20.5 10l-7.4 2.6L10.5 20z" />
      </svg>
      <span aria-hidden className="tour-tag">
        Joko
      </span>
      <div className="tour-bubble" role="status" aria-live="polite" style={{ left: bubbleLeft, width: bubbleW }}>
        {phase === "greet" && (
          <>
            <p>Hi, I&apos;m Joko. Want a quick tour?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="tour-btn tour-btn-primary pressable"
                onClick={() => {
                  setStep(0);
                  setPhase("tour");
                }}
              >
                Show me
              </button>
              <button type="button" className="tour-btn pressable" onClick={() => setPhase("idle")}>
                No thanks
              </button>
            </div>
          </>
        )}
        {phase === "tour" && steps[step] && (
          <>
            <p key={step} className="tour-line">
              {steps[step].text}
            </p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm opacity-60">
                {step + 1} of {steps.length}
              </span>
              <button type="button" className="tour-btn pressable" onClick={() => setPhase("idle")}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
