"use client";

import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EVERY_MS = 20_000;

/**
 * How many visitors are on the Community page right now, for the sidebar on every page.
 * A plain fetch to the online_count() function (no Supabase library on every page), every
 * 20 s while the tab is visible. Null until known or when Supabase isn't configured.
 */
export function useOnlineCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!url || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const controller = new AbortController();

    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`${url}/rest/v1/rpc/online_count`, {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
        if (res.ok) {
          const n = await res.json();
          if (typeof n === "number") setCount(n);
        }
      } catch {
        // Offline or aborted: keep the last number.
      }
      if (!stopped) timer = setTimeout(tick, EVERY_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}
