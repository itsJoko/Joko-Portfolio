"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isOption, isProfile, phraseFor, reactionFor, shuffleProfile, type Decisions, type Profile } from "./words";

// ---- What current_state() returns (see supabase/migrations/*_community_functions.sql) ----
export type Tally = { option: string; votes: number }[];
export type Round = {
  id: number;
  step: number;
  decision: string;
  options: string[];
  opens_at: string;
  closes_at: string;
  tally: Tally;
  voters: number;
  my_choice: string | null;
};
export type CommunityState = {
  now: string;
  me: Profile | null;
  poster: { id: number; decisions: Decisions; started_at: string; contributors: number } | null;
  round: Round | null;
  previous: { poster_id: number; step: number; decision: string; winner: string } | null;
};

export type Status = "offline" | "checking" | "needs-captcha" | "joining" | "ready" | "error";
export type Visitor = { key: string; profile: Profile; self: boolean };
export type TalkEvent =
  | { kind: "reaction"; id: string; uid: number }
  | { kind: "phrase"; id: string; from: Profile; uid: number };

const TOPIC = "community:studio";
const POLL_MS = 2000;
const REACTION_GAP_MS = 350;
const PHRASE_GAP_MS = 2500;

let uid = 0;

// Known the same way on the server and in the browser, so the first render matches.
const CONFIGURED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/**
 * Everything the Community page needs from Supabase: anonymous sign-in (after the Turnstile
 * check), polling current_state() every 2 s while the tab is visible, voting, the generated
 * name, presence ("who's here") and broadcast talk. Realtime messages are untrusted: anything
 * that isn't a known reaction, phrase or generated name is dropped.
 */
