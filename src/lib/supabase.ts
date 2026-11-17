"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-only Supabase client for the Community page. Both values are public by design:
// the publishable key can only do what row-level security and the database functions allow.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/**
 * The shared client, or null when the env values are missing (the page then shows itself as offline).
 * In development, `?visitor=2` (any word) keeps a separate session, so two tabs act as two visitors.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!url || !key || typeof window === "undefined") return (client = null);

  let storageKey = "community-auth";
  if (process.env.NODE_ENV === "development") {
    const visitor = new URLSearchParams(window.location.search).get("visitor");
    if (visitor && /^\w{1,12}$/.test(visitor)) storageKey += `-${visitor}`;
  }

  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey },
  });
  return client;
}
