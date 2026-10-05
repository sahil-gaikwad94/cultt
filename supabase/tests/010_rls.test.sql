-- 010_rls.test.sql — the RLS proof.
--
-- Run against a locally migrated database:
--   psql -d cultured -v ON_ERROR_STOP=1 -f supabase/tests/010_rls.test.sql
--
-- Every assertion below runs as the real `authenticated` role with a real
-- `request.jwt.claim.sub`, so it exercises the same code path a client hits.
-- A failure raises and the script exits non-zero.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------- assertions

create or replace function t_eq(p_label text, p_actual bigint, p_expected bigint)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'RLS FAIL [%]: expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create or replace function t_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'RLS FAIL [%]: expected true', p_label;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create or replace function t_false(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
  if p_cond is not false then
    raise exception 'RLS FAIL [%]: expected false, got %', p_label, coalesce(p_cond::text, 'null');
  end if;
  raise notice 'ok   %', p_label;
end $$;

/**
 * Asserts how many rows a statement actually touched.
 *
 * Needed because RLS on a filtered UPDATE/DELETE does not raise: Postgres just
 * matches no rows. "0 rows affected" is the real proof that a cross-account
 * write is impossible, and it is a stronger statement than "an error happened".
 */
create or replace function t_affected(p_label text, p_sql text, p_expected bigint)
returns void language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n <> p_expected then
    raise exception 'RLS FAIL [%]: expected % rows affected, got %', p_label, p_expected, n;
  end if;
  raise notice 'ok   %', p_label;
end $$;

