"use client";

// Other visitors on the Studio island (docs/studio.md, Multiplayer). Uses Community's sign-in (anonymous, behind
// the Turnstile check; one session for both pages, kept by the shared Supabase client) and the visitor's
// generated name from current_state(). Joins the private Realtime channel "island:main":
// - presence: each visitor's name, where they stand or are heading, whether they ride, the seat they sit on;
//   so a newcomer sees everyone where they are;
// - broadcast "walk": one message per click (from, to, riding); every browser works out the same route from the
//   same walk grid and animates it, so nobody streams positions;
// - broadcast "seat" and "talk": sitting down or getting up, and the six emoji and six phrases of Community.
// Every message is untrusted: a walk is kept only if its points are numbers on the island, talk only if it is a
// known emoji or phrase, a name only if it is a generated one. Anything else is dropped.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isProfile, phraseFor, reactionFor, shuffleProfile, type Profile } from "@/lib/community/words";

export type OnlineStatus = "offline" | "checking" | "needs-captcha" | "joining" | "ready" | "error";
export type XZ = [number, number];
export type Seat = [number, number];  // bench index, seat index
/** What another visitor is doing, as last heard; `n` changes whenever they start a new walk. */
/** v: the sender's own count of changes; a message older than the last one heard is ignored (no snapping back). */
export type OtherIntent = { profile: Profile; from: XZ; to: XZ; ride: boolean; seat: Seat | null; n: number; at: number; v: number; missing?: number };
export type Talk = { key: string; kind: "reaction" | "phrase"; id: string; uid: number };
export type OtherTag = { key: string; profile: Profile };

const TOPIC = "island:main";
const LIMIT = 26;              // the walk grid's half size (m)
const WALK_GAP_MS = 250;       // at most four walks a second from one visitor
const TALK_GAP_MS = 900;
const TRACK_GAP_MS = 1000;     // presence updates at most once a second
const GONE_MS = 4000;          // missing from presence this long: they left
const RETRY_MS = 2500;         // the channel dropped: join again after this
const CONFIGURED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let uid = 0;
// Development: ?bots=N replaces the real channel with pretend visitors (see the end of the hook).
const botsMode = () => process.env.NODE_ENV !== "production" && typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("bots");

const isXZ = (v: unknown): v is XZ =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMIT);
const isSeat = (v: unknown): v is Seat =>
  Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 0 && v[0] < 64 && (v[1] === 0 || v[1] === 1);
const round2 = (p: XZ): XZ => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

