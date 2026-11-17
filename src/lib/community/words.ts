// Typed access to src/content/community-words.json, the only source of words the
// Community page can show. The database stores ids; everything visible comes from here.
import words from "@/content/community-words.json";

export type Word = { id: string; label: string };
export type Decision = { step: number; key: DecisionKey; label: string; options: Word[] };
export type DecisionKey = "theme" | "layout" | "typeface" | "palette" | "motif" | "scale" | "texture" | "stamp";
export type Decisions = Partial<Record<DecisionKey, string>>;
export type Reaction = Word & { emoji: string };

export const DECISIONS = words.decisions as Decision[];
export const ADJECTIVES: Word[] = words.names.adjective;
export const NOUNS: Word[] = words.names.noun;
export const COLOURS: Word[] = words.names.colour;
export const REACTIONS: Reaction[] = words.talk.reactions;
export const PHRASES: Word[] = words.talk.phrases;

const byId = (list: Word[]) => new Map(list.map((w) => [w.id, w]));
const decisionMap = new Map(DECISIONS.map((d) => [d.key, d]));
const optionMaps = new Map(DECISIONS.map((d) => [d.key, byId(d.options)]));
const adjectiveMap = byId(ADJECTIVES);
const nounMap = byId(NOUNS);
const colourMap = byId(COLOURS);
const reactionMap = new Map(REACTIONS.map((r) => [r.id, r]));
const phraseMap = byId(PHRASES);

export const decisionFor = (key: string) => decisionMap.get(key as DecisionKey);
// Ids retired from the list (like the old "no-notes" stamp) can still sit on archived posters:
// show them as words rather than raw ids.
const fromId = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ");
export const optionLabel = (key: string, id: string) => optionMaps.get(key as DecisionKey)?.get(id)?.label ?? fromId(id);
export const isOption = (key: string, id: unknown) => typeof id === "string" && !!optionMaps.get(key as DecisionKey)?.has(id);
export const reactionFor = (id: unknown) => (typeof id === "string" ? reactionMap.get(id) : undefined);
export const phraseFor = (id: unknown) => (typeof id === "string" ? phraseMap.get(id) : undefined);

export type Profile = { adjective: string; noun: string; colour: string };

/** True only when every part is an id from the fixed lists (used to drop untrusted Realtime messages). */
export function isProfile(p: unknown): p is Profile {
  if (!p || typeof p !== "object") return false;
  const { adjective, noun, colour } = p as Record<string, unknown>;
  return (
    typeof adjective === "string" && adjectiveMap.has(adjective) &&
    typeof noun === "string" && nounMap.has(noun) &&
    typeof colour === "string" && colourMap.has(colour)
  );
}

export const nameOf = (p: Profile) => `${adjectiveMap.get(p.adjective)?.label ?? ""} ${nounMap.get(p.noun)?.label ?? ""}`.trim();
export const colourLabel = (id: string) => colourMap.get(id)?.label ?? id;

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** A new random name and colour, different from the current one. */
export function shuffleProfile(current?: Profile | null): Profile {
  for (let i = 0; i < 8; i++) {
    const next = { adjective: pick(ADJECTIVES).id, noun: pick(NOUNS).id, colour: pick(COLOURS).id };
    if (!current || nameOf(next) !== nameOf(current)) return next;
  }
  return { adjective: pick(ADJECTIVES).id, noun: pick(NOUNS).id, colour: pick(COLOURS).id };
}
