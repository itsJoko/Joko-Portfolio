"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PiCaretLeft, PiCaretRight, PiX } from "react-icons/pi";
import type { PostImage } from "@/lib/posts";

/**
 * A post's pictures in their own column beside the text (below it on phones). Each opens large
 * in a viewer sized to the window; arrows and the ← → keys step through the post's pictures.
 */
export function PostGallery({ images }: { images: PostImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;

  return (
    <>
      <ul className="post-gallery" aria-label="Pictures">
        {images.map((img, i) => (
          <li key={img.src}>
            <button type="button" className="post-shot pressable" data-cursor="View" onClick={() => setOpen(i)} aria-label={`View larger: ${img.alt}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Markdown pictures with unknown sizes; already web-sized WebP */}
              <img src={img.src} alt="" width={img.width} height={img.height} loading="lazy" decoding="async" />
            </button>
            {img.caption && <p className="post-shot-caption">{img.caption}</p>}
          </li>
        ))}
      </ul>
      {open !== null && images[open] && <ImageViewer images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function ImageViewer({ images, index, onIndex, onClose }: { images: PostImage[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const img = images[index];
  const go = useCallback((step: number) => onIndex((index + step + images.length) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Start on the dialog itself, so no button is ringed by a mouse click; Tab reaches them.
    dialog.focus();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-cursor-keep
      tabIndex={-1}
      className="image-viewer"
      aria-label={img.alt}
      // Every way out goes through dialog.close(), so the custom cursor moves back to the page.
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="image-viewer-inner">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {index + 1} of {images.length}
          </p>
          <div className="flex items-center gap-2">
            {images.length > 1 && (
              <>
                <button type="button" className="btn pressable !p-3" aria-label="Previous picture" onClick={() => go(-1)}>
                  <PiCaretLeft aria-hidden data-nudge="left" className="size-5" />
                </button>
                <button type="button" className="btn pressable !p-3" aria-label="Next picture" onClick={() => go(1)}>
                  <PiCaretRight aria-hidden data-nudge="right" className="size-5" />
                </button>
              </>
            )}
            <button type="button" className="btn btn-primary pressable !p-3" aria-label="Close" onClick={() => ref.current?.close()}>
              <PiX aria-hidden data-nudge="turn" className="size-5" />
            </button>
          </div>
        </div>
        <figure className="image-viewer-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img key={img.src} src={img.src} alt={img.alt} width={img.width} height={img.height} />
          {img.caption && <figcaption>{img.caption}</figcaption>}
        </figure>
      </div>
    </dialog>
  );
}