export function useCommunity(onTalk: (event: TalkEvent) => void) {
  const [status, setStatus] = useState<Status>(CONFIGURED ? "checking" : "offline");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CommunityState | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const offset = useRef(0); // server clock minus local clock, in ms
  const channel = useRef<RealtimeChannel | null>(null);
  const presenceKey = useRef<string>("");
  const meRef = useRef<Profile | null>(null);
  const talkRef = useRef(onTalk);
  const lastSent = useRef({ reaction: 0, phrase: 0 });
  const fetchSoon = useRef<() => void>(() => {});
  useEffect(() => {
    talkRef.current = onTalk;
  });

  // ---- Sign-in ----
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return; // not configured: status started as "offline"
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "ready" : "needs-captcha");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (captchaToken: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("joining");
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("ready");
  }, []);

  // ---- current_state() polling ----
  const fetchState = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const sent = Date.now();
    const { data, error } = await supabase.rpc("current_state");
    const received = Date.now();
    if (error) {
      // An expired or missing session: go back through the join step.
      if (error.code === "28000" || error.message === "not_signed_in" || error.code === "PGRST301") {
        setStatus("needs-captcha");
      } else {
        setError(error.message);
      }
      return;
    }
    const next = data as CommunityState;
    offset.current = new Date(next.now).getTime() - (sent + received) / 2;
    meRef.current = next.me;
    setState(next);
    setError(null);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const loop = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      await fetchState();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    // Fetch soon (debounced): after a "someone voted" ping or when the timer runs out.
    let soon: ReturnType<typeof setTimeout> | undefined;
    fetchSoon.current = () => {
      clearTimeout(soon);
      soon = setTimeout(() => {
        clearTimeout(timer);
        loop();
      }, 250);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, fetchState]);

  // Ask again the moment the open round ends, rather than up to 2 s later.
  const closesAt = state?.round?.closes_at;
  useEffect(() => {
    if (!closesAt) return;
    const wait = new Date(closesAt).getTime() - (Date.now() + offset.current) + 150;
    const t = setTimeout(() => fetchSoon.current(), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [closesAt]);

  // ---- Realtime: presence and talk ----
  const hasProfile = !!state?.me;
  useEffect(() => {
    const supabase = getSupabase();
    if (status !== "ready" || !supabase || !hasProfile) return;
    let ch: RealtimeChannel | null = null;
    let cancelled = false;
    presenceKey.current ||= crypto.randomUUID(); // never the user id: presence is visible to everyone

    (async () => {
      await supabase.realtime.setAuth(); // private channel: send the visitor's token first
      if (cancelled) return;
      ch = supabase.channel(TOPIC, {
        config: { private: true, presence: { key: presenceKey.current }, broadcast: { self: false } },
      });
      ch.on("presence", { event: "sync" }, () => {
        const list: Visitor[] = [];
        for (const [key, metas] of Object.entries(ch!.presenceState())) {
          const profile = (metas[0] as unknown as { profile?: unknown })?.profile;
          if (isProfile(profile)) list.push({ key, profile, self: key === presenceKey.current });
        }
        list.sort((a, b) => Number(b.self) - Number(a.self));
        setVisitors(list);
      })
        .on("broadcast", { event: "talk" }, ({ payload }) => {
          const p = payload as Record<string, unknown>;
          if (p?.kind === "reaction" && reactionFor(p.id)) {
            talkRef.current({ kind: "reaction", id: p.id as string, uid: ++uid });
          } else if (p?.kind === "phrase" && phraseFor(p.id) && isProfile(p.from)) {
            talkRef.current({ kind: "phrase", id: p.id as string, from: p.from, uid: ++uid });
          }
        })
        .on("broadcast", { event: "voted" }, () => fetchSoon.current())
        .subscribe((s) => {
          if (s === "SUBSCRIBED" && meRef.current) ch?.track({ profile: meRef.current });
        });
      channel.current = ch;
    })();

    return () => {
      cancelled = true;
      channel.current = null;
      if (ch) supabase.removeChannel(ch);
    };
  }, [status, hasProfile]);

  // ---- Actions ----
  const vote = useCallback(async (choice: string) => {
    const supabase = getSupabase();
    const round = state?.round;
    if (!supabase || !round || !isOption(round.decision, choice)) return;

    // Optimistic: move the visitor's vote at once, then take the server's tally.
    setState((s) => {
      if (!s?.round || s.round.id !== round.id) return s;
      const prev = s.round.my_choice;
      const tally = s.round.tally.map((t) => ({
        ...t,
        votes: t.votes + (t.option === choice ? 1 : 0) - (t.option === prev ? 1 : 0),
      }));
      return { ...s, round: { ...s.round, my_choice: choice, tally, voters: s.round.voters + (prev ? 0 : 1) } };
    });

    const { data, error } = await supabase.rpc("cast_vote", { round_id: round.id, choice });
    if (error) {
      fetchSoon.current(); // round_closed and friends: just catch up with the server
      return;
    }
    const result = data as { round_id: number; tally: Tally };
    setState((s) => (s?.round?.id === result.round_id ? { ...s, round: { ...s.round, tally: result.tally } } : s));
    channel.current?.send({ type: "broadcast", event: "voted", payload: {} });
  }, [state?.round]);

  const shuffleName = useCallback(async () => {
    const supabase = getSupabase();
    const current = meRef.current;
    if (!supabase || !current) return;
    const next = shuffleProfile(current);
    meRef.current = next;
    setState((s) => (s ? { ...s, me: next } : s));
    channel.current?.track({ profile: next });
    const { error } = await supabase.rpc("save_profile", next);
    if (error) fetchSoon.current();
  }, []);

  const react = useCallback((id: string) => {
    if (!reactionFor(id)) return false;
    const now = Date.now();
    if (now - lastSent.current.reaction < REACTION_GAP_MS) return false;
    lastSent.current.reaction = now;
    talkRef.current({ kind: "reaction", id, uid: ++uid });
    channel.current?.send({ type: "broadcast", event: "talk", payload: { kind: "reaction", id } });
    return true;
  }, []);

  const say = useCallback((id: string) => {
    const me = meRef.current;
    if (!phraseFor(id) || !me) return false;
    const now = Date.now();
    if (now - lastSent.current.phrase < PHRASE_GAP_MS) return false;
    lastSent.current.phrase = now;
    talkRef.current({ kind: "phrase", id, from: me, uid: ++uid });
    channel.current?.send({ type: "broadcast", event: "talk", payload: { kind: "phrase", id, from: me } });
    return true;
  }, []);

  /** Server time now, in ms (local clock corrected by the last response). */
  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { status, error, state, visitors, signIn, vote, shuffleName, react, say, serverNow };
}
