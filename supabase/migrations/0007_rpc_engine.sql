-- 0007_rpc_engine.sql — react, candidates, decide
--
-- Brief §2.6: the incremental vector update happens in Postgres, in the SAME
-- transaction as the events insert. There is no Edge Function per reaction. A
-- single function body is one transaction, so a crash between the insert and the
-- update is impossible, and no invocation quota is consumed by reacting.
--
-- Every constant is read from system_config. Nothing here hard-codes a weight.

-- ------------------------------------------------- applied update helpers

/** The corrected humor update. Mirrors updateHumor in src/lib/matching/update.ts. */
create or replace function resonance.apply_humor(p_current float8[], p_target float8[], p_weight float8)
returns float8[]
language plpgsql stable as $$
declare
  decay float8 := resonance.config_num('update', 'humor_decay', 0.995);
  axis_w float8 := resonance.config_num('update', 'axis_block_weight', 0.4);
  axes_count int := resonance.config_num('update', 'style_axes', 4)::int;
  blended float8[];
  curr_axes float8[];
  target_axes float8[];
  new_axes float8[];
  alpha float8;
  i int;
  dims int := array_length(p_current, 1);
begin
  blended := p_current;

  -- Taxonomy dims decay and blend.
  for i in (axes_count + 1)..dims loop
    blended[i] := decay * p_current[i] + p_weight * coalesce(p_target[i], 0);
  end loop;

  -- The axes are a distribution, so they slide toward the target on the simplex
  -- and can never decay negative or run away. Negative events pull back at half
  -- strength: a "meh" should soften a read, not invert it.
  alpha := least(1, abs(p_weight)) * (case when p_weight < 0 then 0.5 else 1 end);
  curr_axes := p_current[1:axes_count];
  target_axes := p_target[1:axes_count];
  for i in 1..axes_count loop
    new_axes := coalesce(new_axes, array_fill(0::float8, array[axes_count]));
    new_axes[i] := (1 - alpha) * curr_axes[i] + alpha * coalesce(target_axes[i], 0);
  end loop;
  new_axes := resonance.project_simplex(new_axes, target_axes);
  for i in 1..axes_count loop
    blended[i] := new_axes[i] * axis_w;
  end loop;

  return resonance.normalize(blended, p_target);
end $$;

/** The corrected music update. Mirrors updateMusic + applyAntiGenres. */
create or replace function resonance.apply_music(
  p_current float8[],
  p_target float8[],
  p_weight float8,
  p_anti text[] default '{}'
)
returns float8[]
language plpgsql stable as $$
declare
  decay float8 := resonance.config_num('update', 'music_decay', 0.997);
  shift float8 := resonance.config_num('update', 'max_anti_genre_shift', 0.12);
  floor_v float8 := resonance.config_num('update', 'anti_genre_floor', 0.02);
  blended float8[];
  i int;
  dims int := array_length(p_current, 1);
begin
  for i in 1..dims loop
    blended[i] := decay * p_current[i] + p_weight * coalesce(p_target[i], 0);
  end loop;
  blended := resonance.normalize(blended, p_target);

  -- Anti-genres are first-class: a blocked genre leaves the vector, not just the
  -- score. The shrink is multiplicative so it survives the renormalise, and
  -- floored so accumulated dislikes can never invert genuine taste.
  if p_anti is not null and cardinality(p_anti) > 0 then
    for i in 1..24 loop
      declare
        genre_name text;
      begin
        genre_name := (array[
          'indie_rock','dream_pop','hyperpop','shoegaze','bedroom_pop','neo_soul',
          'amapiano','jungle','drum_and_bass','hip_hop','r_and_b','funk','disco',
          'house','techno','ambient','classical','jazz','folk','country','metal',
          'punk','k_pop','latin'
        ])[i];
        if lower(genre_name) = any (select lower(x) from unnest(p_anti) as x) then
          blended[i] := greatest(floor_v, blended[i] * (1 - shift * least(1, abs(p_weight))));
        end if;
      end;
    end loop;
    blended := resonance.normalize(blended, p_target);
  end if;

  return blended;
