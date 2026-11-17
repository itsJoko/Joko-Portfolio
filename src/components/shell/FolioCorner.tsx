"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { PiCube, PiDownloadSimple, PiEnvelopeSimple, PiShuffle, PiSwap, PiUsersThree } from "react-icons/pi";
import { projects } from "@/content/projects";
import { site } from "@/content/site";
import { useOnlineCount } from "@/lib/community/useOnlineCount";
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

/** Where Folio can take you. "Surprise me" opens a project at random. */
function FolioMenu({
  id,
  built,
  online,
  focusFirst,
  onFlip,
  onClose,
}: {
  id: string;
  built: boolean;
  online: number | null;
  focusFirst: boolean;
  onFlip: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Opened from the keyboard: start on the first item. Opened by a click: no focus ring.
  useEffect(() => {
    if (focusFirst) ref.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [focusFirst]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const surprise = () => {
    const pick = projects[Math.floor(Math.random() * projects.length)];
    go(`/projects#${pick.slug}`);
  };

  return (
    <div ref={ref} id={id} role="group" aria-label="Folio: where to?" className="folio-menu">
      <p className="folio-menu-title">Where to?</p>
      <ul className="flex flex-col">
        <li>
          <button type="button" className="folio-item pressable" onClick={surprise}>
            <PiShuffle aria-hidden className="size-4" />
            Surprise me
          </button>
        </li>
        <li>
          <button type="button" className="folio-item pressable" onClick={() => go("/community")}>
            <PiUsersThree aria-hidden className="size-4" />
            Community
            {!!online && (
              <span className="folio-live">
                <span aria-hidden className="nav-live-dot" />
                {online} here
              </span>
            )}
          </button>
        </li>
        <li>
          <button type="button" className="folio-item pressable" onClick={() => go("/playground")}>
            <PiCube aria-hidden className="size-4" />
            Playground
          </button>
        </li>
        <li>
          <a href={site.cv} download="Joko-Comia-CV.pdf" className="folio-item pressable" onClick={onClose}>
            <PiDownloadSimple aria-hidden className="size-4" />
            Download CV
          </a>
        </li>
        {site.email && (
          <li>
            <a href={`mailto:${site.email}`} className="folio-item pressable" onClick={onClose}>
              <PiEnvelopeSimple aria-hidden className="size-4" />
              Say hello
            </a>
          </li>
        )}
        <li>
          <button type="button" className="folio-item pressable" onClick={onFlip}>
            <PiSwap aria-hidden className="size-4" />
            {built ? "Show my blueprint" : "Build me back"}
          </button>
        </li>
      </ul>
    </div>
  );
}

/**
 * Folio, the mascot, in the corner on wider screens. Clicking it (or its button, for keyboards)
 * makes it hop and opens a speech bubble with places to go; it waves while the bubble is open.
 * Escape, a click elsewhere, a new page or picking an item closes it. Phones skip Folio, for
 * their reading room and their battery.
 */
export function FolioCorner() {
  const wide = useMedia("(min-width: 48rem)");
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const ready = useReadyAfterIntro();
  const theme = useThemeClass();
  const online = useOnlineCount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const [built, setBuilt] = useState(true);
  const corner = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // A new page closes the bubble (adjusting state during render, React's pattern for this).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Escape closes (focus back to Folio's button); so does a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!corner.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!wide || !ready || !theme) return null;

  return (
    <div ref={corner} className="fixed bottom-2 right-3 z-30">
      {open && (
        <FolioMenu
          id={menuId}
          built={built}
          online={online}
          focusFirst={byKeyboard}
          onFlip={() => setBuilt((b) => !b)}
          onClose={() => setOpen(false)}
        />
      )}
      <div aria-hidden className="h-36 w-28">
        <FolioScene
          reducedMotion={reducedMotion}
          ink={cssVar("--ink")}
          built={built}
          attentive={open}
          onTap={() => {
            setByKeyboard(false);
            setOpen((o) => !o);
          }}
        />
      </div>
      {/* The keyboard way in: invisible until focused, then a ring around Folio. */}
      <button
        ref={toggle}
        type="button"
        className="folio-toggle"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setByKeyboard(true);
          setOpen((o) => !o);
        }}
      >
        <span className="sr-only">Folio: where to?</span>
      </button>
    </div>
  );
}
