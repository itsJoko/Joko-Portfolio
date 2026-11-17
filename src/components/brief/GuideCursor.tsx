"use client";

/**
 * Joko's cursor, like a collaborator's in a Figma file: an arrow and a name tag in the section hue,
 * with a speech bubble under them. Glides to `pos` (fixed, viewport px); each new `lineKey` fades
 * the line in. The bubble slides left as needed to stay on screen.
 * Used by the Brief tour and the Overview's one-time hint.
 */
export function GuideCursor({
  pos,
  visible,
  lineKey,
  children,
}: {
  pos: { x: number; y: number };
  visible: boolean;
  lineKey: string | number;
  children: React.ReactNode;
}) {
  const bubbleW = Math.min(272, window.innerWidth - 32);
  const bubbleLeft = Math.min(20, window.innerWidth - 16 - bubbleW - pos.x);
  return (
    <div
      className="tour"
      data-visible={visible}
      aria-hidden={!visible}
      data-print-hide
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="tour-arrow">
        <path d="M3 2.5 20.5 10l-7.4 2.6L10.5 20z" />
      </svg>
      <span aria-hidden className="tour-tag">
        Joko
      </span>
      <div className="tour-bubble" role="status" aria-live="polite" style={{ left: bubbleLeft, width: bubbleW }}>
        <div key={lineKey} className="tour-line">
          {children}
        </div>
      </div>
    </div>
  );
}

/** How long a line stays up: about 0.28 s a word, between 1.8 s and 4.2 s. */
export const readMs = (text: string) => Math.min(4200, Math.max(1800, 700 + text.split(/\s+/).length * 280));

/**
 * Where the arrow should point for an element: a little in from its left edge, at the middle of
 * the part that is on screen, kept clear of the window's edges.
 */
export function pointAt(el: Element) {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  const x = Math.min(Math.max(r.left + Math.min(r.width * 0.3, 160), 8), window.innerWidth - 48);
  const y = Math.min(Math.max((top + bottom) / 2, 12), window.innerHeight - 160);
  return { x, y };
}

/**
 * Where the cursor first appears for a target: a little below-right of it, so it fades in close by
 * and glides the last stretch (not from the corner, where Folio sits).
 */
export const besides = (p: { x: number; y: number }) => ({
  x: Math.min(p.x + 40, window.innerWidth - 48),
  y: Math.min(p.y + 48, window.innerHeight - 160),
});

/** Scrolls an element to just above the middle of the screen (a tall one: its top to 20%). */
export function bringIntoView(el: Element, smooth: boolean) {
  const r = el.getBoundingClientRect();
  const tall = r.height > window.innerHeight * 0.7;
  const target = tall ? r.top - window.innerHeight * 0.2 : r.top + r.height / 2 - window.innerHeight * 0.45;
  if (Math.abs(target) < 24) return;
  window.scrollTo({ top: window.scrollY + target, behavior: smooth ? "smooth" : "auto" });
}
