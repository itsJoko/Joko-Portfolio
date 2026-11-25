"use client";

import dynamic from "next/dynamic";
import { Fredoka } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { PiBell, PiCamera, PiDownloadSimple, PiChatCircleDots, PiCursorClick, PiGearSix, PiMapTrifold, PiPersonSimpleWalk, PiPlay, PiTag, PiX, PiMoon, PiPaperPlaneTilt, PiSpeakerHigh, PiSpeakerSlash, PiSun, PiUsers } from "react-icons/pi";
import { Turnstile } from "@/components/community/Turnstile";
import { nameOf, PHRASES, phraseFor, REACTIONS, reactionFor } from "@/lib/community/words";
import { IslandSound } from "@/lib/island/islandSound";
import { useIslandOnline, type Talk } from "@/lib/island/useIslandOnline";
import { islandLandmarks, planeFacts, type Landmark, type LandmarkId } from "@/content/island";
import { cssVar, useThemeClass } from "@/lib/useThemeClass";
import { POSES, type Pose } from "@/lib/island/poses";
import type { Action, Mode, Spot } from "./IslandScene";
// Imported, not linked by path: the build gives it a content-hashed URL, so a re-exported poster is never served
// from a stale cache (Next 16 keeps optimised images for 4 hours, browsers longer).
import posterImage from "../../../public/playground/island-poster.webp";

gsap.registerPlugin(useGSAP);

// The island's own display face, for its title card only: rounded, like the low-poly island.
const gameFont = Fredoka({ subsets: ["latin"], weight: ["600", "700"], display: "swap" });

const IslandScene = dynamic(() => import("./IslandScene"), {
  ssr: false,
  loading: () => <Poster />,
});

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

let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

/** A still of the island, rendered in Blender: shown while the scene loads, and instead of it for reduced motion or no WebGL. */
function Poster() {
  return (
    <Image src={posterImage} alt="" fill sizes="(min-width: 64rem) 60rem, 100vw" className="object-contain" priority />
  );
}

// Found paper planes are remembered in this browser; a lit campfire, for this visit.
const PLANES_KEY = "island-planes";
const FIRE_KEY = "island-fire";
const SETTINGS_KEY = "island-settings";
function readPlanes(): Set<number> {
  try {
    const v = JSON.parse(localStorage.getItem(PLANES_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= 0 && n < planeFacts.length) : []);
  } catch {
    return new Set();
  }
}

