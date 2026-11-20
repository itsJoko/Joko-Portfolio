"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PiPaperPlaneTilt } from "react-icons/pi";
import { islandLandmarks, planeFacts, type Landmark, type LandmarkId } from "@/content/island";
import { cssVar, useThemeClass } from "@/lib/useThemeClass";
import type { Action, Mode, Spot } from "./IslandScene";

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
    <Image src="/playground/island-poster.webp" alt="" fill sizes="(min-width: 64rem) 60rem, 100vw" className="object-contain" priority />
  );
}

// Found paper planes are remembered in this browser; a lit campfire, for this visit.
const PLANES_KEY = "island-planes";
const FIRE_KEY = "island-fire";
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
  const [mode, setMode] = useState<Mode>("overview");
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
  const [photoSaved, setPhotoSaved] = useState(false);
  const act = (kind: Action["kind"]) => setAction((a) => ({ kind, n: (a?.n ?? 0) + 1 }));
  useEffect(() => {
    if (!photoSaved) return;
    const id = window.setTimeout(() => setPhotoSaved(false), 3200);
    return () => window.clearTimeout(id);
  }, [photoSaved]);
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
  const labels = useRef(new Map<LandmarkId, HTMLElement>());

  const live = webgl && !reducedMotion;
  const current = islandLandmarks.find((l) => l.id === selected);
  const nearLandmark = islandLandmarks.find((l) => l.id === near);
  const active = hovered ?? selected;

  const startWalking = () => {
    setMode("walk");
  };
  const pick = (id: LandmarkId) => {
    setSelected((s) => (s === id ? null : id));
    if (live) {
      setMode("walk");
      setGoTo((g) => ({ id, n: (g?.n ?? 0) + 1 }));
      setWalked(true);
    }
  };

  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-auto sm:h-[clamp(30rem,calc(100svh-8rem),52rem)]"
        onPointerEnter={() => setPointerIn(true)}
        onPointerLeave={() => setPointerIn(false)}
      >
        {live ? (
          <>
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
                onPhoto={() => setPhotoSaved(true)}
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
            </div>

            {/* Overview / walk switch. */}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "walk" ? "overview" : "walk"))}
              className="pressable absolute right-3 top-3 rounded-full bg-bg px-4 py-2 text-sm font-medium text-ink"
            >
              {mode === "walk" ? "See the whole island" : "Walk around"}
            </button>

            {/* Paper planes found so far. */}
            {(mode === "walk" || collected.size > 0) && (
              <p
                aria-label={`Paper planes found: ${collected.size} of ${planeFacts.length}`}
                className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-bg px-3 py-2 text-sm font-medium tabular-nums text-ink"
              >
                <PiPaperPlaneTilt aria-hidden className="size-4" />
                {collected.size} / {planeFacts.length}
              </p>
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
            {mode === "walk" && (riding || spot || photoSaved) && (
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-bg p-1.5 text-sm text-ink">
                {photoSaved ? (
                  <p role="status" className="px-3 py-1">Photo saved to your downloads</p>
                ) : riding ? (
                  <>
                    <p className="pl-3">{finePointer ? "Click a path to ride" : "Tap a path to ride"}</p>
                    <button type="button" onClick={() => act("park")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                      Park the bike
                    </button>
                  </>
                ) : spot === "bikes" ? (
                  <button type="button" onClick={() => act("ride")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                    Ride a bike
                  </button>
                ) : (
                  <button type="button" onClick={() => act("photo")} className="pressable rounded-full bg-accent px-4 py-1.5 font-medium text-bg">
                    Take a photo
                  </button>
                )}
              </div>
            )}

            {/* How to move, until the first step; how to get up from a bench. */}
            {mode === "walk" && (!walked || sitting) && !riding && !spot && !photoSaved && (
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
          <Poster />
        )}
      </div>

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

        <div id="island-caption" aria-live="polite" className="min-h-28">
          {current ? (
            <>
              <p className="text-xl font-semibold">{current.title}</p>
              <p className="mt-2 max-w-prose leading-relaxed text-muted">{current.body}</p>
              <LandmarkLinks landmark={current} className="mt-3" />
            </>
          ) : (
            <p className="max-w-prose leading-relaxed text-muted">
              {live
                ? `Walk around the island and visit a place, or pick one from the list and Folio walks you there.`
                : `Pick a place from the list to see what's there.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
