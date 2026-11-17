import { optionLabel, type DecisionKey, type Decisions } from "@/lib/community/words";

/**
 * The shared poster, drawn entirely from the eight decision ids (styles in globals.css under
 * "Community poster"). Undecided parts fall back to a blueprint: outline type on the page
 * ground, like the site's "design first, then build" idea. When the palette is chosen the
 * poster fills solid. Sized with container query units, so the same component works live
 * and as a small archive thumbnail.
 */
export function Poster({
  decisions,
  number,
  previewKey,
  className = "",
}: {
  decisions: Decisions;
  number?: number;
  /** The decision being previewed (hovered option), marked for screen readers. */
  previewKey?: DecisionKey | null;
  className?: string;
}) {
  const d = decisions;
  const word = d.theme ? optionLabel("theme", d.theme) : "Untitled";
  // "none" is a real choice: the committee voted for no stamp.
  const stamp = d.stamp && d.stamp !== "none" ? optionLabel("stamp", d.stamp) : null;
  const label = [
    `Poster${number ? ` number ${number}` : ""}: ${word}`,
    ...(["layout", "typeface", "palette", "motif", "scale", "texture", "stamp"] as const)
      .filter((k) => d[k])
      .map((k) => `${k} ${optionLabel(k, d[k]!)}`),
    previewKey ? "(previewing your pick)" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={label}
      className={`poster ${className}`}
      data-palette={d.palette ?? "blueprint"}
      data-layout={d.layout ?? "centred"}
      data-typeface={d.typeface ?? "funnel"}
      data-motif={d.motif ?? "none"}
      data-scale={d.scale ?? "balanced"}
      data-texture={d.texture ?? "clean"}
      data-theme-set={d.theme ? "true" : "false"}
    >
      <div aria-hidden className="poster-motif" />
      <div aria-hidden className="poster-body">
        <span className="poster-word">{word}</span>
      </div>
      {stamp && (
        <span aria-hidden className="poster-stamp">
          {stamp}
        </span>
      )}
      <div aria-hidden className="poster-texture" />
    </div>
  );
}
