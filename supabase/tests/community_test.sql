-- Community game tests: simulated visitors (A, B, and C for the majority check) play through rounds.
--
-- Run the whole file in the Supabase SQL Editor (or via the MCP execute_sql tool).
-- It ALWAYS ends with an error, on purpose, so that everything it did is rolled back:
--   "ALL COMMUNITY TESTS PASSED (...)"  -> good
--   any other error message             -> the named check failed
--
-- Inside one transaction now() never moves, so instead of waiting 15 s the tests
-- push a round's timestamps into the past to make it expire.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  s jsonb;
  r jsonb;
  rid bigint;
  opts text[];
  step0 int;
  pid bigint;
  n int;
  i int;
  txt text;
  passed int := 0;
begin
  -- Two anonymous users, as Supabase Auth would create them.
  insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
  values (a, 'authenticated', 'authenticated', true, now(), now()),
         (b, 'authenticated', 'authenticated', true, now(), now());

  -- Helpers are inlined: "as X" = set the JWT claims PostgREST would set, then switch role.
  ---------------------------------------------------------------------------
  -- 1. Not signed in: the anon role can't call the RPCs at all.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform public.current_state();
    raise exception 'FAIL 1: anon could call current_state()';
  exception when insufficient_privilege then null;
  end;
  -- ...but can read the public poster tables.
  perform count(*) from public.posters;
  perform count(*) from public.rounds;
  execute 'reset role';
  passed := passed + 1;

  -- authenticated role without a user id -> not_signed_in
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    perform public.current_state();
    raise exception 'FAIL 1b: current_state() worked without a user';
  exception when others then
    if sqlerrm <> 'not_signed_in' then raise exception 'FAIL 1b: got %', sqlerrm; end if;
  end;
  execute 'reset role';
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 2. A joins: gets a generated profile, a live poster and an open round.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  s := public.current_state();
  execute 'reset role';

  if s->'me'->>'adjective' is null or s->'me'->>'noun' is null or s->'me'->>'colour' is null then
    raise exception 'FAIL 2: no generated profile: %', s->'me';
  end if;
  if s->'poster'->>'id' is null or s->'round'->>'id' is null then
    raise exception 'FAIL 2: no live poster/round: %', s;
  end if;
  if jsonb_array_length(s->'round'->'options') <> 4 then
    raise exception 'FAIL 2: round should have 4 options: %', s->'round'->'options';
  end if;
  if (s->'round'->>'closes_at')::timestamptz <= now() then
    raise exception 'FAIL 2: returned round is already expired';
  end if;
  rid := (s->'round'->>'id')::bigint;
  pid := (s->'poster'->>'id')::bigint;
  step0 := (s->'round'->>'step')::int;
  select array_agg(x) into opts from jsonb_array_elements_text(s->'round'->'options') x;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 3. Voting: one vote per user per round; re-voting replaces, never adds.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  r := public.cast_vote(rid, opts[1]);
  r := public.cast_vote(rid, opts[1]);   -- same again: no change
  r := public.cast_vote(rid, opts[2]);   -- change of mind
  execute 'reset role';
  if (r->'tally'->0->>'votes')::int <> 0 or (r->'tally'->1->>'votes')::int <> 1 then
    raise exception 'FAIL 3: double voting not handled: %', r->'tally';
  end if;
  select count(*) into n from public.votes where round_id = rid and user_id = a;
  if n <> 1 then raise exception 'FAIL 3: A has % vote rows', n; end if;
  passed := passed + 1;

  -- invalid choice and unknown round are rejected
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  begin
    perform public.cast_vote(rid, 'not-an-option');
    raise exception 'FAIL 3b: invalid choice accepted';
  exception when others then
    if sqlerrm <> 'invalid_choice' then raise exception 'FAIL 3b: got %', sqlerrm; end if;
  end;
  begin
    perform public.cast_vote(-1, opts[1]);
    raise exception 'FAIL 3c: unknown round accepted';
  exception when others then
    if sqlerrm <> 'round_not_found' then raise exception 'FAIL 3c: got %', sqlerrm; end if;
  end;
  -- B votes for option 1
  r := public.cast_vote(rid, opts[1]);
  execute 'reset role';
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 4. Privacy: B sees only B's own vote and profile; nobody can write tables directly.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.votes where round_id = rid;
  if n <> 1 then raise exception 'FAIL 4: B can see % votes (should be only their own)', n; end if;
  begin
    insert into public.votes (round_id, user_id, choice) values (rid, b, opts[3]);
    raise exception 'FAIL 4: direct insert into votes worked';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.rounds set winner = opts[1] where id = rid;
    raise exception 'FAIL 4: direct update of rounds worked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from private.words;
    raise exception 'FAIL 4: private.words readable directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.advance();
    raise exception 'FAIL 4: private.advance() callable directly';
  exception when insufficient_privilege then null;
  end;
  -- current_state shows counts and B's own choice only
  s := public.current_state();
  select count(*) into n from public.profiles;   -- A and B both have one by now
  if n <> 1 then raise exception 'FAIL 4: B can see % profiles (should be only their own)', n; end if;
  execute 'reset role';
  if s->'round'->>'my_choice' <> opts[1] or (s->'round'->>'voters')::int <> 2 then
    raise exception 'FAIL 4: state for B wrong: %', s->'round';
  end if;
  if s::text like '%' || a::text || '%' or s::text like '%' || b::text || '%' then
    raise exception 'FAIL 4: current_state leaks user ids';
  end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 5. Tie (1-1): the option that reached 1 first wins. A (opts[2]) voted 5 s
  --    before B (opts[1]), so opts[2] must win.
  ---------------------------------------------------------------------------
  update public.votes set voted_at = now() - interval '6 seconds' where round_id = rid and user_id = a;
  update public.votes set voted_at = now() - interval '1 second'  where round_id = rid and user_id = b;
  -- expire the round
  update public.rounds set opens_at = opens_at - interval '20 seconds', closes_at = closes_at - interval '20 seconds' where id = rid;

  -- 6. Voting in an expired round is refused.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  begin
    perform public.cast_vote(rid, opts[3]);
    raise exception 'FAIL 6: vote accepted in expired round';
  exception when others then
    if sqlerrm <> 'round_closed' then raise exception 'FAIL 6: got %', sqlerrm; end if;
  end;
  passed := passed + 1;

  -- 7. Lifecycle: the next current_state() closes it, applies the winner, opens step+1.
  --    Calling again (as the other user) must not close or open anything twice.
  s := public.current_state();
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  s := public.current_state();
  execute 'reset role';

  select winner into txt from public.rounds where id = rid;
  if txt is distinct from opts[2] then
    raise exception 'FAIL 5: tie went to % (expected % which reached 1 vote first)', txt, opts[2];
  end if;
  passed := passed + 1;

  if s->'previous'->>'winner' <> opts[2] or (s->'round'->>'step')::int <> step0 + 1 then
    raise exception 'FAIL 7: next round not opened correctly: %', s;
  end if;
  if (select decisions ->> (select decision from public.rounds where id = rid) from public.posters where id = pid) <> opts[2] then
    raise exception 'FAIL 7: winner not applied to poster';
  end if;
  select count(*) into n from public.rounds where poster_id = pid and winner is null;
  if n <> 1 then raise exception 'FAIL 7: % open rounds after double call', n; end if;
  select count(*) into n from public.rounds where poster_id = pid and step = step0 + 1;
  if n <> 1 then raise exception 'FAIL 7: step % opened % times', step0 + 1, n; end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 8. Reverse tie, to show it isn't luck: now B's option reaches 1 first.
  ---------------------------------------------------------------------------
  rid := (s->'round'->>'id')::bigint;
  select array_agg(x) into opts from jsonb_array_elements_text(s->'round'->'options') x;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  perform public.cast_vote(rid, opts[3]);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.cast_vote(rid, opts[1]);
  execute 'reset role';
  update public.votes set voted_at = now() - interval '2 seconds' where round_id = rid and user_id = a;
  update public.votes set voted_at = now() - interval '9 seconds' where round_id = rid and user_id = b;
  update public.rounds set opens_at = opens_at - interval '20 seconds', closes_at = closes_at - interval '20 seconds' where id = rid;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  s := public.current_state();
  execute 'reset role';
  select winner into txt from public.rounds where id = rid;
  if txt is distinct from opts[1] then
    raise exception 'FAIL 8: reverse tie went to % (expected %)', txt, opts[1];
  end if;
  passed := passed + 1;

  -- 8b. Count beats timing: C votes first for opts[1], then A and B both pick opts[2].
  rid := (s->'round'->>'id')::bigint;
  select array_agg(x) into opts from jsonb_array_elements_text(s->'round'->'options') x;
  insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
  values (c, 'authenticated', 'authenticated', true, now(), now());
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  perform public.cast_vote(rid, opts[1]);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.cast_vote(rid, opts[2]);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.cast_vote(rid, opts[2]);
  execute 'reset role';
  update public.votes set voted_at = now() - interval '10 seconds' where round_id = rid and user_id = c;
  update public.rounds set opens_at = opens_at - interval '20 seconds', closes_at = closes_at - interval '20 seconds' where id = rid;
  execute 'set local role authenticated';
  s := public.current_state();
  execute 'reset role';
  select winner into txt from public.rounds where id = rid;
  if txt is distinct from opts[2] then
    raise exception 'FAIL 8b: 2-1 vote went to % (expected %)', txt, opts[2];
  end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 9. Finish the poster: expire the remaining rounds; after step 8 the poster
  --    is archived with 3 contributors and a new live poster starts at step 1.
  ---------------------------------------------------------------------------
  for i in 1..8 loop
    exit when (s->'poster'->>'id')::bigint <> pid;
    update public.rounds set opens_at = opens_at - interval '20 seconds', closes_at = closes_at - interval '20 seconds'
    where winner is null;
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    execute 'set local role authenticated';
    s := public.current_state();
    execute 'reset role';
  end loop;
  if (select status from public.posters where id = pid) <> 'done' then
    raise exception 'FAIL 9: poster % not finished: %', pid, (select row_to_json(p) from public.posters p where id = pid);
  end if;
  if (select contributors from public.posters where id = pid) <> 3 then
    raise exception 'FAIL 9: contributors should be 3, got %', (select contributors from public.posters where id = pid);
  end if;
  if (select count(*) from jsonb_object_keys((select decisions from public.posters where id = pid))) <> 8 then
    raise exception 'FAIL 9: finished poster lacks 8 decisions: %', (select decisions from public.posters where id = pid);
  end if;
  if (s->'round'->>'step')::int <> 1 or (s->'poster'->>'id')::bigint = pid then
    raise exception 'FAIL 9: new poster not started: %', s;
  end if;
  select count(*) into n from public.posters where status = 'live';
  if n <> 1 then raise exception 'FAIL 9: % live posters', n; end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 10. A poster nobody voted on is discarded, not archived.
  ---------------------------------------------------------------------------
  pid := (s->'poster'->>'id')::bigint;
  for i in 1..8 loop
    update public.rounds set opens_at = opens_at - interval '20 seconds', closes_at = closes_at - interval '20 seconds'
    where winner is null;
    execute 'set local role authenticated';
    s := public.current_state();
    execute 'reset role';
  end loop;
  if exists (select 1 from public.posters where id = pid) then
    raise exception 'FAIL 10: empty poster % was kept', pid;
  end if;
  if (s->'round'->>'step')::int <> 1 then
    raise exception 'FAIL 10: no fresh poster after discarding: %', s;
  end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 11. Profiles: only ids from the word lists are accepted.
  ---------------------------------------------------------------------------
  execute 'set local role authenticated';
  begin
    perform public.save_profile('bold', 'kerning', 'not-a-colour');
    raise exception 'FAIL 11: invalid colour accepted';
  exception when others then
    if sqlerrm <> 'invalid_name' then raise exception 'FAIL 11: got %', sqlerrm; end if;
  end;
  begin
    perform public.save_profile('<script>', 'kerning', 'ink');
    raise exception 'FAIL 11: free text accepted';
  exception when others then
    if sqlerrm <> 'invalid_name' then raise exception 'FAIL 11: got %', sqlerrm; end if;
  end;
  r := public.save_profile('teal', 'gutter', 'night-teal');
  s := public.current_state();
  execute 'reset role';
  if s->'me' <> '{"adjective":"teal","noun":"gutter","colour":"night-teal"}'::jsonb then
    raise exception 'FAIL 11: profile not saved: %', s->'me';
  end if;
  passed := passed + 1;

  ---------------------------------------------------------------------------
  -- 12. Deleting a user removes their votes and profile (cascade). The Supabase MCP tool
  --     declines statements that delete, so this check runs only in the SQL Editor.
  ---------------------------------------------------------------------------
  delete from auth.users where id in (a, b, c);
  if exists (select 1 from public.votes where user_id in (a, b, c)) or exists (select 1 from public.profiles where id in (a, b, c)) then
    raise exception 'FAIL 12: votes/profiles left behind';
  end if;
  passed := passed + 1;

  raise exception 'ALL COMMUNITY TESTS PASSED (% checks). Rolled back on purpose.', passed;
end;
$$;
