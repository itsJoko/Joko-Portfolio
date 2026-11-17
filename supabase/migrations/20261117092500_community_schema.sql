-- Community page "Design by committee": tables, row-level security and grants.
-- Game logic lives in 20261117092600_community_functions.sql; the word lists in *_community_words.sql.
--
-- Who can do what (visitors are anonymous users: the `authenticated` role with is_anonymous = true):
--   posters, rounds : anyone may read (they are the public poster and its history).
--   profiles        : each visitor reads only their own row; written only through save_profile().
--   votes           : each visitor reads only their own votes; written only through cast_vote().
--                     Nobody can see who voted for what; tallies come out of current_state() as counts.
--   private.*       : not exposed to the API at all.

-- ---------------------------------------------------------------------------
-- Private schema: word lists and the game functions. Not in the Data API's
-- exposed schemas, so the browser can never call or read it directly.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Decision order: step 1..8 -> which list the round draws its options from.
create table private.decisions (
  step smallint primary key check (step between 1 and 8),
  key  text not null unique
);

-- Every word the page can show, by list ('theme', 'layout', ..., 'adjective', 'noun', 'colour').
-- Only ids are stored; the page turns ids into labels from src/content/community-words.json.
create table private.words (
  list     text not null,
  id       text not null check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position smallint not null,
  primary key (list, id)
);

alter table private.decisions enable row level security;
alter table private.words enable row level security;
revoke all on private.decisions, private.words from public, anon, authenticated;

-- The words are public anyway (they ship in the page), but there is no table grant,
-- so even this policy can't be used from the browser. It documents intent and keeps
-- the Security Advisor quiet. Policies here name is_anonymous on purpose: anonymous
-- visitors are the whole audience, and the advisor wants that said explicitly.
create policy "Word lists are public data"
  on private.decisions for select
  to authenticated
  using (((select auth.jwt()) ->> 'is_anonymous') is not null);

create policy "Word lists are public data"
  on private.words for select
  to authenticated
  using (((select auth.jwt()) ->> 'is_anonymous') is not null);

-- ---------------------------------------------------------------------------
-- Public tables
-- ---------------------------------------------------------------------------

-- A visitor's generated name ("Bold Kerning") and tag colour, stored as word ids.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  adjective  text not null,
  noun       text not null,
  colour     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'Community: generated nickname (adjective + noun ids) and colour id per visitor. Never free text.';

-- One poster at a time is live; finished ones are the archive.
create table public.posters (
  id           bigint generated always as identity primary key,
  status       text not null default 'live' check (status in ('live', 'done')),
  decisions    jsonb not null default '{}'::jsonb check (jsonb_typeof(decisions) = 'object'),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  contributors integer not null default 0 check (contributors >= 0),
  check ((status = 'done') = (finished_at is not null))
);
comment on table public.posters is
  'Community: one shared poster. decisions maps decision key -> winning option id.';

-- At most one live poster, enforced by the database.
create unique index posters_one_live on public.posters (status) where status = 'live';
-- Archive: finished posters, newest first.
create index posters_archive on public.posters (finished_at desc) where status = 'done';

-- One 15-second vote on one decision of a poster.
create table public.rounds (
  id        bigint generated always as identity primary key,
  poster_id bigint not null references public.posters (id) on delete cascade,
  step      smallint not null check (step between 1 and 8),
  decision  text not null,
  options   text[] not null check (cardinality(options) = 3),
  opens_at  timestamptz not null default now(),
  closes_at timestamptz not null,
  winner    text,
  check (closes_at = opens_at + interval '15 seconds'),
  check (winner is null or winner = any (options)),
  unique (poster_id, step)
);
comment on table public.rounds is
  'Community: a 15 s vote. winner is null while the round is open.';

-- At most one open round across the whole game.
create unique index rounds_one_open on public.rounds ((winner is null)) where winner is null;

-- One vote per visitor per round (they may change it until the round closes).
create table public.votes (
  round_id bigint not null references public.rounds (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  choice   text not null,
  voted_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
comment on table public.votes is
  'Community: private ballots. Readable only by their owner; counts come from current_state().';

create index votes_user_id on public.votes (user_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posters  enable row level security;
alter table public.rounds   enable row level security;
alter table public.votes    enable row level security;

create policy "Anyone can read posters"
  on public.posters for select
  to anon, authenticated
  using (true);

create policy "Anyone can read rounds"
  on public.rounds for select
  to anon, authenticated
  using (true);

-- "is_anonymous is not null" = any Supabase Auth session, anonymous or not. It is
-- there to state that anonymous visitors are meant to pass (Security Advisor lint 0012).
create policy "Visitors read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id and ((select auth.jwt()) ->> 'is_anonymous') is not null);

create policy "Visitors read their own votes"
  on public.votes for select
  to authenticated
  using ((select auth.uid()) = user_id and ((select auth.jwt()) ->> 'is_anonymous') is not null);

-- No insert/update/delete policies: all writes go through the functions in
-- 20261117092600_community_functions.sql, which run as the table owner.

-- ---------------------------------------------------------------------------
-- Grants. "Automatically expose new tables" is off, and the project's default
-- privileges still hand anon/authenticated a few table rights (truncate,
-- references, trigger), so start from nothing and add back only reads.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.posters, public.rounds, public.votes
  from public, anon, authenticated, service_role;

grant select on public.posters, public.rounds to anon, authenticated;
grant select on public.profiles, public.votes to authenticated;

-- service_role (server-side admin scripts with the secret key, never the browser).
grant select, insert, update, delete on public.profiles, public.posters, public.rounds, public.votes
  to service_role;

-- ---------------------------------------------------------------------------
-- Housekeeping: "Enable automatic RLS" installs public.rls_auto_enable(), an event
-- trigger function that Postgres lets anyone EXECUTE by default, so the API listed
-- it as /rest/v1/rpc/rls_auto_enable (Security Advisor lints 0028/0029). The event
-- trigger keeps working without these grants.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
