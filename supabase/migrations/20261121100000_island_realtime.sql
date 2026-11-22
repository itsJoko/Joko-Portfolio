-- Playground "Studio island": who may use its live channel (presence = who's on the island, where they
-- stand and whether they sit; broadcast = walks, rides and talk).
--
-- The page joins the topic 'island:main' as a *private* channel, so Realtime checks these policies when a
-- visitor connects. Like Community's channel, only signed-in visitors (anonymous sign-in behind the
-- Turnstile check) can listen or send; someone holding just the publishable key can't. The page drops any
-- message that isn't a valid walk inside the island, a known emoji or phrase, or a generated name.
--
-- Movement never touches the database: Realtime stores nothing in realtime.messages, it only uses these
-- policies to decide access.

create policy "Island visitors can listen on the island channel"
  on realtime.messages for select
  to authenticated
  using (
    (select realtime.topic()) = 'island:main'
    and realtime.messages.extension in ('broadcast', 'presence')
    and ((select auth.jwt()) ->> 'is_anonymous') is not null
  );

create policy "Island visitors can send on the island channel"
  on realtime.messages for insert
  to authenticated
  with check (
    (select realtime.topic()) = 'island:main'
    and realtime.messages.extension in ('broadcast', 'presence')
    and ((select auth.jwt()) ->> 'is_anonymous') is not null
  );
