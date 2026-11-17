"use client";

import { useSyncExternalStore } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EVERY_MS = 20_000;

// One shared poll for every component that shows the count (sidebar badge, Overview teaser):
// it runs while at least one is on screen and the tab is visible.
let count: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | null = null;

async function tick() {
  clearTimeout(timer);
  if (!listeners.size || document.visibilityState === "hidden") return;
  controller = new AbortController();
  try {
    const res = await fetch(`${url}/rest/v1/rpc/online_count`, {
      method: "POST",
      headers: { apikey: key!, "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    if (res.ok) {
      const n = await res.json();
      if (typeof n === "number" && n !== count) {
        count = n;
        listeners.forEach((l) => l());
      }
    }
  } catch {
    // Offline or aborted: keep the last number.
  }
  if (listeners.size) timer = setTimeout(tick, EVERY_MS);
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  if (!url || !key) return () => {};
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisible);
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/**
 * How many visitors are on the Community page right now (online_count(), a number only).
 * A plain fetch, no Supabase library on every page. Null until known or when not configured.
 */
export function useOnlineCount() {
  return useSyncExternalStore(subscribe, () => count, () => null);
}