function LandmarkLinks({ landmark, className = "" }: { landmark: Landmark; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 ${className}`}>
      {landmark.links.map((link) => (
        <li key={link.href}>
          {link.href.endsWith(".pdf") ? (
            <a href={link.href} download className="link">
              {link.label}
            </a>
          ) : (
            <Link href={link.href} className="link">
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The Playground's Studio island (docs/studio.md): Joko's work as places on a small 3D island. It opens on the
 * whole island; "Walk around", a click on the island or a place from the list puts you in Folio's shoes, and
 * walking up to a place opens its card. The list under the island is the accessible control.
 */
export function IslandPiece() {
  const rootRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<HTMLDivElement>(null);
  const transitionTextRef = useRef<HTMLParagraphElement>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [playing, setPlaying] = useState(false);   // after Press start, until Exit
  const [transitionPhase, setTransitionPhase] = useState<"enter" | "exit" | null>(null);
  const [ready, setReady] = useState(false);       // the island's first frame is drawn: lift the joining veil
  const [selected, setSelected] = useState<LandmarkId | null>(null);
  const [hovered, setHovered] = useState<LandmarkId | null>(null);
  const [near, setNear] = useState<LandmarkId | null>(null);
  const [goTo, setGoTo] = useState<{ id: LandmarkId; n: number } | null>(null);
  const [walked, setWalked] = useState(false);
  const [pointerIn, setPointerIn] = useState(false);
  const [sitting, setSitting] = useState(false);
  const [collected, setCollected] = useState<ReadonlySet<number>>(() => new Set());
  const [found, setFound] = useState<number | null>(null); // the plane just found, for its card
  const [fireLit, setFireLit] = useState(false);
  const [cheerUntil, setCheerUntil] = useState(0);
  const [spot, setSpot] = useState<Spot>(null);           // standing at the bike rack or the photo spot
  const [riding, setRiding] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  // The photo just taken (shown over the island, downloaded only on request) and the pose for the next one.
  const [photo, setPhoto] = useState<string | null>(null);
  const [pose, setPose] = useState<Pose>("cheer");
  const act = (kind: Action["kind"]) => setAction((a) => ({ kind, n: (a?.n ?? 0) + 1, pose }));
  const showPhoto = useCallback((png: Blob) => setPhoto(URL.createObjectURL(png)), []);
  const closePhoto = () => setPhoto(null);
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo);
  }, [photo]);
  // Sound: off until the visitor turns it on (made on the first press: browsers only allow sound after a click).
  const sound = useRef<IslandSound | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const toggleSound = () => {
    if (!soundOn) {
      sound.current ??= new IslandSound();
      void sound.current.start();
    } else {
      sound.current?.stop();
    }
    setSoundOn(!soundOn);
  };
  useEffect(() => () => sound.current?.dispose(), []);
  // R rings the bike's bell (riding, pointer over the island).
  const ring = () => sound.current?.bell();
  useEffect(() => {
    if (!riding || !pointerIn) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyR" && !e.repeat && !(e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) sound.current?.bell();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [riding, pointerIn]);
  // Read what this browser remembers once mounted (storage isn't available during server render).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from browser storage after mount
    setCollected(readPlanes());
    try {
      setFireLit(sessionStorage.getItem(FIRE_KEY) === "1");
    } catch {}
  }, []);
  // A found plane's card stays up for a while, longer for the last one.
  useEffect(() => {
    if (found === null) return;
    const id = window.setTimeout(() => setFound(null), collected.size === planeFacts.length ? 9000 : 6500);
    return () => window.clearTimeout(id);
  }, [found, collected.size]);

  const collect = (index: number) => {
    setCollected((prev) => {
      const next = new Set(prev).add(index);
      try {
        localStorage.setItem(PLANES_KEY, JSON.stringify([...next]));
      } catch {}
      if (next.size === planeFacts.length && prev.size < planeFacts.length) setCheerUntil(performance.now() + 2600);
      return next;
    });
    setFound(index);
  };
  const lightFire = () => {
    setFireLit(true);
    try {
      sessionStorage.setItem(FIRE_KEY, "1");
    } catch {}
  };
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => true,
  );
  const theme = useThemeClass();
  const fogColor = useMemo(() => (theme ? cssVar("--bg") || "#000000" : "#000000"), [theme]);
  // The island's time of day: the site theme until the visitor picks day or evening with the island's own button.
  const [islandNight, setIslandNight] = useState<boolean | null>(null);
  const night = islandNight ?? theme === "dark";
  const live = webgl && !reducedMotion;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);

  useGSAP(
    () => {
      if (!transitionPhase || !transitionRef.current) return;

      const overlay = transitionRef.current;
      const text = transitionTextRef.current;
      const instant = reducedMotion;
      const duration = instant ? 0.12 : 0.58;
      const hold = instant ? 0.05 : 0.24;
      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => setTransitionPhase(null),
      });

      gsap.set(overlay, { yPercent: 100, autoAlpha: 1 });
      if (text) gsap.set(text, { autoAlpha: 0, y: instant ? 0 : 18 });

      if (transitionPhase === "enter") {
        tl.to(overlay, { yPercent: 0, duration, ease: "power4.inOut" })
          .call(() => {
            setReady(false);
            setPlaying(true);
            setMode("walk");
            sound.current ??= new IslandSound();
            void sound.current.start();
            setSoundOn(true);
          })
          .to(text, { autoAlpha: 1, y: 0, duration: instant ? 0.08 : 0.22, ease: "power2.out" }, "<")
          .to(text, { autoAlpha: 0, y: instant ? 0 : -12, duration: instant ? 0.08 : 0.18, ease: "power2.in" }, `+=${hold}`)
          .to(overlay, { yPercent: -100, duration, ease: "power4.inOut" }, "-=0.06");
      } else {
        tl.to(overlay, { yPercent: 0, duration, ease: "power4.inOut" })
          .call(() => {
            setPlaying(false);
            setReady(false);
            setMode("overview");
            setSettingsOpen(false);
            setTalkOpen(false);
            sound.current?.stop();
            setSoundOn(false);
          })
          .to(text, { autoAlpha: 1, y: 0, duration: instant ? 0.08 : 0.22, ease: "power2.out" }, "<")
          .to(text, { autoAlpha: 0, y: instant ? 0 : -12, duration: instant ? 0.08 : 0.18, ease: "power2.in" }, `+=${hold}`)
          .to(overlay, { yPercent: -100, duration, ease: "power4.inOut" }, "-=0.06");
      }
    },
    { dependencies: [transitionPhase, reducedMotion], scope: rootRef },
  );

  // Other visitors: joining starts with the first walk (the bot check is usually invisible).
  const [bubbles, setBubbles] = useState<Map<string, Talk>>(() => new Map());
  const onTalk = (t: Talk) => {
    setBubbles((m) => new Map(m).set(t.key, t));
    window.setTimeout(() => setBubbles((m) => (m.get(t.key)?.uid === t.uid ? (m.delete(t.key), new Map(m)) : m)), 3200);
  };
  const game = live && playing;
  const online = useIslandOnline(game && mode === "walk", onTalk);
  const tagEls = useRef(new Map<string, HTMLElement>());
  const joined = online.status === "ready" && !!online.me;
  // Your own tag shows for a few seconds when you join and when your name changes, then gets out of the way.
  const [flashMe, setFlashMe] = useState(false);
  const myName = online.me ? nameOf(online.me) : "";
  useEffect(() => {
    if (!myName) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a timed flash when the name appears or changes
    setFlashMe(true);
    const id = window.setTimeout(() => setFlashMe(false), 3500);
    return () => window.clearTimeout(id);
  }, [myName]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __islandOnline?: unknown }).__islandOnline = { status: online.status, me: online.me, others: online.tags.length };
  }, [online.status, online.me, online.tags.length]);
  const sceneOnline = useMemo(
    () => (joined ? { others: online.others, tags: online.tags, tagEls, walk: online.walk, sit: online.sit, pose: online.pose, myKey: online.myKey } : null),
    [joined, online.others, online.tags, online.walk, online.sit, online.pose, online.myKey],
  );
  // Settings (the gear): name tags and mouse hints, remembered in this browser. Hints start off, so the island
  // is there to explore; name tags start on.
  const [prefs, setPrefs] = useState({ names: true, hints: false });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from browser storage after mount
      if (saved && typeof saved === "object") setPrefs((p) => ({ names: saved.names !== false, hints: saved.hints === true || p.hints }));
    } catch {}
  }, []);
  const setPref = (k: "names" | "hints", v: boolean) =>
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const hintEl = useRef<HTMLSpanElement>(null);   // "Sit here", "Ride a bike" at the mouse (the scene moves it)
  const hintsOn = useRef(false);
  useEffect(() => {
    hintsOn.current = prefs.hints;
    if (!prefs.hints && hintEl.current) hintEl.current.style.opacity = "0";
  }, [prefs.hints]);
  const overlay = useCallback(() => ({ hint: hintsOn.current ? hintEl.current : null }), []);
  const bubbleText = (t?: Talk) => (t ? (t.kind === "reaction" ? reactionFor(t.id)?.emoji : phraseFor(t.id)?.label) : undefined);
  const tagRef = (k: string) => (el: HTMLElement | null) => {
    if (el) tagEls.current.set(k, el);
    else tagEls.current.delete(k);
  };
  const labels = useRef(new Map<LandmarkId, HTMLElement>());

  const current = islandLandmarks.find((l) => l.id === selected);
  const nearLandmark = islandLandmarks.find((l) => l.id === near);
  const active = hovered ?? selected;

  const startWalking = () => {
    setMode("walk");
  };
  // Press start: the island loads only now, fills the screen, and its sound comes on (the press is the click
  // browsers need before any sound). Exit (or Escape) goes back to the page and turns the sound off.
  const start = () => {
    if (transitionPhase) return;
    setTransitionPhase("enter");
  };
  const exit = () => {
    if (transitionPhase) return;
    setTransitionPhase("exit");
  };
  const pick = (id: LandmarkId) => {
    setSelected((s) => (s === id ? null : id));
    if (live) {
      if (!playing) start();
      setMode("walk");
      setGoTo((g) => ({ id, n: (g?.n ?? 0) + 1 }));
      setWalked(true);
    }
  };
  // While playing: the page behind doesn't scroll, and Escape exits (after closing an open panel).
  useEffect(() => {
    if (!playing) return;
    const html = document.documentElement, before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [playing]);
  const escRef = useRef<() => void>(() => {});
  useEffect(() => {
    escRef.current = () => {
      if (photo) setPhoto(null);
      else if (settingsOpen) setSettingsOpen(false);
      else if (talkOpen) setTalkOpen(false);
      else exit();
    };
  });
  useEffect(() => {
    if (!playing) return;
    const down = (e: KeyboardEvent) => e.key === "Escape" && escRef.current();
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [playing]);

  return (
    <div ref={rootRef}>
      <div
        className={
          game
            ? "fixed inset-0 z-80 h-dvh w-full overflow-hidden bg-bg"
            : "relative aspect-4/5 w-full overflow-hidden sm:aspect-auto sm:h-[clamp(30rem,calc(100svh-8rem),52rem)]"
        }
        data-lenis-prevent={game ? "" : undefined}
        role={game ? "dialog" : undefined}
        aria-modal={game ? true : undefined}
        aria-label={game ? "Studio island" : undefined}
        onPointerEnter={() => setPointerIn(true)}
        // Every island button ticks softly while the island's sound is on.
        onClickCapture={(e) => (e.target as HTMLElement).closest("button") && sound.current?.click()}
        onPointerLeave={() => setPointerIn(false)}
      >
        {transitionPhase && (
          <div
            ref={transitionRef}
            aria-hidden
            className="fixed inset-0 z-100 flex items-center justify-center bg-ink text-bg"
          >
            <p
              ref={transitionTextRef}
              className={`${gameFont.className} text-balance px-6 text-center text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-none tracking-[-0.03em]`}
            >
              {transitionPhase === "enter" ? "Studio Island" : "Back to Playground"}
            </p>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
          </div>
        )}
        {game ? (
          <>
            {/* Joining the world: the title and a loading bar over the island until its first frame, then the veil
                fades while the camera swoops down to Folio. */}
            <div
              aria-hidden
              className={`absolute inset-0 z-60 flex flex-col items-center justify-center bg-bg transition-opacity duration-700 ease-out ${
                ready ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <p className={`${gameFont.className} text-[clamp(2.75rem,9vw,5.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-ink`}>Studio Island</p>
              <span className="mt-6 block h-1 w-40 overflow-hidden rounded-full bg-surface">
                <span className="island-loading block h-full w-1/3 rounded-full bg-accent" />
              </span>
            </div>
            {/* Decorative for assistive tech: the buttons and list below are the accessible controls. */}
            <div aria-hidden className="absolute inset-0" onPointerDown={() => mode === "walk" && setWalked(true)}>
              <IslandScene
                mode={mode}
                onWalkStart={startWalking}
                selected={selected}
                hovered={hovered}
                onSelect={(id) => setSelected(id)}
                onHover={setHovered}
                goTo={goTo}
                onNear={setNear}
                onSit={setSitting}
                collected={collected}
                onCollect={collect}
                fireLit={fireLit}
                onFireLit={lightFire}
                cheerUntil={cheerUntil}
                keysActive={pointerIn}
                labels={labels}
                fogColor={fogColor}
                onSpot={setSpot}
                onRide={setRiding}
                action={action}
                onPhoto={showPhoto}
                night={night}
                sound={sound}
                online={sceneOnline}
                overlay={overlay}
                onReady={() => setReady(true)}
              />
              {/* Labels over the canvas; the scene pins each one above its landmark. */}
              {islandLandmarks.map((l) => (
                <span
                  key={l.id}
                  ref={(el) => {
                    if (el) labels.current.set(l.id, el);
                    else labels.current.delete(l.id);
                  }}
                  style={{ opacity: 0 }}
                  className={`pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                    l.id === active || l.id === near ? "bg-accent text-bg" : "bg-bg text-ink"
                  }`}
                >
                  {l.label}
                </span>
              ))}
              {/* What the mouse is over can be used: which seat you'd take (or that it's taken), the bikes. */}
              <span
                ref={hintEl}
                style={{ opacity: 0 }}
                className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-bg transition-opacity duration-150"
              />
              {/* Name tags: others' fade in when they are near you; yours only right after joining or a new name.
                  Anyone talking shows their tag with what they said floating above, near or far (data-show). */}
              {joined &&
                [{ key: "me", profile: online.me! }, ...online.tags.slice(0, 20)].map((t) => (
                  <span
                    key={t.key}
                    ref={tagRef(t.key)}
                    data-show={bubbles.has(t.key) || (t.key === "me" && flashMe && prefs.names) ? "1" : ""}
                    data-names={prefs.names ? "" : "off"}
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap transition-opacity duration-300"
                  >
                    {bubbles.get(t.key) && (
                      <span key={bubbles.get(t.key)!.uid} className="island-bubble rounded-2xl bg-bg px-3 py-1 text-base text-ink shadow-sm">
                        {bubbleText(bubbles.get(t.key))}
                      </span>
                    )}
                    <span className={`items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-0.5 text-xs font-medium text-ink ${prefs.names ? "flex" : "hidden"}`}>
                      <span aria-hidden className="tag-dot" data-colour={t.profile.colour} />
                      {t.key === "me" ? `${nameOf(t.profile)} (you)` : nameOf(t.profile)}
                    </span>
                  </span>
                ))}
            </div>

            {/* Settings (sound, evening, name tags, hints), talk, and the overview / walk switch. */}
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                type="button"
                aria-expanded={settingsOpen}
                aria-controls="island-settings"
                aria-label="Settings"
                title="Settings"
                onClick={() => {
                  setSettingsOpen((o) => !o);
                  setTalkOpen(false);
                }}
                className="pressable grid size-9 place-items-center rounded-full bg-bg text-ink"
              >
                <PiGearSix aria-hidden className="size-4" />
              </button>
              {joined && mode === "walk" && (
                <button
                  type="button"
                  aria-expanded={talkOpen}
                  aria-controls="island-talk"
                  aria-label="Talk"
                  title="Talk"
                  onClick={() => {
                    setTalkOpen((o) => !o);
                    setSettingsOpen(false);
                  }}
                  className="pressable grid size-9 place-items-center rounded-full bg-bg text-ink"
                >
                  <PiChatCircleDots aria-hidden className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={mode === "walk" ? "See the whole island" : "Walk around"}
                title={mode === "walk" ? "See the whole island" : "Walk around"}
                onClick={() => setMode((m) => (m === "walk" ? "overview" : "walk"))}
                className="pressable grid size-9 place-items-center rounded-full bg-bg text-ink"
              >
                {mode === "walk" ? <PiMapTrifold aria-hidden className="size-4" /> : <PiPersonSimpleWalk aria-hidden className="size-4" />}
              </button>
              <button
                type="button"
                onClick={exit}
                className="pressable flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-sm font-medium text-bg"
              >
                <PiX aria-hidden className="size-4" />
                Exit
              </button>
            </div>

            {/* Settings: each a switch. */}
            {settingsOpen && (
              <div id="island-settings" className="absolute right-3 top-14 w-60 rounded-3xl bg-bg p-2 text-ink">
                {(
                  [
                    ["sound", "Sound", soundOn, soundOn ? PiSpeakerHigh : PiSpeakerSlash],
                    ["evening", "Evening", night, night ? PiMoon : PiSun],
                    ["names", "Name tags", prefs.names, PiTag],
                    ["hints", "Hover hints", prefs.hints, PiCursorClick],
                  ] as const
                ).filter(([id]) => id !== "hints" || finePointer).map(([id, label, on, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => {
                      if (id === "sound") toggleSound();
                      else if (id === "evening") setIslandNight(!night);
                      else setPref(id, !prefs[id]);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="flex-1">
                      {label}
                    </span>
                    <span aria-hidden className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${on ? "bg-accent" : "bg-surface"}`}>
                      <span className={`absolute top-0.5 size-4 rounded-full bg-bg shadow-sm transition-transform duration-150 ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Talk: the six emoji and six phrases of Community, and your name (shuffle it). */}
            {joined && mode === "walk" && talkOpen && (
              <div id="island-talk" className="absolute right-3 top-14 w-64 rounded-3xl bg-bg p-3 text-ink">
                <ul className="grid grid-cols-6 gap-1" aria-label="Reactions">
                  {REACTIONS.map((r) => (
                    <li key={r.id}>
                      <button type="button" aria-label={r.label} onClick={() => online.talk("reaction", r.id)} className="pressable grid size-9 place-items-center rounded-full text-lg hover:bg-surface">
                        {r.emoji}
                      </button>
                    </li>
                  ))}
                </ul>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Phrases">
                  {PHRASES.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => online.talk("phrase", p.id)} className="pressable rounded-full bg-surface px-3 py-1 text-sm">
                        {p.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center justify-between gap-2 text-sm text-muted">
                  <span className="flex items-center gap-1.5 truncate">
                    <span aria-hidden className="tag-dot" data-colour={online.me!.colour} />
                    {nameOf(online.me!)}
                  </span>
                  <button type="button" onClick={() => void online.shuffle()} className="link shrink-0">
                    Shuffle
                  </button>
                </p>
              </div>
            )}

            {/* Paper planes found so far, and who else is here. */}
            {(mode === "walk" || collected.size > 0) && (
              <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                <p
                  aria-label={`Paper planes found: ${collected.size} of ${planeFacts.length}`}
                  title="Paper planes found"
                  className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-2 text-sm font-medium tabular-nums text-ink"
                >
                  <PiPaperPlaneTilt aria-hidden className="size-4" />
                  {collected.size} / {planeFacts.length}
                  <span className="hidden sm:inline">planes</span>
                </p>
                {joined && mode === "walk" && online.tags.length > 0 && (
                  <p
                    title="Visitors on the island, you included"
                    aria-label={`${online.tags.length + 1} visitors on the island, you included`}
                    className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-2 text-sm font-medium tabular-nums text-ink"
                  >
                    <PiUsers aria-hidden className="size-4" />
                    {online.tags.length + 1}
                  </p>
                )}
              </div>
            )}

            {/* The bot check before joining others (usually invisible; a small box if Cloudflare wants a click). */}
            {mode === "walk" && online.status === "needs-captcha" && (
              <div className="absolute bottom-3 right-3">
                <Turnstile onToken={online.signIn} onError={() => {}} />
              </div>
            )}

            {/* A plane just found: what it says. */}
            {found !== null && (
              <div role="status" className="absolute left-3 top-14 max-w-xs rounded-3xl bg-bg p-4 text-ink">
                <p className="text-sm text-muted">
                  {collected.size === planeFacts.length ? "All six found. Thanks for exploring!" : `Paper plane ${collected.size} of ${planeFacts.length}`}
                </p>
                <p className="mt-1 leading-snug">{planeFacts[found]}</p>
              </div>
            )}

            {/* Things to do where Folio stands: take a bike, take a photo; riding, how to ride and park. */}
            {mode === "walk" && (riding || spot) && !photo && (
              <div className={`absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap bg-bg p-1.5 text-sm text-ink ${spot === "photo" && !riding ? "max-w-[calc(100%-2rem)] flex-col rounded-3xl sm:flex-row sm:rounded-full" : "rounded-full"}`}>
                {riding ? (
                  <>
                    <p className="pl-3">{finePointer ? "Click a path to ride, R to ring" : "Tap a path to ride"}</p>
                    {soundOn && (
                      <button type="button" aria-label="Ring the bell" onClick={ring} className="pressable grid size-8 place-items-center rounded-full bg-surface text-ink">
                        <PiBell aria-hidden className="size-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => act("park")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                      Park the bike
                    </button>
                  </>
                ) : spot === "bikes" ? (
                  <button type="button" onClick={() => act("ride")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                    Ride a bike
                  </button>
                ) : (
                  <>
                    <div role="group" aria-label="Pose" className="flex gap-1">
                      {POSES.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={pose === p.id}
                          onClick={() => setPose(p.id)}
                          className={`pressable rounded-full px-3 py-1.5 ${pose === p.id ? "bg-ink text-bg" : "bg-surface text-ink"}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => act("photo")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                      Take a photo
                    </button>
                  </>
                )}
              </div>
            )}

            {/* The photo just taken: look at it here; download it, take another, or close. */}
            {photo && (
              <div role="dialog" aria-label="Your photo" className="absolute inset-0 z-10 grid place-items-center bg-ink/40 p-4">
                <div className="flex max-h-full w-full max-w-xl flex-col gap-3 rounded-3xl bg-bg p-3 text-sm text-ink">
                  {/* A blob: URL made here; next/image can't optimise it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Your photo from the Studio island" className="max-h-[70dvh] min-h-0 w-full rounded-2xl object-contain" />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" aria-label="Close" title="Close" onClick={closePhoto} className="pressable grid size-10 place-items-center rounded-full bg-surface text-ink">
                      <PiX aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Take another"
                      title="Take another"
                      onClick={() => {
                        closePhoto();
                        act("photo");
                      }}
                      className="pressable grid size-10 place-items-center rounded-full bg-surface text-ink"
                    >
                      <PiCamera aria-hidden className="size-5" />
                    </button>
                    <a href={photo} download="folio-studio-island.png" aria-label="Download" title="Download" className="pressable grid size-10 place-items-center rounded-full bg-accent text-bg">
                      <PiDownloadSimple aria-hidden className="size-5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* How to move, until the first step; how to get up from a bench. */}
            {mode === "walk" && (!walked || sitting) && !riding && !spot && !photo && (
              <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg px-4 py-2 text-sm text-ink">
                {sitting
                  ? `${finePointer ? "Click" : "Tap"} anywhere to get up`
                  : finePointer
                    ? "Click anywhere to walk, or use WASD"
                    : "Tap anywhere to walk"}
              </p>
            )}

            {/* The place Folio is standing at. */}
            {mode === "walk" && nearLandmark && (
              <div role="status" className="absolute bottom-3 left-3 right-3 max-w-sm rounded-3xl bg-bg p-5 sm:right-auto">
                <p className="text-sm text-muted">{nearLandmark.label}</p>
                <p className="mt-1 text-xl font-semibold">{nearLandmark.title}</p>
                <p className="mt-1 leading-relaxed text-muted">{nearLandmark.body}</p>
                <LandmarkLinks landmark={nearLandmark} className="mt-3" />
              </div>
            )}
          </>
        ) : (
          <>
            <Poster />
            {/* The title card. Nothing 3D loads until Press start (and the page scrolls freely meanwhile). */}
            {live && (
              <div className="absolute inset-0 flex flex-col items-center justify-end bg-linear-to-t from-bg from-15% via-bg/60 via-45% to-transparent to-80% px-4 pb-10 text-center sm:pb-14">
                <p aria-hidden className={`${gameFont.className} text-balance text-[clamp(2.75rem,9vw,5.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-ink`}>
                  Studio Island
                </p>
                <button
                  type="button"
                  onClick={start}
                  className={`${gameFont.className} pressable mt-5 flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-lg font-semibold text-bg shadow-lg`}
                >
                  <PiPlay aria-hidden className="size-5" />
                  Start
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Without the game (reduced motion, no WebGL), the places and their links are listed here instead. */}
      {!live && (
      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-12">
        <div>
          <h3 id="island-places" className="text-sm text-muted">
            On the island
          </h3>
          <ul aria-labelledby="island-places" className="mt-3 flex flex-wrap gap-2">
            {islandLandmarks.map((l) => {
              const on = l.id === selected;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-controls="island-caption"
                    onClick={() => pick(l.id)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(l.id)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(l.id)}
                    onBlur={() => setHovered(null)}
                    className={`pressable rounded-full px-4 py-2 text-sm font-medium ${
                      on ? "bg-accent text-bg" : "bg-surface text-ink hover:text-accent"
                    }`}
                  >
                    {l.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div id="island-caption" aria-live="polite">
          {current && (
            <>
              <p className="text-xl font-semibold">{current.title}</p>
              <p className="mt-2 max-w-prose leading-relaxed text-muted">{current.body}</p>
              <LandmarkLinks landmark={current} className="mt-3" />
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
