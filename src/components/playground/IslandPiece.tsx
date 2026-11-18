"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { islandLandmarks, type LandmarkId } from "@/content/island";

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
    <Image
      src="/playground/island-poster.webp"
      alt=""
      fill
      sizes="(min-width: 64rem) 60rem, 100vw"
      className="object-contain"
      priority
    />
  );
}

/**
 * The Playground's Studio island (docs/studio.md): Joko's work as places on a small 3D island. For now it is a
 * view you can look around; walking around it comes next. The landmark list under it is the accessible control.
 */
export function IslandPiece() {
  const [selected, setSelected] = useState<LandmarkId | null>(null);
  const [hovered, setHovered] = useState<LandmarkId | null>(null);
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => true,
  );

  const labels = useRef(new Map<LandmarkId, HTMLElement>());
  const current = islandLandmarks.find((l) => l.id === selected);
  const active = hovered ?? selected;
  const toggle = (id: LandmarkId) => setSelected((s) => (s === id ? null : id));
  const live = webgl && !reducedMotion;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full sm:aspect-auto sm:h-[clamp(30rem,calc(100svh-8rem),52rem)]">
        {live ? (
          // Decorative for assistive tech: the landmark list below is the accessible control.
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <IslandScene
              selected={selected}
              hovered={hovered}
              onSelect={toggle}
              onHover={setHovered}
              orbit={finePointer}
              labels={labels}
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
                  l.id === active ? "bg-accent text-bg" : "bg-bg text-ink"
                }`}
              >
                {l.label}
              </span>
            ))}
          </div>
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
              const active = l.id === selected;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls="island-caption"
                    onClick={() => toggle(l.id)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(l.id)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(l.id)}
                    onBlur={() => setHovered(null)}
                    className={`pressable rounded-full px-4 py-2 text-sm font-medium ${
                      active ? "bg-accent text-bg" : "bg-surface text-ink hover:text-accent"
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
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {current.links.map((link) => (
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
            </>
          ) : (
            <p className="max-w-prose leading-relaxed text-muted">
              {finePointer ? "Click" : "Tap"} a place on the island, or pick it from the list.
              {live && finePointer && " Drag to look around."} Walking around the island comes next.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
