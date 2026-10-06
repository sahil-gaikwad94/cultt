-- 0001_foundation.sql — extensions, tunable config, resonance helpers, legal copy
--
-- Everything the Resonance Engine needs that is not a domain table. The vector
-- helpers are written over float8[] rather than pgvector operators so that:
--   * the maths is one place, callable from plpgsql, and testable in isolation;
--   * `rpc/react` can do its incremental update inside the same transaction as
--     the events insert (build brief §2.6 — no Edge Function per reaction);
--   * weights live in system_config, not in code, so they are tunable per
--     vector_version without an app release.
--
-- res_to_vector / res_from_vector are the only two places that know about
-- pgvector. The local RLS harness substitutes a `vector` domain over float8[],
-- and these two functions are identity-equivalent either way.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

do $$
begin
  -- pgvector is required in production. The harness pre-creates a compatible
  -- `vector` domain when the extension is unavailable, so this is a no-op there.
  begin
    create extension if not exists "vector";
  exception when others then
    if not exists (select 1 from pg_type where typname = 'vector') then
      raise;
    end if;
  end;
end $$;

create schema if not exists resonance;

-- ---------------------------------------------------------------- helpers

/**
 * Normalises a float8 vector to unit length, with the same zero guard as the
 * TypeScript engine (`normalize` in src/lib/matching/vector.ts): an input with
 * no direction falls back to `fallback` rather than amplifying float noise.
 */
create or replace function resonance.normalize(v float8[], fallback float8[] default null)
returns float8[]
language plpgsql immutable as $$
declare
  mag float8;
  out float8[];
  i int;
  fb float8[];
  fb_mag float8;
begin
  if v is null or array_length(v, 1) is null then
    return v;
  end if;

  select sqrt(coalesce(sum(x * x), 0)) into mag from unnest(v) as x;
  out := v;

  if mag is null or mag < 1e-9 then
    fb := coalesce(fallback, array_fill(0::float8, array[array_length(v, 1)]));
    select sqrt(coalesce(sum(x * x), 0)) into fb_mag from unnest(fb) as x;
    if fb_mag is null or fb_mag < 1e-9 then
      return fb;
    end if;
    for i in 1..array_length(fb, 1) loop
      out[i] := fb[i] / fb_mag;
    end loop;
    return out;
  end if;

  for i in 1..array_length(v, 1) loop
    out[i] := v[i] / mag;
  end loop;
  return out;
end $$;

/** Cosine similarity in [-1, 1]. Zero vectors score 0, never NaN. */
create or replace function resonance.cosine(a float8[], b float8[])
returns float8
language plpgsql immutable as $$
declare
  dot float8 := 0;
  ma float8;
  mb float8;
  i int;
begin
  if a is null or b is null then return 0; end if;
  if array_length(a, 1) is distinct from array_length(b, 1) then return 0; end if;

  for i in 1..array_length(a, 1) loop
    dot := dot + (a[i] * b[i]);
  end loop;

  select sqrt(coalesce(sum(x * x), 0)) into ma from unnest(a) as x;
  select sqrt(coalesce(sum(x * x), 0)) into mb from unnest(b) as x;
  if ma < 1e-9 or mb < 1e-9 then return 0; end if;
  return least(1, greatest(-1, dot / (ma * mb)));
end $$;

/** Jaccard index over two text arrays. Empty vs empty is 0, not NaN. */
create or replace function resonance.jaccard(a text[], b text[])
returns float8
language sql immutable as $$
  select case
    when a is null or b is null then 0
    when cardinality(a) = 0 or cardinality(b) = 0 then 0
    else (
      select count(*)::float8 from (
        select unnest(a) intersect select unnest(b)
      ) as shared
    ) / (
      select count(*)::float8 from (
        select unnest(a) union select unnest(b)
      ) as total
    )
  end
$$;

/** Fraction of `pool` present in `anti`. 0 when either side is empty. */
create or replace function resonance.overlap_fraction(pool text[], anti text[])
returns float8
language sql immutable as $$
  select case
    when pool is null or anti is null then 0
    when cardinality(pool) = 0 or cardinality(anti) = 0 then 0
    else (
      select count(*)::float8 from unnest(pool) as p
      where lower(p) = any (select lower(x) from unnest(anti) as x)
    ) / cardinality(pool)::float8
  end
$$;

/** Sigmoid used by the Taste Twins curve. */
create or replace function resonance.sigmoid(x float8)
returns float8
language sql immutable as $$
  select 1.0 / (1.0 + exp(-x))
$$;

/**
 * Projects onto the probability simplex: clamp to [0, 1], then rescale to sum 1.
 * A zero-sum input falls back to an even distribution. Used for the four humor
 * style axes, which must stay a valid distribution at all times.
 */
create or replace function resonance.project_simplex(v float8[], fallback float8[] default null)
returns float8[]
language plpgsql immutable as $$
declare
  out float8[] := v;
  total float8 := 0;
  i int;
  fb float8[];
  fb_total float8 := 0;