export function useIslandOnline(enabled: boolean, onTalk: (t: Talk) => void) {
  const [status, setStatus] = useState<OnlineStatus>(CONFIGURED ? "checking" : "offline");
  const [me, setMe] = useState<Profile | null>(null);
  const [tags, setTags] = useState<OtherTag[]>([]);
  const [retry, setRetry] = useState(0);
  const others = useRef(new Map<string, OtherIntent>());
  const channel = useRef<RealtimeChannel | null>(null);
  const key = useRef("");
  const meRef = useRef<Profile | null>(null);
  const mine = useRef<{ at: XZ; ride: boolean; seat: Seat | null; v: number }>({ at: [0, 0], ride: false, seat: null, v: 0 });
  const last = useRef({ walk: 0, talk: 0, track: 0 });
  const trackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const walkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const talkRef = useRef(onTalk);
  useEffect(() => {
    talkRef.current = onTalk;
  });

  // ---- sign-in (the same session as Community's) and the generated name
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !enabled || botsMode()) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => !cancelled && setStatus(data.session ? "joining" : "needs-captcha"));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const signIn = useCallback(async (captchaToken: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("joining");
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    setStatus(error ? "error" : "joining");
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || status !== "joining") return;
    let cancelled = false;
    supabase.rpc("current_state").then(({ data, error }) => {
      if (cancelled) return;
      const p = (data as { me?: unknown } | null)?.me;
      if (error || !isProfile(p)) {
        setStatus(error?.code === "28000" || error?.code === "PGRST301" ? "needs-captcha" : "error");
        return;
      }
      meRef.current = p;
      setMe(p);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  // ---- presence (with a little throttle: at most once a second)
  const track = useCallback(() => {
    const ch = channel.current, p = meRef.current;
    if (!ch || !p) return;
    const send = () => {
      last.current.track = Date.now();
      const m = mine.current;
      void ch.track({ profile: p, at: round2(m.at), ride: m.ride, seat: m.seat, v: m.v });
    };
    clearTimeout(trackTimer.current);
    const wait = TRACK_GAP_MS - (Date.now() - last.current.track);
    if (wait <= 0) send();
    else trackTimer.current = setTimeout(send, wait);
  }, []);

  // ---- the channel
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || status !== "ready" || !enabled || botsMode()) return;
    let ch: RealtimeChannel | null = null;
    let cancelled = false;
    key.current ||= crypto.randomUUID();   // never the user id: presence is visible to everyone
    const map = others.current;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      ch = supabase.channel(TOPIC, { config: { private: true, presence: { key: key.current }, broadcast: { self: false } } });
      ch.on("presence", { event: "sync" }, () => {
        const seen = new Set<string>(), now = Date.now();
        for (const [k, metas] of Object.entries(ch!.presenceState())) {
          if (k === key.current) continue;
          const m = metas[0] as unknown as Record<string, unknown>;
          if (!isProfile(m?.profile) || !isXZ(m.at)) continue;
          seen.add(k);
          const o = map.get(k);
          const seat = isSeat(m.seat) ? m.seat : null;
          const v = typeof m.v === "number" ? m.v : 0;
          if (!o) map.set(k, { profile: m.profile, from: m.at, to: m.at, ride: m.ride === true, seat, n: 0, at: now, v });
          else {
            o.profile = m.profile;
            o.missing = 0;
            // Presence goes out at most once a second: only newer than what the last walk or seat said counts.
            if (v > o.v) {
              Object.assign(o, { ride: m.ride === true, seat, v });
              if (m.at[0] !== o.to[0] || m.at[1] !== o.to[1]) Object.assign(o, { from: o.to, to: m.at, n: o.n + 1, at: now });
            }
          }
        }
        // Someone missing from one update (a name change or a seat re-sends their presence) stays for a few
        // seconds before they count as gone, so they don't blink out.
        for (const [k, o] of map) {
          if (seen.has(k)) continue;
          o.missing ||= now;
          if (now - o.missing > GONE_MS) map.delete(k);
        }
        setTags([...map].map(([k, o]) => ({ key: k, profile: o.profile })));
      })
        .on("broadcast", { event: "walk" }, ({ payload }) => {
          const p = payload as Record<string, unknown>;
          const o = typeof p?.key === "string" ? map.get(p.key) : undefined;
          if (!o || !isXZ(p.from) || !isXZ(p.to)) return;
          const v = typeof p.v === "number" ? p.v : o.v + 1;
          if (v <= o.v) return;                               // older than what we already know
          Object.assign(o, { from: p.from, to: p.to, ride: p.ride === true, seat: null, n: o.n + 1, at: Date.now(), v });
        })
        .on("broadcast", { event: "seat" }, ({ payload }) => {
          const p = payload as Record<string, unknown>;
          const o = typeof p?.key === "string" ? map.get(p.key) : undefined;
          const v = typeof p.v === "number" ? p.v : (o?.v ?? 0) + 1;
          if (o && v > o.v && (p.seat === null || isSeat(p.seat))) Object.assign(o, { seat: p.seat as Seat | null, v });
        })
        .on("broadcast", { event: "talk" }, ({ payload }) => {
          const p = payload as Record<string, unknown>;
          if (typeof p?.key !== "string" || !map.has(p.key)) return;
          if ((p.kind === "reaction" && reactionFor(p.id)) || (p.kind === "phrase" && phraseFor(p.id))) {
            talkRef.current({ key: p.key, kind: p.kind, id: p.id as string, uid: ++uid });
          }
        })
        .subscribe((s) => {
          if (s === "SUBSCRIBED") track();
          // A dropped channel (network, a token refresh) joins again on its own, with the same key.
          if ((s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") && !cancelled) {
            if (process.env.NODE_ENV !== "production") console.warn("Island channel:", s, "- joining again");
            window.setTimeout(() => !cancelled && setRetry((r) => r + 1), RETRY_MS);
          }
        });
      channel.current = ch;
    })();

    return () => {
      cancelled = true;
      channel.current = null;
      clearTimeout(trackTimer.current);
      map.clear();
      setTags([]);
      if (ch) void supabase.removeChannel(ch);
    };
  }, [status, enabled, track, retry]);

  // ---- what this visitor does
  const walk = useCallback((from: XZ, to: XZ, ride: boolean) => {
    mine.current.at = to;
    mine.current.ride = ride;
    mine.current.seat = null;
    const v = ++mine.current.v;
    // At most four a second; a walk inside the gap is sent when it ends (the latest one wins), never dropped.
    const send = () => {
      last.current.walk = Date.now();
      channel.current?.send({ type: "broadcast", event: "walk", payload: { key: key.current, from: round2(from), to: round2(to), ride, v } });
    };
    clearTimeout(walkTimer.current);
    const wait = WALK_GAP_MS - (Date.now() - last.current.walk);
    if (wait <= 0) send();
    else walkTimer.current = setTimeout(send, wait);
    track();
  }, [track]);

  const sit = useCallback((seat: Seat | null) => {
    mine.current.seat = seat;
    const v = ++mine.current.v;
    channel.current?.send({ type: "broadcast", event: "seat", payload: { key: key.current, seat, v } });
    track();
  }, [track]);

  const talk = useCallback((kind: "reaction" | "phrase", id: string) => {
    if (kind === "reaction" ? !reactionFor(id) : !phraseFor(id)) return false;
    const now = Date.now();
    if (now - last.current.talk < TALK_GAP_MS) return false;
    last.current.talk = now;
    talkRef.current({ key: "me", kind, id, uid: ++uid });
    channel.current?.send({ type: "broadcast", event: "talk", payload: { key: key.current, kind, id } });
    return true;
  }, []);

  const shuffle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !meRef.current) return;
    const next = shuffleProfile(meRef.current);
    meRef.current = next;
    setMe(next);
    track();
    await supabase.rpc("save_profile", next);
  }, [track]);

  // ---- development only: ?bots=3 fills the island with pretend visitors (no Supabase), to try things alone
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !enabled) return;
    const n = Math.min(12, Number(new URLSearchParams(window.location.search).get("bots")) || 0);
    if (!n) return;
    const map = others.current;
    const spots: XZ[] = [[0, 3], [3, -3], [-4, -2], [5, 5], [-6, 6], [8, 2], [-2, 9], [2, 12], [-9, -4]];
    const pick = () => spots[Math.floor(Math.random() * spots.length)];
    meRef.current = shuffleProfile();
    setMe(meRef.current);
    setStatus("ready");
    for (let i = 0; i < n; i++) map.set(`bot-${i}`, { profile: shuffleProfile(), from: pick(), to: pick(), ride: false, seat: null, n: 0, at: Date.now(), v: 0 });
    setTags([...map].map(([k, o]) => ({ key: k, profile: o.profile })));
    // Test hooks: make a pretend visitor sit, ride or shuffle its name on demand.
    (window as unknown as { __bots?: unknown }).__bots = {
      sit: (i: number, seat: Seat) => { const o = map.get(`bot-${i}`); if (o) o.seat = seat; },
      shuffle: (i: number) => {
        const o = map.get(`bot-${i}`);
        if (o) o.profile = shuffleProfile(o.profile);
        setTags([...map].map(([k, v]) => ({ key: k, profile: v.profile })));
      },
      intents: () => [...map].map(([k, o]) => ({ k, seat: o.seat, ride: o.ride, n: o.n, to: o.to })),
      walk: (i: number, to: XZ) => { const o = map.get(`bot-${i}`); if (o) Object.assign(o, { from: o.to, to, ride: false, seat: null, n: o.n + 1, at: Date.now() }); },
      pause: (on = true) => { paused = on; },
    };
    let paused = false;
    const timer = window.setInterval(() => {
      if (paused) return;
      const k = `bot-${Math.floor(Math.random() * n)}`, o = map.get(k);
      if (!o) return;
      const r = Math.random();
      if (r < 0.15) o.seat = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 2)];
      else if (r < 0.3) talkRef.current({ key: k, kind: Math.random() < 0.5 ? "reaction" : "phrase", id: (Math.random() < 0.5 ? ["clap", "fire", "love"] : ["ship-it", "bold-choice"])[0], uid: ++uid });
      else Object.assign(o, { from: o.to, to: pick(), ride: Math.random() < 0.25, seat: null, n: o.n + 1, at: Date.now() });
    }, 1500);
    return () => {
      window.clearInterval(timer);
      map.clear();
      setTags([]);
    };
  }, [enabled]);

  /** This visitor's presence key (to settle two visitors picking the same seat at once). */
  const myKey = useCallback(() => key.current, []);

  return { status, me, tags, others, signIn, walk, sit, talk, shuffle, myKey };
}
