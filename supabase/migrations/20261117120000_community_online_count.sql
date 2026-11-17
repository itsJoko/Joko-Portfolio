-- Community: "N here" for the sidebar, on every page of the site.
--
-- Each visitor on /community calls current_state() every 2 s; that now also stamps
-- profiles.last_seen_at (at most once every 10 s, to keep writes low). online_count()
-- counts visitors seen in the last 20 s. It returns a number only, never who.
-- Anyone may call it, signed in or not, because the sidebar shows it before you join.

alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();
create index if not exists profiles_last_seen_at on public.profiles (last_seen_at);

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

  -- "Here now": refresh the visitor's last-seen time, at most every 10 s.
  update public.profiles
  set last_seen_at = now()
  where id = v_user_id and last_seen_at < now() - interval '10 seconds';

  -- Cheap check without locks; only take the lock path when a round has expired.
  select * into v_round from public.rounds where winner is null;
  if not found or v_round.closes_at <= now() then
    perform private.advance();
  end if;

  return private.build_state(v_user_id);
end;
$$;

-- How many visitors are on the Community page right now (seen in the last 20 s).
create or replace function private.online_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.profiles
  where last_seen_at > now() - interval '20 seconds';
$$;

create or replace function public.online_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select private.online_count();
$$;
comment on function public.online_count() is
  'Community: how many visitors are on the Community page right now. A number only.';

revoke all on function private.online_count(), public.online_count() from public;
grant usage on schema private to anon;
grant execute on function private.online_count(), public.online_count() to anon, authenticated;
