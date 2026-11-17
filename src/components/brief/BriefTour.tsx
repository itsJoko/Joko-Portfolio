"use client";

import { useEffect, useRef, useState } from "react";
import type { AudienceId } from "@/content/brief";
import { GuideCursor, besides, bringIntoView, pointAt, readMs } from "./GuideCursor";

/** Fired by the Brief's "Tour" button to (re)start the tour. */
export const TOUR_START = "brief-tour:start";
/** Set once a visitor has opened the Brief, so the Overview stops pointing at it. */
export const BRIEF_SEEN = "brief-seen";

type Step = { target: string; text: string };

const MOVE_MS = 700; // the glide between stops
const GREET_KEY = "brief-greeted";

// What Joko's cursor says at each stop: few words, so each one is read at a glance.
const MIDDLE: Record<AudienceId, [Step, Step]> = {
  recruiter: [
    { target: '[data-tour="section-availability"]', text: "Open to OJT and freelance." },
    { target: '[data-tour="section-experience"]', text: "Experience, newest first." },
  ],
  manager: [
    { target: '[data-tour="section-work"]', text: "Start here: what I built." },
    { target: '[data-tour="section-craft"]', text: "How I work, in three lines." },
  ],
  client: [
    { target: '[data-tour="section-services"]', text: "What I can make for you." },
    { target: '[data-tour="section-work"]', text: "Real projects. Open any." },
  ],
};

const stepsFor = (audience: AudienceId): Step[] => [
  { target: '[data-tour="switch"]', text: "Pick who you are. The page reorders." },
  { target: '[data-tour="summary"]', text: "The short version of me." },
  ...MIDDLE[audience],
  { target: '[data-tour="actions"]', text: "Grab my CV. Thanks for stopping by!" },
];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The Brief's guided tour. First visit per session Joko's cursor glides in and offers it; the tour
 * visits five stops, each scrolled to just above the middle of the screen, the line
 * staying up as long as it takes to read. Skip, Escape or ignoring the greeting ends it; the
 * header's Tour button replays it. Reduced motion: the cursor jumps.
 */
export function BriefTour({ audience }: { audience: AudienceId }) {
  const [phase, setPhase] = useState<"idle" | "greet" | "tour">("idle");
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const placed = useRef(false);
  const steps = stepsFor(audience);
  const target = phase === "greet" ? '[data-tour="summary"]' : phase === "tour" ? steps[step]?.target : undefined;

  // Seen: the Overview's hint won't point here again. Greet once per session.
  useEffect(() => {
    try {
      sessionStorage.setItem(BRIEF_SEEN, "1");
      if (sessionStorage.getItem(GREET_KEY)) return;
    } catch {
      // Storage blocked: greet anyway, it only happens on this load.
    }
    const t = setTimeout(() => {
      // Marked only when the greeting really shows (React runs effects twice in development).
      try {
        sessionStorage.setItem(GREET_KEY, "1");
      } catch {}
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
      setStep(0);
      setPhase("tour");
    };
    window.addEventListener(TOUR_START, start);
    return () => window.removeEventListener(TOUR_START, start);
  }, []);

  // Go to the current stop: bring it into view (tour only) and point at its middle,
  // following it while the page scrolls there.
  useEffect(() => {
    if (!target) return;
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    const motion = !reduced();
    if (phase === "tour") bringIntoView(el, motion);
    const place = () => setPos(pointAt(el));
    // First appearance: fade in just beside the stop, then glide onto it.
    if (!placed.current) {
      placed.current = true;
      setPos(besides(pointAt(el)));
    }
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const t = setTimeout(place, phase === "tour" && motion ? 120 : 40);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("scrollend", place);
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("scrollend", place);
      window.removeEventListener("resize", follow);
    };
  }, [target, phase]);

  // Advance through the stops (each as long as its line takes to read), then leave.
  const line = steps[step]?.text ?? "";
  useEffect(() => {
    if (phase !== "tour") return;
    const t = setTimeout(() => {
      if (step < steps.length - 1) setStep(step + 1);
      else setPhase("idle");
    }, readMs(line) + MOVE_MS);
    return () => clearTimeout(t);
  }, [phase, step, steps.length, line]);

  // Escape ends it.
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhase("idle");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (!pos) return null;

  return (
    <GuideCursor pos={pos} visible={phase !== "idle"} lineKey={phase === "tour" ? step : phase}>
      {phase === "greet" && (
        <>
          <p>Hi, I&apos;m Joko! Want a quick tour?</p>
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
      {phase === "tour" && (
        <>
          <p>{line}</p>
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
    </GuideCursor>
  );
}