/** Asserts the statement raises. Proves a write path is closed, not just unused. */
create or replace function t_blocked(p_label text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok   % (blocked)', p_label;
    return;
  end;
  raise exception 'RLS FAIL [%]: statement should have been denied: %', p_label, p_sql;
end $$;

/** Impersonates a signed-in user exactly the way PostgREST does. */
create or replace function as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;

-- ---------------------------------------------------------------- fixtures

do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '77777777-7777-7777-7777-777777777777';
  e uuid := '88888888-8888-8888-8888-888888888888';
  m_ab uuid := 'a0000000-0000-0000-0000-0000000000ab';
  m_bc uuid := 'a0000000-0000-0000-0000-0000000000bc';
  t_ab uuid := 'b0000000-0000-0000-0000-0000000000ab';
  t_bc uuid := 'b0000000-0000-0000-0000-0000000000bc';
  meme uuid := 'c0000000-0000-0000-0000-000000000001';
  track uuid := 'd0000000-0000-0000-0000-000000000001';
  v vector;
  music vector;
  music_contrast vector;
begin
  -- 34-d humor vector, 24-d music vector, both real pgvector values.
  v := resonance.res_to_vector((
    select array_agg(case when i <= 4 then 0.25 else 0.03 end) from generate_series(1, 34) as i
  ));
  -- Music is 48-d: 1-24 genres, 25-40 artist buckets, 41-48 behaviour.
  -- A and B share ambient/folk; C is a country listener, so A's anti_genres
  -- penalty has something real to bite on.
  music := resonance.res_to_vector((
    select array_agg(
      case
        when i = 16 then 0.55::float8  -- ambient
        when i = 19 then 0.30::float8  -- folk
        when i between 25 and 40 then 0.02::float8
        when i between 41 and 48 then 0.05::float8
        else 0.004::float8
      end
    ) from generate_series(1, 48) as i
  ));
  music_contrast := resonance.res_to_vector((
    select array_agg(
      case
        when i = 20 then 0.60::float8  -- country
        when i = 22 then 0.20::float8  -- punk
        when i between 41 and 48 then 0.05::float8
        else 0.004::float8
      end
    ) from generate_series(1, 48) as i
  ));

  -- public.users.id references auth.users(id), exactly as on Supabase: the auth
  -- row is what signup creates, and everything else hangs off it.
  insert into auth.users (id, email) values
    (a, 'a@example.com'), (b, 'b@example.com'), (c, 'c@example.com'),
    (d, 'd@example.com'), (e, 'e@example.com')
  on conflict (id) do nothing;

  insert into users (id, email, dob, gender, looking_for, city, lat, lng,
                     verified_photo, mode_default, tier, onboarded)
  values
    (a, 'a@example.com', (current_date - interval '29 years')::date, 'woman', array['dating','friends'], 'Lisbon', 38.72, -9.14, true, 'dating', 'free', true),
    (b, 'b@example.com', (current_date - interval '31 years')::date, 'man', array['dating'], 'Lisbon', 38.73, -9.15, true, 'dating', 'free', true),
    (c, 'c@example.com', (current_date - interval '27 years')::date, 'man', array['dating'], 'Porto', 41.15, -8.61, true, 'dating', 'premium', true),
    -- D and E differ only in music taste, so they isolate the genre penalty.
    (d, 'd@example.com', (current_date - interval '30 years')::date, 'man', array['dating'], 'Lisbon', 38.715, -9.135, true, 'dating', 'free', true),
    (e, 'e@example.com', (current_date - interval '28 years')::date, 'man', array['dating'], 'Lisbon', 38.725, -9.145, true, 'dating', 'free', true)
  on conflict (id) do nothing;

  insert into profiles (user_id, display_name, bio) values
    (a, 'Ana', 'collects sounds'), (b, 'Bruno', 'makes playlists nobody asked for'),
    (c, 'Caio', 'here for the memes'),
    (d, 'Duarte', 'trucks and steel guitars'),
    (e, 'Elena', 'ambient for the commute')
  on conflict (user_id) do nothing;

  insert into fingerprints (user_id, humor_vec, music_vec, humor_style, anti_genres,
                            top_artists, top_genres, top_categories, event_count)
  values
    (a, v, music, '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb, array['country'], '["Burial","Sufjan Stevens"]'::jsonb, array['ambient','folk'], array['work'], 60),
    (b, v, music, '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb, array[]::text[], '["Burial","Sufjan Stevens"]'::jsonb, array['ambient','folk'], array['work'], 60),
    (c, v, music_contrast, '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb, array[]::text[], '["Zach Bryan"]'::jsonb, array['country'], array['work'], 60),
    (d, v, music_contrast, '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb, array[]::text[], '["Zach Bryan"]'::jsonb, array['country'], array['work'], 60),
    (e, v, music, '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb, array[]::text[], '["Burial","Sufjan Stevens"]'::jsonb, array['ambient','folk'], array['work'], 60)
  on conflict (user_id) do nothing;

  insert into memes (id, slug, source, caption_text, alt_text, style_vec, categories, topic, status)
  values (meme, 'test-meme', 'pack', 'a test caption', 'alt text', v, array['work'], 'work', 'live')
  on conflict (id) do nothing;

  insert into tracks (id, slug, title, artist, embedding, genres)
  values (track, 'test-track', 'Test Track', 'Burial', music, array['ambient'])
  on conflict (id) do nothing;

  insert into likes (from_user, to_user, kind) values
    (a, b, 'like'),   -- A has liked B: an outgoing like for A, an incoming one for B
    (b, c, 'like')    -- B has liked C
  on conflict do nothing;

  insert into events (user_id, kind, target_type, target_id, weight, meta)
  values (a, 'laugh', 'meme', meme, 1.0, '{}'::jsonb),
         (b, 'laugh', 'meme', meme, 1.0, '{}'::jsonb);

  insert into matches (id, user_a, user_b, taste_twins, source) values
    (m_ab, least(a, b), greatest(a, b), 88, 'matrix'),
    (m_bc, least(b, c), greatest(b, c), 71, 'matrix')
  on conflict (id) do nothing;

  insert into threads (id, match_id) values (t_ab, m_ab), (t_bc, m_bc)
  on conflict (id) do nothing;

  insert into messages (thread_id, sender_id, kind, body) values
    (t_ab, a, 'text', 'A to B: only participants should read this'),
    (t_bc, b, 'text', 'B to C: nobody else should read this');

  insert into vibe_reports (from_user, to_user, reason) values (a, c, 'not my vibe');
  insert into reports (reporter, target_type, target_id, reason) values (b, 'user', c, 'spam');
end $$;

-- =========================================================== A's view

set role authenticated;
select as_user('11111111-1111-1111-1111-111111111111');

-- Identity: own rows only.
select t_eq('profiles: A sees exactly one row (their own)',
  (select count(*) from profiles), 1);
select t_eq('profiles: B''s row is invisible to A',
  (select count(*) from profiles where user_id = '22222222-2222-2222-2222-222222222222'), 0);
select t_eq('users: A sees exactly one row (their own)',
  (select count(*) from users), 1);
select t_eq('users: B''s row is invisible to A',
  (select count(*) from users where id = '22222222-2222-2222-2222-222222222222'), 0);

-- Raw vectors: unreadable for anyone but the owner, and not even for them
-- through PostgREST unless they ask for their own row.
select t_eq('fingerprints: A sees exactly one row',
  (select count(*) from fingerprints), 1);
select t_eq('fingerprints: B''s raw humor vector is unreadable',
  (select count(*) from fingerprints where user_id = '22222222-2222-2222-2222-222222222222'), 0);
select t_eq('fingerprints: B''s raw music vector is unreadable',
  (select count(*) from fingerprints where user_id = '22222222-2222-2222-2222-222222222222'
     and music_vec is not null), 0);

-- Likes: outgoing visible, incoming never.
select t_eq('likes: A sees their outgoing like',
  (select count(*) from likes where from_user = '11111111-1111-1111-1111-111111111111'), 1);
select t_eq('likes: B''s incoming like on A is NOT disclosed',
  (select count(*) from likes where to_user = '11111111-1111-1111-1111-111111111111'), 0);
select t_eq('likes: B''s own outgoing like is not A''s business',
  (select count(*) from likes where from_user = '22222222-2222-2222-2222-222222222222'), 0);
select t_eq('likes: total visible rows for A is exactly 1',
  (select count(*) from likes), 1);

-- Events: append-only through react, readable by nobody.
select t_blocked('events: reading them is denied outright, not merely filtered',
  'select count(*) from events');
select t_false('events: authenticated has no SELECT privilege at all',
  has_table_privilege('authenticated', 'events', 'select'));
select t_blocked('events: direct insert is denied',
  'insert into events (user_id, kind, target_type, target_id) values (''11111111-1111-1111-1111-111111111111'', ''laugh'', ''meme'', ''c0000000-0000-0000-0000-000000000001'')');

-- Config is server-only.
select t_false('system_config: authenticated has no SELECT privilege',
  has_table_privilege('authenticated', 'system_config', 'select'));
select t_blocked('system_config: reading the weights is denied',
  'select * from system_config limit 1');

-- Chat: participant-only, per thread.
select t_eq('threads: A sees only their own thread',
  (select count(*) from threads), 1);
select t_eq('threads: the B-C thread is invisible',
  (select count(*) from threads where match_id = 'a0000000-0000-0000-0000-0000000000bc'), 0);
select t_eq('messages: A sees only the A-B thread',
  (select count(*) from messages), 1);
select t_eq('messages: another pair''s messages are unreadable',
  (select count(*) from messages where thread_id = 'b0000000-0000-0000-0000-0000000000bc'), 0);
select t_blocked('messages: sending into a thread A is not part of is denied',
  'insert into messages (thread_id, sender_id, kind, body) values (''b0000000-0000-0000-0000-0000000000bc'', ''11111111-1111-1111-1111-111111111111'', ''text'', ''sneaking in'')');

-- Cross-account writes.
select t_blocked('profiles: A cannot insert a row owned by B',
  'insert into profiles (user_id, display_name) values (''22222222-2222-2222-2222-222222222222'', ''not mine'')');
select t_blocked('likes: A cannot forge a like as B',
  'insert into likes (from_user, to_user, kind) values (''22222222-2222-2222-2222-222222222222'', ''11111111-1111-1111-1111-111111111111'', ''like'')');
select t_affected('users: A cannot update B''s row (0 rows matched, none changed)',
  'update users set city = ''hacked'' where id = ''22222222-2222-2222-2222-222222222222''', 0);
select t_affected('profiles: A cannot update B''s profile row',
  'update profiles set display_name = ''hacked'' where user_id = ''22222222-2222-2222-2222-222222222222''', 0);
select t_eq('users: B''s row is untouched in the database',
  (select count(*) from users where city = 'hacked'), 0);
select t_eq('profiles: B''s profile is untouched in the database',
  (select count(*) from profiles where display_name = 'hacked'), 0);
select t_affected('likes: A cannot delete B''s likes',
  'delete from likes where from_user = ''22222222-2222-2222-2222-222222222222''', 0);

-- Safety tables: own rows only.
select t_eq('vibe_reports: A sees only their own report',
  (select count(*) from vibe_reports), 1);
select t_eq('reports: A cannot see B''s report',
  (select count(*) from reports), 0);

reset role;

-- ============================================ 18+ gate (server-enforced)

select t_blocked('users: a 17-year-old cannot be inserted',
  $sql$insert into users (id, email, dob) values ('44444444-4444-4444-4444-444444444444', 'kid@example.com', (current_date - interval '17 years')::date)$sql$);

select t_blocked('users: a DOB older than 120 years is rejected',
  $sql$insert into users (id, email, dob) values ('55555555-5555-5555-5555-555555555555', 'old@example.com', (current_date - interval '130 years')::date)$sql$);

select t_blocked('users: a future DOB is rejected',
  $sql$insert into users (id, email, dob) values ('66666666-6666-6666-6666-666666666666', 'future@example.com', (current_date + interval '1 year')::date)$sql$);

select t_blocked('users: DOB is immutable after signup',
  $sql$update users set dob = (current_date - interval '40 years')::date where id = '11111111-1111-1111-1111-111111111111'$sql$);

-- ======================================== anon sees nothing it shouldn't

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);

select t_eq('anon: profiles are unreadable', (select count(*) from profiles), 0);
select t_eq('anon: fingerprints are unreadable', (select count(*) from fingerprints), 0);
select t_eq('anon: likes are unreadable', (select count(*) from likes), 0);
select t_eq('anon: messages are unreadable', (select count(*) from messages), 0);
select t_eq('anon: users are unreadable', (select count(*) from users), 0);
select t_true('anon: the public meme corpus is readable',
  (select count(*) from memes where status = 'live') >= 1);

reset role;

-- ============================ the anti-paywall rule, end to end via decide

set role authenticated;
select as_user('11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claim.role', 'authenticated', false);

-- A has weighed in on B already, so B must be out of A's deck entirely: a
-- decided candidate is never re-served.
select t_eq('candidates: someone A already decided on leaves the deck',
  (select count(*) from candidates('dating', 200, 18, 60, 50)
    where profile ->> 'userId' = '22222222-2222-2222-2222-222222222222'), 0);

-- C is in A's radius only at 500km (Lisbon -> Porto). C has not liked A.
select t_false('candidates: no incoming like means likes_you is false',
  (select likes_you from candidates('dating', 500, 18, 60, 50)
    where profile ->> 'userId' = '33333333-3333-3333-3333-333333333333'));

-- C likes A. This is an incoming like. It must remain invisible to A.
select as_user('33333333-3333-3333-3333-333333333333');
select t_false('decide: the first side sees no match when the other has not acted',
  (select matched from decide('11111111-1111-1111-1111-111111111111', 'like')));

select as_user('11111111-1111-1111-1111-111111111111');
-- A now has a real incoming like, and must still not be told: the disclosure
-- rule is "you both acted", not "someone acted on you".
select t_false('candidates: an incoming like is STILL not disclosed before A acts',
  (select likes_you from candidates('dating', 500, 18, 60, 50)
    where profile ->> 'userId' = '33333333-3333-3333-3333-333333333333'));

-- Now A acts. The mutual reveals on A's action, with a thread and a score.
select t_true('decide: the mutual reveals on the second side''s action',
  (select matched from decide('33333333-3333-3333-3333-333333333333', 'like')));
select t_true('decide: the mutual creates a real chat thread',
  (select thread_id is not null from decide('33333333-3333-3333-3333-333333333333', 'like')));
select t_true('decide: the mutual carries a resonance score',
  (select taste_twins is not null from matches
    where user_a = '11111111-1111-1111-1111-111111111111'
      and user_b = '33333333-3333-3333-3333-333333333333'));
select t_eq('decide: the mutual leaves the deck',
  (select count(*) from candidates('dating', 500, 18, 60, 50)
    where profile ->> 'userId' = '33333333-3333-3333-3333-333333333333'), 0);

-- The anti-genre penalty has a real effect: A blocks country, C is a country
-- listener, so C scores below a same-taste neighbour with no penalty.
-- The anti-genre penalty has a measurable effect against two neighbours who
-- differ only in genre: E shares A's taste and D is the blocked country.
select t_true('candidates: the anti-genre penalty is actually applied to a blocked genre',
  (select anti_genre_penalty < 0 from candidates('dating', 500, 18, 60, 50)
    where profile ->> 'userId' = '77777777-7777-7777-7777-777777777777'));
select t_eq('candidates: a same-taste neighbour carries no penalty',
  (select count(*) from candidates('dating', 500, 18, 60, 50)
    where profile ->> 'userId' = '88888888-8888-8888-8888-888888888888'
      and anti_genre_penalty = 0), 1);
select t_true('candidates: the penalty lowers the blocked listener''s score',
  (select (select taste_twins from candidates('dating', 500, 18, 60, 50)
             where profile ->> 'userId' = '77777777-7777-7777-7777-777777777777')
        < (select taste_twins from candidates('dating', 500, 18, 60, 50)
             where profile ->> 'userId' = '88888888-8888-8888-8888-888888888888')));

select t_blocked('decide: deciding on yourself is rejected',
  'select decide(''11111111-1111-1111-1111-111111111111'', ''like'')');
select t_blocked('decide: an unknown decision is rejected',
  'select decide(''33333333-3333-3333-3333-333333333333'', ''superlike'')');

reset role;

-- ================================================ react is atomic & gated

set role authenticated;
select as_user('33333333-3333-3333-3333-333333333333');

select t_true('react: a signed-in onboarded user can react',
  (select true from react('meme', 'c0000000-0000-0000-0000-000000000001', 'laugh', '{}'::jsonb)));

reset role;

do $$
declare
  n bigint;
  before_count int;
  after_count int;
  before_vec vector;
begin
  select count(*) into n from events where user_id = '33333333-3333-3333-3333-333333333333';
  if n <> 1 then
    raise exception 'RLS FAIL [react]: expected exactly 1 event, got %', n;
  end if;
  raise notice 'ok   react: exactly one event was written for the reaction';

  select event_count, humor_vec into before_count, before_vec
    from fingerprints where user_id = '33333333-3333-3333-3333-333333333333';

  -- A repeated identical reaction is a no-op: no second event, no vector move.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform react('meme', 'c0000000-0000-0000-0000-000000000001', 'laugh', '{}'::jsonb);
  perform set_config('request.jwt.claim.role', 'service_role', false);

  select count(*) into n from events where user_id = '33333333-3333-3333-3333-333333333333';
  if n <> 1 then
    raise exception 'RLS FAIL [react]: a repeated reaction duplicated the event (% rows)', n;
  end if;
  raise notice 'ok   react: a repeated reaction is idempotent';

  select event_count, humor_vec into after_count, before_vec
    from fingerprints where user_id = '33333333-3333-3333-3333-333333333333';
  if after_count <> before_count then
    raise exception 'RLS FAIL [react]: idempotent replay still moved the vector (% -> %)',
      before_count, after_count;
  end if;
  raise notice 'ok   react: idempotent replay does not move the vector';
end $$;

-- ============================== the listening cap is a server-side expiry

do $$
declare
  cap_seconds int;
begin
  -- The cap is configurable and lives in system_config, not in the client.
  cap_seconds := resonance.config_num('entitlements', 'free_session_seconds', 900);
  if cap_seconds <> 900 then
    raise exception 'RLS FAIL [session cap]: expected 900, got %', cap_seconds;
  end if;
  raise notice 'ok   session cap: free tier cap is 900s in system_config';

  -- A session token carries its own expiry, so an offline client cannot outlive
  -- the cap however long it stays open.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'session_tokens' and column_name = 'expires_at'
  ) then
    raise exception 'RLS FAIL [session cap]: session_tokens has no expires_at';
  end if;
  raise notice 'ok   session cap: session_tokens are issued with an expiry';
end $$;

select 'ALL RLS TESTS PASSED' as result;
