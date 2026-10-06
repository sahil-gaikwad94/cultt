-- 0006_rls.sql — row level security on every table
--
-- Model, from PDF §5.1: deny by default. A policy grants either
--   * auth.uid() = <owner column>  (own rows), or
--   * membership, via a SECURITY DEFINER helper that only answers a boolean.
--
-- Four things are deliberately stricter than the PDF's prose, because the PDF's
-- prose would leak:
--
--   1. `fingerprints` is own-row only. No client may read another user's raw
--      humor or music vector, matched or not. Matched users get scores from the
--      `candidates` RPC, which returns numbers, not vectors.
--   2. `profiles` is own-row only. Another user's display fields reach the client
--      through the `candidates` / `thread_list` RPCs as a projection, so a leaked
--      token cannot be used to enumerate profile rows.
--   3. `events` is insert-only for clients and readable by nobody. If events were
--      readable the vectors could be reverse-engineered from the API.
--   4. `duel_captions` exposes the partner's row only when the caller has their
--      own row AND the duel is already revealed. There is no peeking window.

-- --------------------------------------------------- server-only tables

-- Nothing a client needs. Read or written exclusively from SECURITY DEFINER
-- functions and the service role.
revoke all on system_config from anon, authenticated;
revoke all on events from anon, authenticated;
revoke all on candidate_cache from anon, authenticated;
revoke all on rate_limits from anon, authenticated;
revoke all on enrich_jobs from anon, authenticated;
revoke all on moderation_queue from anon, authenticated;
revoke all on artist_tags from anon, authenticated;
revoke all on track_tags from anon, authenticated;

grant all on system_config, events, candidate_cache, rate_limits, enrich_jobs,
  moderation_queue, artist_tags, track_tags to service_role;

-- Events are writable by the owner through `react` only; there is no client
-- insert path at all. Keep that true even if a later grant is added by accident.
drop policy if exists events_never_read on events;
create policy events_never_read on events for select to authenticated using (false);

drop policy if exists events_insert_own on events;
create policy events_insert_own on events for insert to authenticated with check (false);

-- ------------------------------------------------------------- identity

drop policy if exists users_select_own on users;
create policy users_select_own on users for select to authenticated using (id = auth.uid());

drop policy if exists users_insert_own on users;
create policy users_insert_own on users for insert to authenticated with check (id = auth.uid());