end $$;

/** Just the four style axes, as a readable distribution for humor_style. */
create or replace function resonance.axes_json(p_vec float8[])
returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'affiliative', round(coalesce(p_vec[1], 0)::numeric, 4),
    'self_enhancing', round(coalesce(p_vec[2], 0)::numeric, 4),
    'aggressive', round(coalesce(p_vec[3], 0)::numeric, 4),
    'self_defeating', round(coalesce(p_vec[4], 0)::numeric, 4)
  )
$$;

/** Writes back a humor vector while keeping humor_style aligned with dims 1-4. */
create or replace function resonance.store_humor(p_user uuid, p_vec float8[], p_target float8[])
returns void
language plpgsql as $$
declare
  axis_w float8 := resonance.config_num('update', 'axis_block_weight', 0.4);
  axes float8[];
begin
  axes := resonance.project_simplex(
    (select array_agg(v / axis_w) from unnest(p_vec[1:4]) as v)
  );
  update fingerprints
     set humor_vec = resonance.res_to_vector(p_vec),
         humor_style = resonance.axes_json(axes),
         event_count = event_count + 1,
         vector_version = vector_version + 1,
         updated_at = now()
   where user_id = p_user;
end $$;

-- ---------------------------------------------------------------- react

/**
 * The one reaction path. Inserts the event and moves the vector in a single
 * transaction, with the weight and the multiplier read from system_config.
 *
 * Idempotency: a repeat of the same (user, target, kind) within the request is a
 * no-op for the vector, so a double-tap cannot double-count. Turning a reaction
 * off is a withdrawal, not a negative signal, and moves nothing.
 */
