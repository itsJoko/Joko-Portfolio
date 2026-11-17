"use client";

import { useId, useState } from "react";
import { PiCaretDown } from "react-icons/pi";

/**
 * One tap-to-open band of the phone footer. A real button (aria-expanded) controls a region whose
 * height eases open through a grid-rows transition (0fr → 1fr), with the contents fading in; closing
 * is quicker than opening. Closed contents are `inert`, so they leave the tab order too.
 */
export function FooterFold({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="footer-fold" data-open={open}>
      <h2>
        <button
          type="button"
          className="footer-fold-toggle"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          onClick={() => setOpen((o) => !o)}
        >
          {title}
          <PiCaretDown aria-hidden className="footer-fold-caret size-5" />
        </button>
      </h2>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} className="footer-fold-panel" inert={!open}>
        <div className="footer-fold-clip">
          <div className="footer-fold-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
