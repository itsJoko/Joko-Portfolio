-- Community page "Design by committee": the rules of the game.
--
-- Postgres is the referee. Nothing runs on a timer: every visitor's page calls
-- current_state() every couple of seconds, and whichever call first sees that the
-- open round has expired closes it, applies the winner and opens the next round.
-- Row locks make that safe when many visitors call at the same moment.
--
-- Layout:
--   private.*  the logic. Not exposed to the Data API. The three entry points run as
--              the table owner (security definer) so they can write past RLS, and each
--              checks auth.uid() itself.
--   public.*   thin wrappers the browser calls via supabase.rpc(...). They run as the
--              caller (security invoker), check auth.uid() and hand over to private.*.

-- ---------------------------------------------------------------------------
-- Helpers (no grants: only callable from the entry points below)
-- ---------------------------------------------------------------------------

-- n random ids from one word list.
create or replace function private.pick(list_name text, n integer)
returns text[]
language sql
volatile
set search_path = ''
as $$
  select coalesce(array_agg(s.id), '{}')
  from (
    select w.id from private.words w
    where w.list = list_name
    order by random()
    limit n
  ) s;
$$;

-- Opens the round for one step of a poster: three options drawn from that step's list.
create or replace function private.open_round(p_poster_id bigint, p_step smallint)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_key text;
begin
  select d.key into v_key from private.decisions d where d.step = p_step;
  if v_key is null then
    raise exception 'No decision configured for step %', p_step;
  end if;

  insert into public.rounds (poster_id, step, decision, options, opens_at, closes_at)
  values (p_poster_id, p_step, v_key, private.pick(v_key, 3), now(), now() + interval '15 seconds');
end;
$$;

-- Live tally of a round as [{option, votes}] in the order the options are shown.
create or replace function private.tally(p_round_id bigint, p_options text[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('option', o.opt, 'votes', coalesce(c.n, 0)) order by o.ord), '[]'::jsonb)
  from unnest(p_options) with ordinality as o(opt, ord)
  left join (
    select v.choice, count(*) as n
    from public.votes v
    where v.round_id = p_round_id
    group by v.choice
  ) c on c.choice = o.opt;
$$;

-- Winner of a round: most votes; a tie goes to the option that reached that count
-- first (the one whose latest vote is oldest). No votes at all: a random option.
create or replace function private.pick_winner(p_round_id bigint, p_options text[])
returns text
language sql
volatile
set search_path = ''
as $$
  select t.opt
  from (
    select o.opt, count(v.user_id) as n, max(v.voted_at) as reached
    from unnest(p_options) as o(opt)
    left join public.votes v on v.round_id = p_round_id and v.choice = o.opt
    group by o.opt
  ) t
  order by t.n desc, t.reached asc nulls last, random()
  limit 1;
$$;

-- Moves the game forward if the open round has expired. Idempotent: calling it
-- twice, or from many sessions at once, closes each round exactly once.
create or replace function private.advance()
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_poster public.posters;
  v_round  public.rounds;
  v_winner text;
  v_count  integer;
  v_next   smallint;
begin
  -- 1. Lock the live poster (create it if there is none). Everyone who gets here
  --    queues on this one row, so only one session advances at a time.
  loop
    select * into v_poster from public.posters where status = 'live' for update;
    exit when found;
    insert into public.posters (status) values ('live')
    on conflict (status) where status = 'live' do nothing;
  end loop;

  -- 2. Re-read its open round now that we hold the lock: someone ahead of us in
  --    the queue may already have closed it.
  select * into v_round
  from public.rounds
  where poster_id = v_poster.id and winner is null
  for update;

  if found and v_round.closes_at > now() then
    return;  -- still open, nothing to do
  end if;

  if not found then
    -- A fresh poster with no round yet: open its first missing step.
    select coalesce(max(r.step), 0) + 1 into v_next from public.rounds r where r.poster_id = v_poster.id;
    if v_next <= 8 then
      perform private.open_round(v_poster.id, v_next);
    end if;
    return;
  end if;

  -- 3. Close the expired round and apply the winner to the poster.
  v_winner := private.pick_winner(v_round.id, v_round.options);
  update public.rounds set winner = v_winner where id = v_round.id;

  select count(distinct v.user_id) into v_count
  from public.votes v
  join public.rounds r on r.id = v.round_id
  where r.poster_id = v_poster.id;

  update public.posters
  set decisions = decisions || jsonb_build_object(v_round.decision, v_winner),
      contributors = v_count
  where id = v_poster.id;

  -- 4. Open the next decision, or finish the poster and start a new one.
  if v_round.step < 8 then
    perform private.open_round(v_poster.id, (v_round.step + 1)::smallint);
    return;
  end if;

  if v_count = 0 then
    -- Nobody voted on any of it (an idle open tab): don't archive it.
    delete from public.posters where id = v_poster.id;
  else
    update public.posters set status = 'done', finished_at = now() where id = v_poster.id;
  end if;

  insert into public.posters default values returning * into v_poster;
  perform private.open_round(v_poster.id, 1::smallint);
end;
$$;