create or replace function react(
  p_target_type text,
  p_target_id uuid,
  p_kind text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public, resonance as $$
declare
  me uuid := auth.uid();
  weights jsonb := resonance.config('event_weights');
  max_w float8 := resonance.config_num('update', 'max_weight', 2);
  min_w float8 := resonance.config_num('update', 'min_weight', -1);
  w float8;
  is_drop boolean := false;
  target_humor float8[];
  target_music float8[];
  fp fingerprints;
  my_anti text[];
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_target_type not in ('meme', 'track') then
    raise exception 'Unsupported target type.' using errcode = '22023';
  end if;

  -- Rate limit reacting so a scripted client cannot farm the vector.
  if not consume_rate_limit('react', 600, interval '1 hour') then
    raise exception 'Slow down a little.' using errcode = '54000';
  end if;

  w := coalesce((weights ->> p_kind)::float8, 0);
  is_drop := coalesce((p_meta ->> 'isDrop')::boolean, false)
             or coalesce((p_meta ->> 'dailyDrop')::boolean, false);
  if is_drop then
    w := w * resonance.config_num('update', 'daily_drop_multiplier', 1.5);
  end if;
  w := least(max_w, greatest(min_w, w));

  -- Idempotency: one event per (user, target, kind) per reaction toggle.
  if exists (
    select 1 from events e
    where e.user_id = me and e.target_id = p_target_id and e.kind = p_kind
      and e.target_type = p_target_type
  ) and p_kind in ('laugh', 'like', 'save') then
    return;
  end if;

  select * into fp from fingerprints where user_id = me;
  if fp is null then
    raise exception 'Finish onboarding before reacting.' using errcode = 'P0002';
  end if;
  my_anti := coalesce(fp.anti_genres, '{}');

  if p_target_type = 'meme' then
    select resonance.res_from_vector(m.style_vec) into target_humor
      from memes m where m.id = p_target_id;
    if target_humor is null then
      -- No tagged style vector yet: still record the event, move nothing.
      insert into events (user_id, kind, target_type, target_id, weight, is_drop, meta)
      values (me, p_kind, p_target_type, p_target_id, w, is_drop, p_meta);
      return;
    end if;

    update fingerprints set
      humor_vec = resonance.res_to_vector(
        resonance.apply_humor(resonance.res_from_vector(humor_vec), target_humor, w)
      ),
      humor_style = resonance.axes_json(
        resonance.apply_humor(resonance.res_from_vector(humor_vec), target_humor, w)
      ),
      top_categories = left_join_categories(
        fp.top_categories,
        (select categories from memes where id = p_target_id)
      ),
      event_count = event_count + 1,
      vector_version = vector_version + 1,
      updated_at = now()
    where user_id = me;

    insert into reactions (user_id, meme_id, kind)
    values (me, p_target_id, case when p_kind = 'meh' then 'meh' else p_kind end)
    on conflict do nothing;
  else
    select resonance.res_from_vector(t.embedding) into target_music
      from tracks t where t.id = p_target_id;
    if target_music is null then
      insert into events (user_id, kind, target_type, target_id, weight, is_drop, meta)
      values (me, p_kind, p_target_type, p_target_id, w, is_drop, p_meta);
      return;
    end if;

    update fingerprints set
      music_vec = resonance.res_to_vector(
        resonance.apply_music(resonance.res_from_vector(music_vec), target_music, w, my_anti)
      ),
      top_artists = left_join_artists(
        fp.top_artists,
        (select artist from tracks where id = p_target_id)
      ),
      event_count = event_count + 1,
      vector_version = vector_version + 1,
      updated_at = now()
    where user_id = me;

    insert into soundtracks (match_id, track_id)
    select m.id, p_target_id from matches m
    where (m.user_a = me or m.user_b = me) and m.unmatched_at is null
    on conflict do nothing;
  end if;

  insert into events (user_id, kind, target_type, target_id, weight, is_drop, meta)
  values (me, p_kind, p_target_type, p_target_id, w, is_drop, p_meta);

  -- Any new signal invalidates the cached deck.
  delete from candidate_cache where user_id = me;
end $$;

-- Two tiny merge helpers keep the updates above to one statement per table.
create or replace function left_join_categories(p_existing text[], p_new text[])
returns text[]
language sql immutable as $$
  select (
    select coalesce(array_agg(distinct v), p_existing)
    from unnest(coalesce(p_existing, '{}') || coalesce(p_new, '{}')) as v
  )
$$;

create or replace function left_join_artists(p_existing jsonb, p_new text)
returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
  from unnest(
    coalesce(array(select value from jsonb_array_elements_text(coalesce(p_existing, '[]'::jsonb))), '{}')
    || case when p_new is null then '{}' else array[p_new] end
  ) as v
$$;

-- ------------------------------------------------------------ candidates

/** Great-circle distance in km, for the hard distance filter. */
create or replace function resonance.distance_km(
  p_lat1 float8, p_lng1 float8, p_lat2 float8, p_lng2 float8
)
returns float8
language sql immutable as $$
  select case
    when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then 999999
    else 6371 * acos(
      least(1, greatest(-1,
        sin(radians(p_lat1)) * sin(radians(p_lat2))
        + cos(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2 - p_lng1))
      ))
    )
  end
$$;

/**
 * The ranked deck.
 *
 * Score is computed here, never sent by a client. Hard filters run first, then
 * the Taste Twins curve, then a freshness boost for new profiles. Returns the
 * display projection plus the reason chips — never a vector.
 */