begin
  if v is null or array_length(v, 1) is null then return v; end if;

  for i in 1..array_length(v, 1) loop
    out[i] := greatest(0, coalesce(v[i], 0));
    total := total + out[i];
  end loop;

  if total < 1e-9 then
    fb := coalesce(fallback, array_fill(1.0 / array_length(v, 1), array[array_length(v, 1)]));
    for i in 1..array_length(fb, 1) loop
      fb_total := fb_total + greatest(0, coalesce(fb[i], 0));
    end loop;
    if fb_total < 1e-9 then
      return array_fill(1.0 / array_length(v, 1), array[array_length(v, 1)]);
    end if;
    for i in 1..array_length(fb, 1) loop
      out[i] := greatest(0, coalesce(fb[i], 0)) / fb_total;
    end loop;
    return out;
  end if;

  for i in 1..array_length(out, 1) loop
    out[i] := out[i] / total;
  end loop;
  return out;
end $$;

-- ------------------------------------------------- pgvector conversion seam

/** pgvector -> float8[]. Identity when the harness supplies a float8[] domain. */
create or replace function resonance.res_from_vector(v vector)
returns float8[]
language sql immutable as $$
  select (v::real[])::float8[]
$$;

/** float8[] -> pgvector. Identity when the harness supplies a float8[] domain. */
create or replace function resonance.res_to_vector(a float8[])
returns vector
language sql immutable as $$
  select (a::real[])::vector
$$;

-- ---------------------------------------------------------- system_config

/**
 * Weights and tunables. Nothing in the engine hard-codes a weight: react reads
 * these, and the Taste Twins score reads these, so the algorithm is tunable
 * without an app release and versioned alongside vector_version.
 */
create table if not exists system_config (
  key text primary key,
  value jsonb not null,
  description text,
  vector_version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table system_config enable row level security;

insert into system_config (key, value, description) values
  ('event_weights', '{
    "laugh": 1.0, "like": 1.0, "save": 1.2, "share": 1.5,
    "meh": -0.6, "skip": -0.2, "duel": 2.0, "co_listen": 1.8, "drop_react": 1.0
  }'::jsonb, 'Vector movement per event kind (PDF §6.2)'),
  ('weights', '{
    "humor": 0.45, "music": 0.35, "shared": 0.20,
    "anti_genre_penalty": 0.25, "vibe_report_penalty": 0.10,
    "sigmoid_slope": 6, "sigmoid_midpoint": 0.5
  }'::jsonb, 'Taste Twins score weights (PDF §6.3)'),
  ('update', '{
    "humor_decay": 0.995, "music_decay": 0.997,
    "min_weight": -1, "max_weight": 2,
    "axis_block_weight": 0.4, "style_axes": 4,
    "max_anti_genre_shift": 0.12, "anti_genre_floor": 0.02
  }'::jsonb, 'Corrected incremental update constants (see DECISIONS.md)'),
  ('confidence', '{
    "ramp_events": 50, "floor": 0.5, "trusted_events": 10
  }'::jsonb, 'Cold-start confidence ramp (PDF §6.3)'),
  ('candidates', '{
    "pool": 200, "default_limit": 20, "cache_minutes": 15,
    "active_window_days": 30, "freshness_window_days": 7,
    "freshness_event_threshold": 20, "freshness_boost": 0.08,
    "ratio_pacing_threshold": 1.6, "max_same_genre_run": 2
  }'::jsonb, 'Candidate pipeline tunables (PDF §6.3)'),
  ('entitlements', '{
    "free_session_seconds": 900, "free_resonate_per_day": 1,
    "free_trivia_per_day": 2
  }'::jsonb, 'Free tier caps (PDF §10)'),
  ('flags', '{
    "spotify": false, "phone_otp": false, "ugc": false,
    "apple_music": false, "lastfm": true
  }'::jsonb, 'Server-side feature flags. Mirrors CFG.flags in the seam.'),
  ('moderation', '{
    "text_block_threshold": 0.9, "report_sla_hours": 24,
    "liveness_review_threshold": 0.72, "provider": "blocklist"
  }'::jsonb, 'Moderation thresholds. Perspective API is NOT used (brief §2.3).')
on conflict (key) do nothing;

/** Reads one config document. Raises rather than silently defaulting. */
create or replace function resonance.config(p_key text)
returns jsonb
language plpgsql stable as $$
declare
  doc jsonb;
begin
  select value into doc from system_config where key = p_key;
  if doc is null then
    raise exception 'system_config is missing the % document', p_key;
  end if;
  return doc;
end $$;

create or replace function resonance.config_num(p_key text, p_field text, p_default float8)
returns float8
language sql stable as $$
  select coalesce((resonance.config(p_key) ->> p_field)::float8, p_default)
$$;

-- ------------------------------------------------------- legal documents

create table if not exists legal_documents (
  slug text primary key check (slug in ('privacy', 'terms', 'guidelines')),
  title text not null,
  body text not null,
  -- Ships flagged until counsel signs off; both stores and the DMCA position
  -- depend on reviewed text, and an unreviewed policy shown as final is worse.
  status text not null default 'needs_lawyer_review'
    check (status in ('needs_lawyer_review', 'approved')),
  updated_at timestamptz not null default now()
);

alter table legal_documents enable row level security;
