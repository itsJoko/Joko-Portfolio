"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the bot check."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile, the "are you human?" check Supabase requires before an anonymous
 * sign-in. Usually invisible ("interaction-only"); it shows a small box only when Cloudflare
 * wants a click.
 */
export function Turnstile({ onToken, onError }: { onToken: (token: string) => void; onError: (message: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onToken, onError });
  useEffect(() => {
    handlers.current = { onToken, onError };
  });

  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      handlers.current.onError("The bot check isn't set up (missing site key).");
      return;
    }
    let id: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey,
          action: "community-join",
          appearance: "interaction-only",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          callback: (token: string) => handlers.current.onToken(token),
          "error-callback": () => handlers.current.onError("The bot check failed. Reload the page to try again."),
        });
      })
      .catch((e: Error) => handlers.current.onError(e.message));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  return <div ref={box} className="min-h-0" />;
}