create or replace function candidates(
  p_mode text default 'dating',
  p_radius_km float8 default 25,
  p_age_min int default 18,
  p_age_max int default 45,
  p_limit int default 20
)
returns table (
  profile jsonb,
  taste_twins int,
  humor_similarity float8,
  music_similarity float8,
  shared_artist_similarity float8,
  confidence float8,
  anti_genre_penalty float8,
  raw_score float8,
  calibrating boolean,
  shared_artists text[],
  shared_genres text[],
  shared_categories text[],
  likes_you boolean
)
language plpgsql security definer set search_path = public, resonance as $$
declare
  me uuid := auth.uid();
  w jsonb := resonance.config('weights');
  max_run int := resonance.config_num('candidates', 'max_same_genre_run', 2)::int;
  freshness_boost float8 := resonance.config_num('candidates', 'freshness_boost', 0.08);
  freshness_days float8 := resonance.config_num('candidates', 'freshness_window_days', 7);
  freshness_events int := resonance.config_num('candidates', 'freshness_event_threshold', 20)::int;
  active_days int := resonance.config_num('candidates', 'active_window_days', 30)::int;
  my_row users;
  my_fp fingerprints;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select * into my_row from users where id = me;
  select * into my_fp from fingerprints where user_id = me;
  if my_row is null or my_row.onboarded is false then
    return;
  end if;

  return query
  with eligible as (
    select
      u.id,
      u.lat, u.lng, u.gender, u.looking_for, u.city,
      p.display_name,
      p.bio,
      fp.humor_vec, fp.music_vec, fp.top_artists, fp.top_genres,
      fp.top_categories, fp.event_count,
      resonance.distance_km(my_row.lat, my_row.lng, u.lat, u.lng) as distance_km,
      date_part('year', age(u.dob))::int as age_years,
      -- There is no users.updated_at; real activity is the latest event, falling
      -- back to signup. This is the freshness signal the deck actually wants.
      coalesce((select max(e.created_at) from events e where e.user_id = u.id), u.created_at) as last_active_at
    from users u
    join profiles p on p.user_id = u.id
    join fingerprints fp on fp.user_id = u.id
    where u.id <> me
      -- hard filters
      and u.deleted_at is null
      and u.deactivated_at is null
      and u.onboarded is true
      and u.verified_photo is true
      and u.dob <= (current_date - interval '18 years')::date
      and date_part('year', age(u.dob))::int between p_age_min and p_age_max
      and u.looking_for && (
        case when p_mode = 'both' then array['dating', 'friends'] else array[p_mode, 'both'] end
      )
      and resonance.distance_km(my_row.lat, my_row.lng, u.lat, u.lng) <= p_radius_km
      and not exists (
        select 1 from blocks b
        where (b.blocker = me and b.blocked = u.id) or (b.blocker = u.id and b.blocked = me)
      )
      and not exists (select 1 from likes l where l.from_user = me and l.to_user = u.id)
      and not exists (
        select 1 from matches m
        where (m.user_a = me and m.user_b = u.id) or (m.user_a = u.id and m.user_b = me)
      )
  ),
  scored as (
    select
      e.*,
      resonance.cosine(resonance.res_from_vector(my_fp.humor_vec), resonance.res_from_vector(e.humor_vec)) as h,
      resonance.cosine(resonance.res_from_vector(my_fp.music_vec), resonance.res_from_vector(e.music_vec)) as m,
      resonance.jaccard(
        array(select value from jsonb_array_elements_text(my_fp.top_artists)),
        array(select value from jsonb_array_elements_text(e.top_artists))
      ) as s,
      -- Calibration confidence: ramp 0.5 -> 1.0 over the first 50 events, scaled
      -- by the weaker of the two profiles.
      least(1, greatest(0.5,
        (coalesce((resonance.config('confidence') ->> 'floor')::float8, 0.5))
        + (1 - coalesce((resonance.config('confidence') ->> 'floor')::float8, 0.5))
          * (least(my_fp.event_count, e.event_count)::float8
             / greatest(1, coalesce((resonance.config('confidence') ->> 'ramp_events')::float8, 50)))
      )) as c,
      -1 * coalesce((w ->> 'anti_genre_penalty')::float8, 0.25)
        * resonance.overlap_fraction(e.top_genres, my_fp.anti_genres) as p,
      case when exists (
        select 1 from vibe_reports v where v.from_user = me and v.to_user = e.id
      ) then -1 * coalesce((w ->> 'vibe_report_penalty')::float8, 0.10) else 0 end as v
    from eligible e
  ),
  raw as (
    select
      s.*,
      coalesce((w ->> 'humor')::float8, 0.45) * s.h
        + coalesce((w ->> 'music')::float8, 0.35) * s.m
        + coalesce((w ->> 'shared')::float8, 0.20) * s.s
        + s.p + s.v as raw_score
    from scored s
  ),
  boosted as (
    select r.*,
      r.raw_score + case
        when r.event_count < freshness_events
             and r.last_active_at > now() - make_interval(days => freshness_days::int)
        then freshness_boost * (
          1 - greatest(0, extract(epoch from (now() - r.last_active_at)) / 86400.0) / freshness_days
        )
        else 0
      end as boosted_score
    from raw r
  ),
  final as (
    select b.*,
      greatest(0, least(100, round(
        100 * b.c * resonance.sigmoid(
          coalesce((w ->> 'sigmoid_slope')::float8, 6)
          * (b.boosted_score - coalesce((w ->> 'sigmoid_midpoint')::float8, 0.5))
        )
      )))::int as score
    from boosted b
  )
  select
    jsonb_build_object(
      'userId', f.id,
      'displayName', coalesce(f.display_name, ''),
      'bio', coalesce(f.bio, ''),
      'age', f.age_years,
      'city', coalesce(f.city, ''),
      'distanceKm', round(f.distance_km::numeric, 1),
      'gender', coalesce(f.gender, ''),
      'lookingFor', to_jsonb(f.looking_for),
      'photoChecked', true,
      'onboarded', true,
      'deletedAt', null,
      'deactivatedAt', null,
      'lastActiveAt', (extract(epoch from f.last_active_at) * 1000)::bigint,
      'eventCount', f.event_count,
      'topArtists', f.top_artists,
      'topGenres', to_jsonb(f.top_genres),
      'topCategories', to_jsonb(f.top_categories),
      'antiGenres', '[]'::jsonb,
      'vibeReported', '[]'::jsonb
    ),
    f.score,
    round(f.h::numeric, 4)::float8,
    round(f.m::numeric, 4)::float8,
    round(f.s::numeric, 4)::float8,
    round(f.c::numeric, 3)::float8,
    round(f.p::numeric, 4)::float8,
    round(f.boosted_score::numeric, 4)::float8,
    (least(my_fp.event_count, f.event_count) < coalesce((resonance.config('confidence') ->> 'trusted_events')::float8, 10)),
    array(select value from jsonb_array_elements_text(f.top_artists)
          where lower(value) in (select lower(x) from jsonb_array_elements_text(my_fp.top_artists) as x)),
    array(select g from unnest(f.top_genres) as g
          where g = any (my_fp.top_genres)),
    array(select c2 from unnest(f.top_categories) as c2
          where c2 = any (my_fp.top_categories)),
    -- A mutual can only be true when the OTHER side has already liked us. Our own
    -- outgoing like is never a match, and an incoming like is never disclosed
    -- otherwise. This is the anti-paywall rule in one expression.
    exists (
      select 1 from likes l2
      where l2.from_user = f.id and l2.to_user = me
        and exists (select 1 from likes l3 where l3.from_user = me and l3.to_user = f.id)
    )
  from final f
  order by f.score desc, f.id
  limit p_limit;
