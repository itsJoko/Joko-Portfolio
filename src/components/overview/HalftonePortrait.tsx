"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Burst timing, in seconds: the wave crosses the portrait, each dot flies out, then springs home.
const WAVE = 0.22;
const OUT = 0.2;
const BACK = 1.15;
const TOTAL = WAVE + OUT + BACK;
const flyOut = gsap.parseEase("power3.out");
const settle = gsap.parseEase("elastic.out(1, 0.4)");

// Ripple spring: underdamped, so pushed dots overshoot once and settle.
const STIFFNESS = 170;
const DAMPING = 12;

const TAU = Math.PI * 2;
// Cells darker than this get no dot. The studio backdrop is near-black grain that barely shows as dots
// but was most of the work: cutting it takes a large portrait from about 9,400 dots to about 2,900.
const MIN_LUM = 0.03;
// The loop stops once the fastest dot is slower than this (px/s); a move, scroll or burst wakes it.
const REST_SPEED = 2;

type Dots = {
  n: number;
  hx: Float32Array; // home, relative to the photo's top-left
  hy: Float32Array;
  r: Float32Array;
  ox: Float32Array; // ripple offset and velocity
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  bx: Float32Array; // burst vector and delay
  by: Float32Array;
  delay: Float32Array;
  px: Float32Array; // drawn position this frame
  py: Float32Array;
};

/**
 * The hero portrait as a halftone hologram. At rest the real photo shows. Under a fine pointer the photo
 * gives way to blue halftone dots that burst from where the pointer came in and spring back elastically,
 * then ripple away from the pointer while it moves. A tap plays one burst on touch screens.
 * Sits inside `.hero-photo`, samples the <img> already loaded there, and runs only while it's visible.
 * Reduced motion: not rendered (CSS), and no listeners are attached.
 */
