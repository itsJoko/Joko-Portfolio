"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRIEF_SEEN } from "@/components/brief/BriefTour";
import { GuideCursor, besides, pointAt } from "@/components/brief/GuideCursor";
import { INTRO_DONE, introFinished } from "@/components/shell/Intro";

const HINT_KEY = "brief-hinted";
const DELAY_MS = 4000; // let them look around first
const SHOW_MS = 7000;

/**
 * A one-time nudge on the Overview for visitors in a hurry: about 4 s after arriving (after the
 * intro), Joko's cursor points at the hero's Brief button and offers it. Once per session, never for someone who has already opened the Brief, gone on its own
 * after 7 s, and skipped when the target isn't on screen.
 */
export function BriefHint() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [snap, setSnap] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BRIEF_SEEN) || sessionStorage.getItem(HINT_KEY)) return;
    } catch {
      return; // no storage: don't risk showing it on every visit
    }
    let show = 0;
    let hide = 0;
    let el: HTMLElement | null = null;
    // The cursor is fixed to the window but the button scrolls with the page: while the hint is up,
    // scrolling re-aims it every frame (no glide, so it doesn't trail) and hides it while the button is off screen.
    const follow = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const onScreen = r.bottom > 0 && r.top < window.innerHeight;
      setSnap(true);
      setVisible(onScreen);
      if (onScreen) setPos(pointAt(el));
    };
    const unfollow = () => {
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
    const start = () => {
      show = window.setTimeout(() => {
        el = document.querySelector<HTMLElement>("[data-brief-hint]");
        const r = el?.getBoundingClientRect();
        if (!el || !r || r.bottom < 0 || r.top > window.innerHeight) return; // not on screen: skip
        try {
          sessionStorage.setItem(HINT_KEY, "1");
        } catch {}
        const target = pointAt(el);
        setPos(besides(target));
        setVisible(true);
        // Glide the last stretch onto the button once it has faded in.
        window.setTimeout(() => setPos(target), 40);
        window.addEventListener("scroll", follow, { passive: true });
        window.addEventListener("resize", follow);
        hide = window.setTimeout(() => {
          unfollow();
          setVisible(false);
        }, SHOW_MS);
      }, DELAY_MS);
    };
    if (introFinished()) start();
    else window.addEventListener(INTRO_DONE, start, { once: true });
    return () => {
      window.removeEventListener(INTRO_DONE, start);
      clearTimeout(show);
      clearTimeout(hide);
      unfollow();
    };
  }, []);

  if (!pos) return null;
  const close = () => setVisible(false);

  return (
    <GuideCursor pos={pos} visible={visible} snap={snap} lineKey="hint">
      <p>In a hurry? Here&apos;s my one-minute brief.</p>
      <div className="mt-3 flex gap-2">
        <Link href="/brief" className="tour-btn tour-btn-primary pressable" onClick={close}>
          Open it
        </Link>
        <button type="button" className="tour-btn pressable" onClick={close}>
          Not now
        </button>
      </div>
    </GuideCursor>
  );
}
