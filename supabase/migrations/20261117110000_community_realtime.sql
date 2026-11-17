-- Community page: who may use the live channel (presence = "who's here", broadcast =
-- emoji reactions, quick phrases and "someone voted" pings).
--
-- The page joins the topic 'community:studio' as a *private* channel, so Realtime checks
-- these policies when a visitor connects. Only signed-in visitors (anonymous sign-in, which
-- needs the Turnstile check) can listen or send; someone holding just the publishable key
-- can't. The page still drops any message that isn't a known emoji, phrase or generated name.
--
-- Realtime stores no messages in realtime.messages; it only uses these policies to decide access.

create policy "Community visitors can listen on the studio channel"
  on realtime.messages for select
  to authenticated
  using (
    (select realtime.topic()) = 'community:studio'
    and realtime.messages.extension in ('broadcast', 'presence')
    and ((select auth.jwt()) ->> 'is_anonymous') is not null
  );

create policy "Community visitors can send on the studio channel"
  on realtime.messages for insert
  to authenticated
  with check (
    (select realtime.topic()) = 'community:studio'
    and realtime.messages.extension in ('broadcast', 'presence')
    and ((select auth.jwt()) ->> 'is_anonymous') is not null
  );
