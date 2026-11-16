"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  label: string;
  /**
   * "filter": toggle buttons (aria-pressed) that filter content in place, like Graphics.
   * "tabs": a tablist; pair each option with a tabpanel whose id is `${idBase}-panel-${option}`.
   */
  mode?: "filter" | "tabs";
  idBase?: string;
  className?: string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const segmentedIds = (idBase: string, option: string) => ({
  tab: `${idBase}-tab-${slug(option)}`,
  panel: `${idBase}-panel-${slug(option)}`,
});

/**
 * Round segmented control on a `surface` track; an ink pill slides to the active option
 * (0.35s expo.out, a jump under reduced motion). The track scrolls sideways when it overflows.
 */
export function Segmented<T extends string>({ options, value, onChange, label, mode = "filter", idBase = "seg", className = "" }: Props<T>) {
  const track = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrap = track.current;
    const pill = wrap?.querySelector<HTMLElement>(".seg-pill");
    const activeEl = wrap?.querySelector<HTMLElement>('[data-active="true"]');
    if (!wrap || !pill || !activeEl) return;
    const set = { x: activeEl.offsetLeft, width: activeEl.offsetWidth };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !pill.dataset.ready) gsap.set(pill, set);
    else gsap.to(pill, { ...set, duration: 0.35, ease: "expo.out" });
    pill.dataset.ready = "1";
  }, [value]);

  // Tabs move with the arrow keys and take focus with them (WAI-ARIA tabs pattern).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== "tabs") return;
    const i = options.indexOf(value);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = options[(next + options.length) % options.length];
    onChange(target);
    track.current?.querySelector<HTMLElement>(`#${segmentedIds(idBase, target).tab}`)?.focus();
  };

  return (
    <div
      ref={track}
      role={mode === "tabs" ? "tablist" : "group"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`seg-track relative flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 ${className}`}
    >
      <span aria-hidden className="seg-pill absolute left-0 top-1 bottom-1 rounded-full bg-ink" />
      {options.map((o) => {
        const on = o === value;
        const ids = segmentedIds(idBase, o);
        return (
          <button
            key={o}
            type="button"
            data-active={on}
            onClick={() => onChange(o)}
            {...(mode === "tabs"
              ? { role: "tab", id: ids.tab, "aria-selected": on, "aria-controls": ids.panel, tabIndex: on ? 0 : -1 }
              : { "aria-pressed": on })}
            className="seg-tab pressable relative z-10 shrink-0 rounded-full px-4 py-2 text-base"
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
