-- Community: four options per round (was three), and a capped archive.
--
-- 1. Rounds now draw 4 options. Old rounds keep their 3, so the check allows 3 or 4.
-- 2. The archive keeps the newest 48 finished posters; older ones (with their rounds and
--    votes) are removed when a new poster is archived. Keeps the free database small.

alter table public.rounds drop constraint rounds_options_check;
alter table public.rounds add constraint rounds_options_check check (cardinality(options) between 3 and 4);

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
  values (p_poster_id, p_step, v_key, private.pick(v_key, 4), now(), now() + interval '15 seconds');
end;
$$;

-- Keep the newest 48 finished posters.
create or replace function private.prune_archive()
returns void
language sql
volatile
set search_path = ''
as $$
  delete from public.posters
  where status = 'done'
    and id not in (
      select p.id from public.posters p
      where p.status = 'done'
      order by p.finished_at desc
      limit 48
    );
$$;

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

  -- 2. Re-read its open round now that we hold the lock.
  select * into v_round
  from public.rounds
  where poster_id = v_poster.id and winner is null
  for update;

  if found and v_round.closes_at > now() then
    return;
  end if;

  if not found then
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
    delete from public.posters where id = v_poster.id;
  else
    update public.posters set status = 'done', finished_at = now() where id = v_poster.id;
    perform private.prune_archive();
  end if;

  insert into public.posters default values returning * into v_poster;
  perform private.open_round(v_poster.id, 1::smallint);
end;
$$;

revoke all on function private.prune_archive() from public, anon, authenticated;