-- Gives a visitor a random name and colour the first time they show up.
create or replace function private.ensure_profile(p_user_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;
  insert into public.profiles (id, adjective, noun, colour)
  values (
    p_user_id,
    (private.pick('adjective', 1))[1],
    (private.pick('noun', 1))[1],
    (private.pick('colour', 1))[1]
  )
  on conflict (id) do nothing;
end;
$$;

-- Everything the page needs in one object. Contains counts only, never who voted for what.
create or replace function private.build_state(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'now', now(),
    'me', (
      select jsonb_build_object('adjective', pr.adjective, 'noun', pr.noun, 'colour', pr.colour)
      from public.profiles pr where pr.id = p_user_id
    ),
    'poster', (
      select jsonb_build_object(
        'id', p.id,
        'decisions', p.decisions,
        'started_at', p.started_at,
        'contributors', p.contributors
      )
      from public.posters p where p.status = 'live'
    ),
    'round', (
      select jsonb_build_object(
        'id', r.id,
        'step', r.step,
        'decision', r.decision,
        'options', to_jsonb(r.options),
        'opens_at', r.opens_at,
        'closes_at', r.closes_at,
        'tally', private.tally(r.id, r.options),
        'voters', (select count(*) from public.votes v where v.round_id = r.id),
        'my_choice', (select v.choice from public.votes v where v.round_id = r.id and v.user_id = p_user_id)
      )
      from public.rounds r where r.winner is null
    ),
    'previous', (
      select jsonb_build_object('poster_id', r.poster_id, 'step', r.step, 'decision', r.decision, 'winner', r.winner)
      from public.rounds r
      where r.winner is not null
      order by r.id desc
      limit 1
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Entry points (security definer: write past RLS, so each checks the caller)
-- ---------------------------------------------------------------------------

create or replace function private.current_state()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_round   public.rounds;
begin
  if v_user_id is null then
    raise exception 'not_signed_in' using errcode = '28000', hint = 'Sign in (anonymously) before calling current_state().';
  end if;

  perform private.ensure_profile(v_user_id);

  -- Cheap check without locks; only take the lock path when a round has expired.
  select * into v_round from public.rounds where winner is null;
  if not found or v_round.closes_at <= now() then
    perform private.advance();
  end if;

  return private.build_state(v_user_id);
end;
$$;

create or replace function private.cast_vote(p_round_id bigint, p_choice text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_round   public.rounds;
begin
  if v_user_id is null then
    raise exception 'not_signed_in' using errcode = '28000', hint = 'Sign in (anonymously) before voting.';
  end if;

  -- Share lock: many votes at once are fine, but a vote can't slip in while
  -- advance() is closing this round (it holds an update lock).
  select * into v_round from public.rounds where id = p_round_id for share;
  if not found then
    raise exception 'round_not_found' using errcode = 'P0002';
  end if;
  if v_round.winner is not null or now() >= v_round.closes_at or now() < v_round.opens_at then
    raise exception 'round_closed' using hint = 'This round is over; fetch current_state() for the next one.';
  end if;
  if p_choice is null or not (p_choice = any (v_round.options)) then
    raise exception 'invalid_choice' using errcode = '22023', hint = 'Choose one of the round''s three options.';
  end if;

  -- One vote per visitor per round. Changing your mind replaces the vote; voting
  -- for the same option again changes nothing (keeps your place in a tie).
  insert into public.votes as v (round_id, user_id, choice)
  values (v_round.id, v_user_id, p_choice)
  on conflict (round_id, user_id) do update
    set choice = excluded.choice, voted_at = now()
    where v.choice is distinct from excluded.choice;

  return jsonb_build_object(
    'round_id', v_round.id,
    'choice', p_choice,
    'tally', private.tally(v_round.id, v_round.options)
  );
end;
$$;

create or replace function private.save_profile(p_adjective text, p_noun text, p_colour text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not_signed_in' using errcode = '28000', hint = 'Sign in (anonymously) first.';
  end if;
  if not exists (select 1 from private.words where list = 'adjective' and id = p_adjective)
     or not exists (select 1 from private.words where list = 'noun' and id = p_noun)
     or not exists (select 1 from private.words where list = 'colour' and id = p_colour) then
    raise exception 'invalid_name' using errcode = '22023', hint = 'Names and colours come from the fixed word lists.';
  end if;

  insert into public.profiles (id, adjective, noun, colour)
  values (v_user_id, p_adjective, p_noun, p_colour)
  on conflict (id) do update
    set adjective = excluded.adjective, noun = excluded.noun, colour = excluded.colour, updated_at = now();

  return jsonb_build_object('adjective', p_adjective, 'noun', p_noun, 'colour', p_colour);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers (what the browser calls: supabase.rpc('current_state'), ...)
-- ---------------------------------------------------------------------------

create or replace function public.current_state()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return private.current_state();
end;
$$;
comment on function public.current_state() is
  'Community: closes an expired round if needed, then returns the live poster, open round, tally and your profile.';

create or replace function public.cast_vote(round_id bigint, choice text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return private.cast_vote(round_id, choice);
end;
$$;
comment on function public.cast_vote(bigint, text) is
  'Community: vote (or change your vote) in the open round. Returns the new tally.';

create or replace function public.save_profile(adjective text, noun text, colour text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return private.save_profile(adjective, noun, colour);
end;
$$;
comment on function public.save_profile(text, text, text) is
  'Community: set your generated name and colour (ids from the fixed word lists).';

-- ---------------------------------------------------------------------------
-- Grants. New functions are executable by PUBLIC by default; take that away
-- everywhere and give signed-in visitors exactly the three entry points.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.current_state(), public.cast_vote(bigint, text), public.save_profile(text, text, text)
  from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.current_state(), private.cast_vote(bigint, text), private.save_profile(text, text, text)
  to authenticated;
grant execute on function public.current_state(), public.cast_vote(bigint, text), public.save_profile(text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: start the first poster and its first round.
-- ---------------------------------------------------------------------------
select private.advance();
