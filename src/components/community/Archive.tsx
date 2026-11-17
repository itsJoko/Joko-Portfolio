"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PiCaretLeft, PiCaretRight, PiX } from "react-icons/pi";
import { getSupabase } from "@/lib/supabase";
import { DECISIONS, optionLabel, type Decisions } from "@/lib/community/words";
import { Poster } from "./Poster";

type Finished = { id: number; decisions: Decisions; finished_at: string; contributors: number };

const PAGE = 8;
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const title = (p: Finished) => (p.decisions.theme ? optionLabel("theme", p.decisions.theme) : "Untitled");

/**
 * Finished posters, newest first (the database keeps the newest 48), each with how many people
 * made it. Readable without signing in. Tapping one opens it large in a dialog.
 */
export function Archive({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<Finished[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("posters")
      .select("id, decisions, finished_at, contributors")
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(limit + 1)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMore(data.length > limit);
        setItems((data as Finished[]).slice(0, limit));
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  return (
    <section aria-labelledby="archive-title" className="mt-32 md:mt-40">
      <h2 id="archive-title" className="font-display text-[clamp(2rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.03em]">
        Archive
      </h2>
      <p className="mt-2 max-w-prose text-muted">Every finished poster, newest first, with how many people made it.</p>

      {items && items.length === 0 && (
        <p className="mt-8 rounded-3xl bg-surface p-6 text-muted">No finished posters yet. The first one lands here after its eighth decision.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-6 lg:grid-cols-4">
          {items.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="archive-card pressable block w-full text-left"
                data-cursor="Open"
                aria-label={`Open poster number ${p.id}, ${title(p)}`}
                onClick={() => setOpen(i)}
              >
                <span className="block overflow-hidden rounded-3xl bg-surface p-2.5">
                  <Poster decisions={p.decisions} number={p.id} className="archive-poster rounded-2xl" />
                </span>
                <span className="archive-name mt-3 block font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
                  {title(p)}
                </span>
                <span className="block text-sm text-muted">
                  {people(p.contributors)} · {date.format(new Date(p.finished_at))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {more && (
        <button type="button" className="btn pressable mt-10" onClick={() => setLimit((l) => l + PAGE)}>
          Show more
        </button>
      )}

      {items && open !== null && items[open] && (
        <PosterViewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

/** One archived poster, large, with its eight decisions. Native modal dialog. */
function PosterViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Finished[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const p = items[index];
  const go = useCallback((step: number) => onIndex((index + step + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // showModal focuses the first button and rings it; start on the dialog itself instead.
    // Tab reaches the buttons, Escape closes.
    dialog.focus();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden"; // the page behind holds still
    // No dialog.close() here: unmounting removes it, and close() would fire onClose and
    // shut the viewer straight away when React re-runs this effect in development.
    return () => {
      root.style.overflow = before;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-cursor-keep
      className="poster-viewer"
      aria-label={`Poster number ${p.id}, ${title(p)}`}
      tabIndex={-1}
      // Every way out goes through dialog.close(): the custom cursor lives inside an open
      // dialog and only moves back to the page when the dialog really closes.
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="poster-viewer-inner">
        <div className="poster-viewer-art">
          <Poster decisions={p.decisions} number={p.id} />
        </div>
        <div className="flex min-w-0 shrink-0 flex-col gap-4 md:gap-6">
          <div className="flex items-center justify-end gap-2">
            {items.length > 1 && (
              <>
                <button type="button" className="btn pressable !p-3" aria-label="Previous poster" onClick={() => go(-1)}>
                  <PiCaretLeft aria-hidden data-nudge="left" className="size-5" />
                </button>
                <button type="button" className="btn pressable !p-3" aria-label="Next poster" onClick={() => go(1)}>
                  <PiCaretRight aria-hidden data-nudge="right" className="size-5" />
                </button>
              </>
            )}
            <button type="button" className="btn btn-primary pressable !p-3" aria-label="Close" onClick={() => ref.current?.close()}>
              <PiX aria-hidden data-nudge="turn" className="size-5" />
            </button>
          </div>
          <div>
            <p className="text-muted">
              No. {p.id} · {index + 1} of {items.length}
            </p>
            <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.04em]">{title(p)}</h2>
            <p className="mt-2 text-muted">
              Made by {people(p.contributors)} · {date.format(new Date(p.finished_at))}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:gap-y-3">
            {DECISIONS.map((d) => (
              <div key={d.key}>
                <dt className="text-sm text-muted">{d.label}</dt>
                <dd className="font-medium">{p.decisions[d.key] ? optionLabel(d.key, p.decisions[d.key]!) : "–"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </dialog>
  );
}
