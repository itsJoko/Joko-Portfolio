"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cssVar, useThemeClass } from "@/lib/useThemeClass";
import { INTRO_DONE, introFinished } from "./Intro";

const FolioScene = dynamic(() => import("./FolioScene"), { ssr: false });

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * True once the intro is over and the visitor has done something (moved the mouse, scrolled,
 * pressed a key). The 3D engine is about 900 KB and building Folio's lighting takes a moment,
 * so it waits for a real visitor instead of competing with the page's first load.
 */
function useReadyAfterIntro() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const events = ["pointermove", "pointerdown", "wheel", "keydown", "scroll"] as const;
    let idle = 0;
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go));
      if ("requestIdleCallback" in window) idle = requestIdleCallback(() => setReady(true), { timeout: 800 });
      else setReady(true);
    };
    const start = () => events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    if (introFinished()) start();
    else window.addEventListener(INTRO_DONE, start, { once: true });
    return () => {
      window.removeEventListener(INTRO_DONE, start);
      events.forEach((e) => window.removeEventListener(e, go));
      if (idle) cancelIdleCallback(idle);
    };
  }, []);
  return ready;
}

/**
 * Folio, the mascot, keeping out of the way in the corner on wider screens. Decorative and unannounced:
 * finding out it can be clicked is the point. Phones skip it, for their reading room and their battery.
 */
export function FolioCorner() {
  const wide = useMedia("(min-width: 48rem)");
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const ready = useReadyAfterIntro();
  const theme = useThemeClass();
  if (!wide || !ready || !theme) return null;

  return (
    <div aria-hidden className="fixed bottom-2 right-3 z-30 h-36 w-28">
      <FolioScene reducedMotion={reducedMotion} ink={cssVar("--ink")} />
    </div>
  );
}