export function HalftonePortrait() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = ref.current!;
    const frame = layer.parentElement!;
    const img = frame.querySelector("img");
    const canvas = layer.querySelector("canvas")!;
    const ctx = canvas.getContext("2d");
    if (!img || !ctx) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    let dots: Dots | null = null;
    let builtFor = 0;
    // The photo's box inside the canvas (CSS px), its corner radius, and the canvas's own size.
    let ix = 0, iy = 0, iw = 0, ih = 0, radius = 0, cw = 0, ch = 0, spacing = 4;
    let colours = { dot: "", ground: "" };

    const clock = { t: TOTAL };
    let burstTween: gsap.core.Tween | null = null;
    // Kept in viewport px and converted each frame, so the ripple stays under the pointer when the page
    // scrolls without the mouse moving.
    let pointer: { x: number; y: number } | null = null;
    let running = false;
    let hideTimer = 0;

    const measure = () => {
      const cr = canvas.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      ix = ir.left - cr.left;
      iy = ir.top - cr.top;
      iw = ir.width;
      ih = ir.height;
      cw = cr.width;
      ch = cr.height;
      radius = parseFloat(getComputedStyle(img).borderTopLeftRadius) || 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The layer carries .dark, so these resolve to the dark-theme hues: the dots always sit on black.
      const s = getComputedStyle(layer);
      colours = {
        dot: s.getPropertyValue("--c-overview").trim(),
        ground: s.getPropertyValue("--bg").trim(),
      };
    };

    // One dot per cell on a staggered grid; its radius follows the photo's brightness there.
    const build = () => {
      spacing = Math.min(7, Math.max(3, iw / 85));
      const cols = Math.floor(iw / spacing);
      const rows = Math.floor(ih / spacing);
      const sample = document.createElement("canvas");
      sample.width = cols;
      sample.height = rows;
      const sctx = sample.getContext("2d", { willReadFrequently: true })!;
      sctx.imageSmoothingQuality = "high";
      // Match object-cover (centred), so the dots land where the photo's pixels are on screen. The whole
      // image goes through a canvas first: with srcset, drawImage's source rectangle is in the file's
      // pixels, which differ from naturalWidth by the picked density, so cropping the <img> directly misses.
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const full = document.createElement("canvas");
      full.width = nw;
      full.height = nh;
      full.getContext("2d")!.drawImage(img, 0, 0, nw, nh);
      const scale = Math.max(iw / nw, ih / nh);
      const sw = iw / scale, sh = ih / scale;
      sctx.drawImage(full, (nw - sw) / 2, (nh - sh) / 2, sw, sh, 0, 0, cols, rows);
      const data = sctx.getImageData(0, 0, cols, rows).data;

      const hx: number[] = [], hy: number[] = [], rad: number[] = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const k = (y * cols + x) * 4;
          const lum = (0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2]) / 255;
          if (lum < MIN_LUM) continue;
          // Lifted a little: the studio photo is low-key and its shadow side would vanish otherwise.
          const r = spacing * 0.62 * Math.sqrt(Math.pow(lum, 0.8));
          if (r < 0.35) continue;
          hx.push((x + 0.5 + (y % 2 ? 0.5 : 0)) * spacing);
          hy.push((y + 0.5) * spacing);
          rad.push(r);
        }
      }
      const n = hx.length;
      const f = () => new Float32Array(n);
      dots = {
        n, hx: Float32Array.from(hx), hy: Float32Array.from(hy), r: Float32Array.from(rad),
        ox: f(), oy: f(), vx: f(), vy: f(), bx: f(), by: f(), delay: f(), px: f(), py: f(),
      };
      builtFor = iw;
    };

    const ready = () => {
      if (!img.complete || !img.naturalWidth) return false;
      measure();
      if (!dots || Math.abs(builtFor - iw) > 1) build();
      return true;
    };

    // Every dot is thrown away from the entry point, harder the closer it is, and the wave reaches the
    // far side last, so the portrait comes apart from where it was touched.
    const burst = (px: number, py: number) => {
      const d = dots!;
      const diag = Math.hypot(iw, ih);
      for (let i = 0; i < d.n; i++) {
        let dx = d.hx[i] - px;
        let dy = d.hy[i] - py;
        const dist = Math.hypot(dx, dy) || 1;
        dx /= dist;
        dy /= dist;
        const near = 1 - dist / diag;
        const mag = iw * (0.08 + 0.3 * Math.random()) * (0.35 + 0.65 * near * near);
        const swirl = (Math.random() - 0.5) * 0.6;
        d.bx[i] = (dx - dy * swirl) * mag;
        d.by[i] = (dy + dx * swirl) * mag;
        d.delay[i] = (dist / diag) * WAVE;
      }
      burstTween?.kill();
      clock.t = 0;
      burstTween = gsap.to(clock, { t: TOTAL, duration: TOTAL, ease: "none" });
      start();
    };

    const roundRect = () => {
      ctx.beginPath();
      ctx.roundRect(ix, iy, iw, ih, radius);
      ctx.fillStyle = colours.ground;
      ctx.fill();
    };

    // One colour, one path: every dot in the Overview blue.
    const drawDots = () => {
      const d = dots!;
      ctx.fillStyle = colours.dot;
      ctx.beginPath();
      for (let i = 0; i < d.n; i++) {
        const x = d.px[i];
        const y = d.py[i];
        ctx.moveTo(x + d.r[i], y);
        ctx.arc(x, y, d.r[i], 0, TAU);
      }
      ctx.fill();
    };

    const tick = (_time: number, deltaMs: number) => {
      const d = dots!;
      const dt = Math.min(deltaMs / 1000, 1 / 30);
      const t = clock.t;
      const reach = iw * 0.2;
      const reach2 = reach * reach;
      const push = iw * 0.07;
      let fastest = 0;
      let px = 0, py = 0;
      if (pointer) {
        const r = img.getBoundingClientRect();
        px = pointer.x - r.left;
        py = pointer.y - r.top;
      }

      for (let i = 0; i < d.n; i++) {
        // Ripple: a spring toward a point pushed away from the pointer.
        let tx = 0, ty = 0;
        if (pointer) {
          const dx = d.hx[i] - px;
          const dy = d.hy[i] - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach2 && d2 > 0.0001) {
            const dist = Math.sqrt(d2);
            const f = 1 - dist / reach;
            tx = (dx / dist) * f * f * push;
            ty = (dy / dist) * f * f * push;
          }
        }
        d.vx[i] += ((tx - d.ox[i]) * STIFFNESS - d.vx[i] * DAMPING) * dt;
        d.vy[i] += ((ty - d.oy[i]) * STIFFNESS - d.vy[i] * DAMPING) * dt;
        d.ox[i] += d.vx[i] * dt;
        d.oy[i] += d.vy[i] * dt;
        const speed = Math.abs(d.vx[i]) + Math.abs(d.vy[i]);
        if (speed > fastest) fastest = speed;

        // Burst: out fast, then home on an elastic ease.
        let b = 0;
        const local = t - d.delay[i];
        if (local > 0 && t < TOTAL) b = local < OUT ? flyOut(local / OUT) : 1 - settle(Math.min((local - OUT) / BACK, 1));

        d.px[i] = ix + d.hx[i] + d.ox[i] + d.bx[i] * b;
        d.py[i] = iy + d.hy[i] + d.oy[i] + d.by[i] * b;
      }

      ctx.clearRect(0, 0, cw, ch);
      roundRect();
      drawDots();

      // Stop once everything is still, hovered or not: the last frame stays on the canvas, and the next
      // pointer move, scroll or burst starts the loop again.
      if (t >= TOTAL && fastest < REST_SPEED) stop();
    };

    const start = () => {
      if (running || !dots) return;
      running = true;
      gsap.ticker.add(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    };

    const show = () => {
      window.clearTimeout(hideTimer);
      layer.dataset.on = "";
    };
    const hide = () => {
      delete layer.dataset.on;
    };

    const local = (e: PointerEvent) => {
      const r = img.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const ac = new AbortController();
    const { signal } = ac;

    // Mouse: burst on entry, ripple while moving, back to the photo on leaving.
    frame.addEventListener(
      "pointerenter",
      (e) => {
        if (e.pointerType !== "mouse" || !fine.matches || !ready()) return;
        const p = local(e);
        pointer = { x: e.clientX, y: e.clientY };
        show();
        burst(p.x, p.y);
      },
      { signal },
    );
    frame.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse" || layer.dataset.on === undefined) return;
        pointer = { x: e.clientX, y: e.clientY };
        start();
      },
      { signal },
    );
    // Scrolling moves the portrait under a still pointer, so the ripple has to catch up.
    window.addEventListener(
      "scroll",
      () => {
        if (pointer) start();
      },
      { passive: true, signal },
    );
    // Off screen (scrolled away without a pointerleave): let go, and the loop winds down by itself.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) return;
      pointer = null;
      hide();
      start();
    });
    io.observe(frame);
    frame.addEventListener(
      "pointerleave",
      (e) => {
        if (e.pointerType !== "mouse") return;
        pointer = null;
        hide();
        start(); // let the pushed dots spring home before the loop stops
      },
      { signal },
    );

    // Touch: a tap (not a scroll) plays one burst, then the photo returns.
    let down: { x: number; y: number; at: number } | null = null;
    frame.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "mouse") down = { x: e.clientX, y: e.clientY, at: e.timeStamp };
      },
      { signal },
    );
    frame.addEventListener(
      "pointerup",
      (e) => {
        const start = down;
        down = null;
        if (e.pointerType === "mouse" || !start) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 || e.timeStamp - start.at > 500) return;
        if (!ready()) return;
        const p = local(e);
        show();
        burst(p.x, p.y);
        hideTimer = window.setTimeout(hide, (TOTAL - 0.25) * 1000);
      },
      { signal },
    );
    frame.addEventListener("pointercancel", () => (down = null), { signal });

    return () => {
      ac.abort();
      io.disconnect();
      burstTween?.kill();
      window.clearTimeout(hideTimer);
      stop();
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="halftone dark">
      <canvas />
    </div>
  );
}
