"use client";

import { useCallback, useEffect, useState } from "react";
import { PiShuffle } from "react-icons/pi";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCommunity, type Round, type TalkEvent } from "@/lib/community/useCommunity";
import {
  DECISIONS,
  PHRASES,
  REACTIONS,
  colourLabel,
  decisionFor,
  nameOf,
  optionLabel,
  phraseFor,
  reactionFor,
  type DecisionKey,
  type Decisions,
  type Profile,
} from "@/lib/community/words";
import { Archive } from "./Archive";
import { Poster } from "./Poster";
import { Turnstile } from "./Turnstile";

type Float = TalkEvent & { x: number; r: number };

/** The Community page: one shared poster, a 15-second vote, preset talk, who's here, the archive. */
export function CommunityStudio() {
  const [floats, setFloats] = useState<Float[]>([]);
  const onTalk = useCallback((event: TalkEvent) => {
    const x = event.kind === "phrase" ? 22 + Math.random() * 56 : 8 + Math.random() * 84;
    setFloats((list) => [...list.slice(-24), { ...event, x, r: Math.round(Math.random() * 30 - 15) }]);
  }, []);
  const { status, error, state, visitors, signIn, vote, shuffleName, react, say, serverNow } = useCommunity(onTalk);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const round = state?.round ?? null;
  const decisions: Decisions = { ...(state?.poster?.decisions ?? {}) };
  const roundKey = round?.decision as DecisionKey | undefined;
  const shown = roundKey ? (preview && round?.options.includes(preview) ? preview : round?.my_choice) : null;
  if (roundKey && shown) decisions[roundKey] = shown;

  // A decision landed: sweep the poster (not on first load) and announce it.
  const applied = `${state?.previous?.poster_id ?? 0}-${state?.previous?.step ?? 0}`;
  const [seenApplied, setSeenApplied] = useState<string | null>(null);
  const [sweep, setSweep] = useState(0);
  const [announce, setAnnounce] = useState("");
  if (state?.previous && applied !== seenApplied) {
    // Adjusting state while rendering when the data changes (React's recommended pattern).
    setSeenApplied(applied);
    if (seenApplied !== null) {
      setSweep((n) => n + 1);
      const p = state.previous;
      const next = state.round ? decisionFor(state.round.decision)?.label : null;
      setAnnounce(
        `${decisionFor(p.decision)?.label}: ${optionLabel(p.decision, p.winner)} won.${next ? ` Now voting on ${next}.` : ""}`,
      );
    }
  }

  const ready = status === "ready" && !!state;

  return (
    <>
      <PageHeader
        title="Community"
        lead="Design one poster together. Every 15 seconds, everyone here votes on the next decision."
        count={visitors.length || undefined}
      />

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <section aria-label="The shared poster" className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Poster stage */}
        <div className="lg:col-span-7">
          <div className="studio-frame">
            <Poster decisions={decisions} number={state?.poster?.id} previewKey={shown && shown !== round?.my_choice ? roundKey : null} />
            {sweep > 0 && <span key={sweep} aria-hidden className="poster-sweep" />}
            <div aria-hidden className="studio-floats">
              {floats.map((f) => (
                <FloatItem key={f.uid} item={f} onDone={() => setFloats((list) => list.filter((x) => x.uid !== f.uid))} />
              ))}
            </div>
            {ready && shown && (
              <span className="studio-pick">{shown === round?.my_choice && !preview ? "Your pick" : "Preview"}</span>
            )}
          </div>
          <Progress decisions={state?.poster?.decisions ?? {}} step={round?.step} />
        </div>

        {/* Vote and talk */}
        <div className="flex flex-col gap-8 lg:col-span-5">
          {ready && round ? (
            <VotePanel key={round.id} round={round} serverNow={serverNow} onVote={vote} onPreview={setPreview} previous={state.previous} />
          ) : (
            <JoinPanel
              status={status}
              error={joinError ?? error}
              onToken={signIn}
              onError={setJoinError}
            />
          )}

          {ready && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm text-muted">Say something</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Reactions">
                {REACTIONS.map((r) => (
                  <button key={r.id} type="button" className="talk-emoji pressable" aria-label={r.label} onClick={() => react(r.id)}>
                    <span aria-hidden>{r.emoji}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Quick phrases">
                {PHRASES.map((p) => (
                  <button key={p.id} type="button" className="btn pressable talk-phrase" onClick={() => say(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {ready && state.me && <HereNow me={state.me} visitors={visitors} onShuffle={shuffleName} />}

      <Archive refreshKey={state?.poster?.id} />
    </>
  );
}

function VotePanel({
  round,
  serverNow,
  onVote,
  onPreview,
  previous,
}: {
  round: Round;
  serverNow: () => number;
  onVote: (choice: string) => void;
  onPreview: (choice: string | null) => void;
  previous: { decision: string; winner: string } | null;
}) {
  const decision = decisionFor(round.decision);
  const left = useSecondsLeft(round, serverNow);
  const closed = left <= 0;
  const total = round.tally.reduce((sum, t) => sum + t.votes, 0);
  const durationMs = new Date(round.closes_at).getTime() - new Date(round.opens_at).getTime();
  // Measured once when the round appears (this panel is keyed by round): the CSS animation then
  // runs on its own clock. Re-measuring each render would push the start back and double the speed.
  const [elapsedMs] = useState(() => Math.min(durationMs, Math.max(0, serverNow() - new Date(round.opens_at).getTime())));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-muted">
            Decision {round.step} of {DECISIONS.length}
          </p>
          <h2 className="font-display text-[clamp(2rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.03em]">
            {decision?.label ?? round.decision}
          </h2>
        </div>
        <div className="round-ring" role="timer" aria-label={`${left} seconds left`}>
          <svg aria-hidden viewBox="0 0 40 40">
            <circle className="round-ring-track" cx="20" cy="20" r="17" pathLength={100} />
            <circle
              className="round-ring-fill"
              cx="20"
              cy="20"
              r="17"
              pathLength={100}
              style={{ animationDuration: `${durationMs}ms`, animationDelay: `-${elapsedMs}ms` }}
            />
          </svg>
          <span aria-hidden className="round-ring-num">{left}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2" role="group" aria-label={`Vote on ${decision?.label ?? round.decision}`}>
        {round.options.map((id, i) => {
          const votes = round.tally.find((t) => t.option === id)?.votes ?? 0;
          const mine = round.my_choice === id;
          return (
            <button
              key={`${round.id}-${id}`}
              type="button"
              className="vote-card pressable"
              style={{ "--i": i, "--share": total ? votes / total : 0 } as React.CSSProperties}
              aria-pressed={mine}
              disabled={closed}
              onClick={() => onVote(id)}
              onPointerEnter={(e) => e.pointerType === "mouse" && onPreview(id)}
              onPointerLeave={() => onPreview(null)}
              onFocus={() => onPreview(id)}
              onBlur={() => onPreview(null)}
            >
              <span aria-hidden className="vote-bar" />
              <span className="vote-label">{optionLabel(round.decision, id)}</span>
              <span className="vote-count">
                {votes}
                <span className="sr-only"> {votes === 1 ? "vote" : "votes"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        {round.voters} {round.voters === 1 ? "vote" : "votes"} so far
        {previous && (
          <>
            {" "}· Last: {decisionFor(previous.decision)?.label} → {optionLabel(previous.decision, previous.winner)}
          </>
        )}
      </p>
    </div>
  );
}

function useSecondsLeft(round: Round, serverNow: () => number) {
  const calc = useCallback(
    () => Math.max(0, Math.ceil((new Date(round.closes_at).getTime() - serverNow()) / 1000)),
    [round.closes_at, serverNow],
  );
  const [left, setLeft] = useState(calc); // VotePanel is keyed by round, so this starts fresh each round
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  }, [calc]);
  return left;
}

function JoinPanel({
  status,
  error,
  onToken,
  onError,
}: {
  status: string;
  error: string | null;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  if (status === "offline") {
    return <p className="rounded-3xl bg-surface p-6 text-muted">The studio is offline right now. Come back soon.</p>;
  }
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-6">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{error ? "Couldn't join" : "Joining the studio…"}</h2>
      {error && <p className="text-muted">{error}</p>}
      {status === "needs-captcha" && !error && <Turnstile onToken={onToken} onError={onError} />}
      {error && (
        <button type="button" className="btn btn-primary pressable self-start" onClick={() => window.location.reload()}>
          Try again
        </button>
      )}
    </div>
  );
}

function Progress({ decisions, step }: { decisions: Decisions; step?: number }) {
  return (
    <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="The eight decisions">
      {DECISIONS.map((d) => {
        const value = decisions[d.key];
        const current = d.step === step;
        return (
          <li key={d.key} className={value || current ? "text-ink" : "text-muted"} aria-current={current ? "step" : undefined}>
            {d.label}
            {value ? `: ${optionLabel(d.key, value)}` : current ? " (voting)" : ""}
          </li>
        );
      })}
    </ol>
  );
}

function HereNow({ me, visitors, onShuffle }: { me: Profile; visitors: { key: string; profile: Profile; self: boolean }[]; onShuffle: () => void }) {
  const others = visitors.filter((v) => !v.self);
  return (
    <section aria-labelledby="here-title" className="mt-24 md:mt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="here-title" className="font-display text-[clamp(2rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.03em]">
            Here now
          </h2>
          <p className="mt-2 text-muted">
            {others.length === 0 ? "Just you for now. Share the page and design together." : `You and ${others.length} ${others.length === 1 ? "other" : "others"}.`}
          </p>
        </div>
      </div>
      <ul className="mt-6 flex flex-wrap items-center gap-2">
        <li className="flex items-center gap-2">
          <span className="visitor-tag visitor-tag-self">
            <span aria-hidden className="tag-dot" data-colour={me.colour} />
            {nameOf(me)}
            <span className="text-muted">(you)</span>
          </span>
          <button type="button" className="btn pressable" onClick={onShuffle} aria-label={`Shuffle your name, now ${nameOf(me)}, ${colourLabel(me.colour)}`}>
            <PiShuffle aria-hidden className="size-4" />
            Shuffle
          </button>
        </li>
        {others.map((v) => (
          <li key={v.key} className="visitor-tag">
            <span aria-hidden className="tag-dot" data-colour={v.profile.colour} />
            {nameOf(v.profile)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FloatItem({ item, onDone }: { item: Float; onDone: () => void }) {
  const style = { "--x": `${item.x}%`, "--r": `${item.r}deg` } as React.CSSProperties;
  if (item.kind === "reaction") {
    return (
      <span className="studio-float" style={style} onAnimationEnd={onDone}>
        {reactionFor(item.id)?.emoji}
      </span>
    );
  }
  return (
    <span className="studio-float studio-phrase" style={style} onAnimationEnd={onDone}>
      <span className="tag-dot" data-colour={item.from.colour} />
      <span className="opacity-70">{nameOf(item.from)}</span>
      {phraseFor(item.id)?.label}
    </span>
  );
}