drop policy if exists users_update_own on users;
create policy users_update_own on users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Deletion is an RPC, not a row delete, so no delete policy is granted.

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select to authenticated using (user_id = auth.uid());

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles for insert to authenticated with check (user_id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Raw vectors: own row only, and the client never needs even that. The
-- Fingerprint screen reads `fingerprint_view`.
drop policy if exists fingerprints_select_own on fingerprints;
create policy fingerprints_select_own on fingerprints for select to authenticated using (user_id = auth.uid());

drop policy if exists fingerprints_update_own on fingerprints;
create policy fingerprints_update_own on fingerprints for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- content

drop policy if exists memes_select_live on memes;
create policy memes_select_live on memes for select to anon, authenticated using (status = 'live');

-- UGC stays switched off: no client insert path exists. An upload has to go
-- through `submit_ugc`, which checks the flag and queues moderation first.
drop policy if exists memes_no_client_insert on memes;
create policy memes_no_client_insert on memes for insert to authenticated with check (false);

drop policy if exists tracks_select_all on tracks;
create policy tracks_select_all on tracks for select to anon, authenticated using (true);

drop policy if exists daily_drops_select_all on daily_drops;
create policy daily_drops_select_all on daily_drops for select to authenticated using (true);

drop policy if exists reactions_select_own on reactions;
create policy reactions_select_own on reactions for select to authenticated using (user_id = auth.uid());

drop policy if exists reactions_insert_own on reactions;
create policy reactions_insert_own on reactions for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reactions_delete_own on reactions;
create policy reactions_delete_own on reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_select_live on comments;
create policy comments_select_live on comments for select to authenticated using (status = 'live');

drop policy if exists comments_insert_own on comments;
create policy comments_insert_own on comments for insert to authenticated
  with check (user_id = auth.uid() and status = 'live');

drop policy if exists comments_update_own on comments;
create policy comments_update_own on comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists comments_delete_own on comments;
create policy comments_delete_own on comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists saves_own on saves;
create policy saves_own on saves for select to authenticated using (user_id = auth.uid());

drop policy if exists saves_insert_own on saves;
create policy saves_insert_own on saves for insert to authenticated with check (user_id = auth.uid());

drop policy if exists saves_delete_own on saves;
create policy saves_delete_own on saves for delete to authenticated using (user_id = auth.uid());

drop policy if exists circles_member_read on circles;
create policy circles_member_read on circles for select to authenticated
  using (is_circle_member(id) or created_by = auth.uid());

drop policy if exists circles_insert_own on circles;
create policy circles_insert_own on circles for insert to authenticated with check (created_by = auth.uid());

drop policy if exists circle_members_read on circle_members;
create policy circle_members_read on circle_members for select to authenticated
  using (user_id = auth.uid() or is_circle_member(circle_id));

drop policy if exists circle_members_join on circle_members;
create policy circle_members_join on circle_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists circle_members_leave on circle_members;
create policy circle_members_leave on circle_members for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists circle_posts_member_read on circle_posts;
create policy circle_posts_member_read on circle_posts for select to authenticated
  using (is_circle_member(circle_id));

drop policy if exists circle_posts_insert_own on circle_posts;
create policy circle_posts_insert_own on circle_posts for insert to authenticated
  with check (user_id = auth.uid() and is_circle_member(circle_id));

-- --------------------------------------------------------------- matching

/*
 * LIKES — the anti-paywall rule, enforced in the database.
 *
 * The sender sees their own outgoing like. Nobody ever sees an incoming like
 * through this table. The recipient learns about it only when a mutual match
 * appears, which is what keeps "no paywall on seeing likes" true and stops
 * anyone scraping the like graph. `mutual_likes_view` below is the only
 * sanctioned read of an incoming like and it only returns mutuals.
 */
drop policy if exists likes_select_own_sent on likes;
create policy likes_select_own_sent on likes for select to authenticated using (from_user = auth.uid());

drop policy if exists likes_insert_own on likes;
create policy likes_insert_own on likes for insert to authenticated with check (from_user = auth.uid());

drop policy if exists likes_delete_own on likes;
create policy likes_delete_own on likes for delete to authenticated using (from_user = auth.uid());

/*
 * The only sanctioned read of an incoming like.
 *
 * This is a function rather than a view on purpose: a view's RLS behaviour
 * depends on the Postgres version's `security_invoker` support, and getting that
 * wrong would expose the whole like graph. A SECURITY DEFINER function that
 * filters to mutuals is explicit and version-independent.
 */
create or replace function mutual_likes()
returns table (id uuid, other_user uuid, kind text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.to_user, l.kind, l.created_at
  from likes l
  where l.from_user = auth.uid()
    and exists (
      select 1 from likes back
      where back.from_user = l.to_user and back.to_user = l.from_user
    )
$$;

revoke all on function mutual_likes() from anon;
grant execute on function mutual_likes() to authenticated;

drop policy if exists matches_participant_read on matches;
create policy matches_participant_read on matches for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists matches_no_client_write on matches;
create policy matches_no_client_write on matches for insert to authenticated with check (false);

drop policy if exists blocks_select_own on blocks;
create policy blocks_select_own on blocks for select to authenticated using (blocker = auth.uid());

drop policy if exists blocks_insert_own on blocks;
create policy blocks_insert_own on blocks for insert to authenticated with check (blocker = auth.uid());

drop policy if exists blocks_delete_own on blocks;
create policy blocks_delete_own on blocks for delete to authenticated using (blocker = auth.uid());

-- A vibe-report is visible only to the person who filed it. The reported user is
-- never told and never sanctioned (brief §1.3).
drop policy if exists vibe_reports_select_own on vibe_reports;
create policy vibe_reports_select_own on vibe_reports for select to authenticated using (from_user = auth.uid());

drop policy if exists vibe_reports_insert_own on vibe_reports;
create policy vibe_reports_insert_own on vibe_reports for insert to authenticated with check (from_user = auth.uid());

-- ------------------------------------------------------------------ chat

drop policy if exists threads_participant_read on threads;
create policy threads_participant_read on threads for select to authenticated
  using (is_thread_participant(id));

drop policy if exists threads_no_client_write on threads;
create policy threads_no_client_write on threads for insert to authenticated with check (false);

drop policy if exists messages_participant_read on messages;
create policy messages_participant_read on messages for select to authenticated
  using (is_thread_participant(thread_id));

-- You can only ever send as yourself, into a thread you belong to.
drop policy if exists messages_insert_self on messages;
create policy messages_insert_self on messages for insert to authenticated
  with check (sender_id = auth.uid() and is_thread_participant(thread_id));

-- Read receipts are the recipient's act. Exposed as `mark_read`, not a general
-- update, so a sender cannot forge a receipt on someone else's behalf.
drop policy if exists messages_no_client_update on messages;
create policy messages_no_client_update on messages for update to authenticated using (false);

-- -------------------------------------------------------------- sessions

drop policy if exists sessions_participant_read on sessions;
create policy sessions_participant_read on sessions for select to authenticated
  using (is_my_match(match_id));

drop policy if exists sessions_no_client_write on sessions;
create policy sessions_no_client_write on sessions for insert to authenticated with check (false);

drop policy if exists session_tokens_own on session_tokens;
create policy session_tokens_own on session_tokens for select to authenticated using (user_id = auth.uid());

drop policy if exists session_tokens_no_client_write on session_tokens;
create policy session_tokens_no_client_write on session_tokens for insert to authenticated with check (false);

drop policy if exists session_moments_participant_read on session_moments;
create policy session_moments_participant_read on session_moments for select to authenticated
  using (exists (
    select 1 from sessions s where s.id = session_id and is_my_match(s.match_id)
  ));

-- Moments require a live, unexpired token for the session. That is the
-- server-side half of the 15-minute cap.
drop policy if exists session_moments_insert_with_token on session_moments;
create policy session_moments_insert_with_token on session_moments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from session_tokens st
      join sessions s on s.id = st.session_id
      where st.session_id = session_moments.session_id
        and st.user_id = auth.uid()
        and st.revoked_at is null
        and st.expires_at > now()
        and is_my_match(s.match_id)
    )
  );