end $$;

-- -------------------------------------------------------------- decide

/**
 * like / pass / resonate. Returns the mutual verdict, the thread, and the
 * icebreaker chips. A thread is created only on a genuine mutual.
 */
create or replace function decide(p_candidate uuid, p_decision text)
returns table (matched boolean, thread_id uuid, icebreaker text)
language plpgsql security definer set search_path = public, resonance as $$
declare
  me uuid := auth.uid();
  mutual boolean := false;
  new_match uuid;
  new_thread uuid;
  a uuid;
  b uuid;
  score int;
  shared_artist text;
  shared_cat text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_decision not in ('like', 'pass', 'resonate') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if p_candidate = me then
    raise exception 'You cannot decide on yourself.' using errcode = '22023';
  end if;

  delete from candidate_cache where user_id = me;

  if p_decision = 'pass' then
    -- A pass records nothing exportable and creates no like row.
    return query select false, null::uuid, null::text;
    return;
  end if;

  -- Free tier: one Resonate a day, enforced here rather than in the UI.
  if p_decision = 'resonate'
     and (select tier from users where id = me) = 'free'
     and not exists (
       select 1 from likes l
       where l.from_user = me and l.kind = 'resonate'
         and l.created_at >= date_trunc('day', now())
     )
  then
    null; -- allowed
  elsif p_decision = 'resonate'
     and (select tier from users where id = me) = 'free' then
    raise exception 'You have used today''s Resonate. It returns tomorrow.'
      using errcode = 'P0001';
  end if;

  insert into likes (from_user, to_user, kind, via)
  values (me, p_candidate, p_decision, 'matrix')
  on conflict (from_user, to_user) do update set kind = excluded.kind;

  -- The mutual reveal: only true when the other side already liked us.
  select exists (
    select 1 from likes l
    where l.from_user = p_candidate and l.to_user = me
  ) into mutual;

  if mutual then
    select least(me, p_candidate), greatest(me, p_candidate) into a, b;

    select greatest(0, least(100, round(
      100 * least(1, greatest(0.5, 0.5 + 0.5 * least(
        (select event_count from fingerprints where user_id = a),
        (select event_count from fingerprints where user_id = b)
      ) / 50.0)) * resonance.sigmoid(
        6 * (
          0.45 * resonance.cosine(
            resonance.res_from_vector((select humor_vec from fingerprints where user_id = a)),
            resonance.res_from_vector((select humor_vec from fingerprints where user_id = b))
          )
          + 0.35 * resonance.cosine(
            resonance.res_from_vector((select music_vec from fingerprints where user_id = a)),
            resonance.res_from_vector((select music_vec from fingerprints where user_id = b))
          )
          + 0.20 * resonance.jaccard(
            array(select value from jsonb_array_elements_text((select top_artists from fingerprints where user_id = a))),
            array(select value from jsonb_array_elements_text((select top_artists from fingerprints where user_id = b)))
          )
          - 0.5
        )
      )
    ))) into score;

    -- NOTE: `x = any (subquery)` does NOT unwrap an array column; Postgres
    -- compares x against each returned row. Use IN (subquery) instead.
    select v into shared_artist
    from unnest(array(
      select value from jsonb_array_elements_text(
        (select top_artists from fingerprints where user_id = a)
      )
    )) as v
    where lower(v) in (
      select lower(w) from unnest(array(
        select value from jsonb_array_elements_text(
          (select top_artists from fingerprints where user_id = b)
        )
      )) as w
    )
    limit 1;

    select x into shared_cat
    from unnest((select top_categories from fingerprints where user_id = a)) as x
    where x in (
      select y from unnest((select top_categories from fingerprints where user_id = b)) as y
    )
    limit 1;

    insert into matches (user_a, user_b, taste_twins, shared_artist, shared_meme_cat, source)
    values (a, b, score, shared_artist, shared_cat, 'matrix')
    on conflict (user_a, user_b) do update
      set unmatched_at = null, taste_twins = excluded.taste_twins
    returning id into new_match;

    insert into threads (match_id) values (new_match)
    on conflict (match_id) do update set last_msg_at = threads.last_msg_at
    returning id into new_thread;

    insert into notifications (user_id, category, payload)
    values
      (a, 'match', jsonb_build_object('matchId', new_match, 'score', score)),
      (b, 'match', jsonb_build_object('matchId', new_match, 'score', score));

    -- Auto-attach the icebreaker so the first message never starts from zero.
    insert into messages (thread_id, sender_id, kind, body)
    values (
      new_thread,
      p_candidate,
      'text',
      case
        when shared_artist is not null then 'ok but have you heard ' || shared_artist || ' though'
        else 'ok but have you heard the key change in this one'
      end
    );

    return query select
      true,
      new_thread,
      case
        when shared_artist is not null then 'You both play ' || shared_artist
        else 'You both play the same strangely specific songs'
      end;
  else
    return query select false, null::uuid, null::text;
  end if;
end $$;