drop policy if exists soundtracks_participant_read on soundtracks;
create policy soundtracks_participant_read on soundtracks for select to authenticated
  using (is_my_match(match_id));

drop policy if exists duels_participant_read on duels;
create policy duels_participant_read on duels for select to authenticated using (is_my_match(match_id));

drop policy if exists duels_no_client_write on duels;
create policy duels_no_client_write on duels for insert to authenticated with check (false);

/*
 * NO PEEKING. The caller always sees their own caption row. They see the
 * partner's row only once (a) they have submitted their own, and (b) the duel is
 * already revealed. Without this, a client could read the partner's picks before
 * choosing and the duel would be meaningless.
 */
drop policy if exists duel_captions_own_read on duel_captions;
create policy duel_captions_own_read on duel_captions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists duel_captions_revealed_read on duel_captions;
create policy duel_captions_revealed_read on duel_captions for select to authenticated
  using (
    user_id <> auth.uid()
    and exists (
      select 1 from duels d
      join matches m on m.id = d.match_id
      where d.id = duel_captions.duel_id
        and d.status = 'revealed'
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
    and exists (
      select 1 from duel_captions mine
      where mine.duel_id = duel_captions.duel_id and mine.user_id = auth.uid()
    )
  );

drop policy if exists duel_captions_insert_own on duel_captions;
create policy duel_captions_insert_own on duel_captions for insert to authenticated
  with check (user_id = auth.uid());

-- ------------------------------------------------------------------- ops

drop policy if exists reports_select_own on reports;
create policy reports_select_own on reports for select to authenticated using (reporter = auth.uid());

-- Filing a report is allowed; the queue behind it is not.
drop policy if exists reports_insert_own on reports;
create policy reports_insert_own on reports for insert to authenticated with check (reporter = auth.uid());

drop policy if exists moderation_queue_moderator on moderation_queue;
create policy moderation_queue_moderator on moderation_queue for select to authenticated using (is_moderator());

drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens for select to authenticated using (user_id = auth.uid());

drop policy if exists push_tokens_write_own on push_tokens;
create policy push_tokens_write_own on push_tokens for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on push_tokens;
create policy push_tokens_delete_own on push_tokens for delete to authenticated using (user_id = auth.uid());

drop policy if exists notification_prefs_own on notification_prefs;
create policy notification_prefs_own on notification_prefs for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_prefs_write_own on notification_prefs;
create policy notification_prefs_write_own on notification_prefs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists notification_prefs_update_own on notification_prefs;
create policy notification_prefs_update_own on notification_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Billing rows are written by the store webhook (service role), read by the
-- owner. A client must not be able to grant itself an entitlement.
drop policy if exists subscriptions_read_own on subscriptions;
create policy subscriptions_read_own on subscriptions for select to authenticated using (user_id = auth.uid());

drop policy if exists subscriptions_no_client_write on subscriptions;
create policy subscriptions_no_client_write on subscriptions for insert to authenticated with check (false);

drop policy if exists entitlements_read_own on entitlements;
create policy entitlements_read_own on entitlements for select to authenticated using (user_id = auth.uid());

drop policy if exists entitlements_no_client_write on entitlements;
create policy entitlements_no_client_write on entitlements for insert to authenticated with check (false);

drop policy if exists consent_log_own on consent_log;
create policy consent_log_own on consent_log for select to authenticated using (user_id = auth.uid());

drop policy if exists consent_log_insert_own on consent_log;
create policy consent_log_insert_own on consent_log for insert to authenticated with check (user_id = auth.uid());

drop policy if exists data_requests_own on data_requests;
create policy data_requests_own on data_requests for select to authenticated using (user_id = auth.uid());

drop policy if exists data_requests_no_client_insert on data_requests;
create policy data_requests_no_client_insert on data_requests for insert to authenticated with check (false);

-- Legal copy is public: both stores require it be reachable before signup.
drop policy if exists legal_documents_public_read on legal_documents;
create policy legal_documents_public_read on legal_documents for select to anon, authenticated using (true);
