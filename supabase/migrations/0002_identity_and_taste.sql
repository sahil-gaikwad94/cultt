-- 0002_identity_and_taste.sql — identity, the 18+ gate, fingerprints, events
--
-- Humor is vector(34): 4 style axes + the 30-category taxonomy.
-- Music is vector(48): 24 genres + 16 artist buckets + 8 behavioural features.
-- See DECISIONS.md "vector layout" for why these are not the PDF's 64/128.

-- ------------------------------------------------------------ identity

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext unique,
  phone citext unique,
  dob date not null,
  gender text,
  orientation text[] not null default '{}',
  looking_for text[] not null default '{dating}',
  city text,
  -- Location is fuzzed to about a 1 km cell before it is stored (GDPR
  -- data minimisation). A precise point never reaches this table.
  location_cell text,
  lat double precision,
  lng double precision,
  -- The badge says "photo checked"; it is an on-device best-effort check, not a
  -- verified identity (build brief §2.5).
  verified_photo boolean not null default false,
  liveness_confidence numeric(4, 3),
  liveness_review_state text not null default 'none'
    check (liveness_review_state in ('none', 'queued', 'cleared', 'rejected')),
  -- Separate from photos: confirms the taste data came from a real, aged account.
  verified_fingerprint boolean not null default false,
  mode_default text not null default 'dating' check (mode_default in ('dating', 'friends', 'both')),
  tier text not null default 'free' check (tier in ('free', 'premium')),
  onboarded boolean not null default false,
  deactivated_at timestamptz,
  deleted_at timestamptz,
  deletion_effective_at timestamptz,
  created_at timestamptz not null default now()
);

-- GATE LAYER 1: a hard constraint. Under-18 rows cannot exist in the table.
-- The check uses current_date, which Postgres enforces on every insert and
-- update. There is no way to store an ineligible date of birth, from any code
-- path, including a direct psql session.
alter table users drop constraint if exists users_dob_adult;
alter table users
  add constraint users_dob_adult
  check (dob <= (current_date - interval '18 years')::date);

alter table users drop constraint if exists users_dob_plausible;
alter table users
  add constraint users_dob_plausible
  check (dob >= (current_date - interval '120 years')::date);

-- GATE LAYER 2: a trigger, so the failure is an explicit, typed exception that
-- an RPC can surface to the client rather than a bare constraint violation.
create or replace function assert_adult(p_dob date)
returns void
language plpgsql immutable as $$
begin
  if p_dob is null then
    raise exception 'A date of birth is required.' using errcode = '22023';
  end if;
  if p_dob > (current_date - interval '18 years')::date then
    raise exception 'cultured is 18+. This date of birth is not eligible for an account.'
      using errcode = '22023';
  end if;
end $$;

create or replace function users_assert_adult()
returns trigger
language plpgsql as $$
begin
  perform assert_adult(new.dob);
  return new;
end $$;

drop trigger if exists users_dob_adult_trigger on users;
create trigger users_dob_adult_trigger
  before insert or update of dob on users
  for each row execute function users_assert_adult();

-- GATE LAYER 3: a server-side re-check on every profile edit. A user cannot
-- rewrite their own date of birth to slip under the gate after signup.
create or replace function users_dob_immutable()
returns trigger
language plpgsql as $$
begin
  if new.dob is distinct from old.dob then
    raise exception 'Date of birth cannot be changed after signup. Contact support if it is wrong.'
      using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists users_dob_immutable_trigger on users;
create trigger users_dob_immutable_trigger
  before update on users
  for each row execute function users_dob_immutable();

alter table users enable row level security;

-- ------------------------------------------------------------ profiles

create table if not exists profiles (
  user_id uuid primary key references users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text check (char_length(bio) <= 280),
  -- 2-6 urls, order preserved.
  photos jsonb not null default '[]'::jsonb,
  -- [{prompt_id, answer_text | audio_url}]
  prompts jsonb not null default '[]'::jsonb,
  fingerprint_visibility text not null default 'matches_only'
    check (fingerprint_visibility in ('everyone', 'matches_only', 'me')),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- --------------------------------------------------------- fingerprints

create table if not exists fingerprints (
  user_id uuid primary key references users (id) on delete cascade,
  humor_vec vector(34) not null,
  music_vec vector(48) not null,
  -- The four HSQ axes as a distribution. Kept alongside the vector so the
  -- Fingerprint and the Taste Card can show it without re-deriving it.
  humor_style jsonb not null default '{"affiliative":0.25,"self_enhancing":0.25,"aggressive":0.25,"self_defeating":0.25}'::jsonb,
  anti_genres text[] not null default '{}',
  top_artists jsonb not null default '[]'::jsonb,
  top_genres text[] not null default '{}',
  top_categories text[] not null default '{}',
  event_count int not null default 0,
  vector_version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table fingerprints enable row level security;

-- ----------------------------------------------------------------- events

-- Append-only source of truth for every vector update and every analytic.
-- Insert-only from clients, and never readable by any client role: raw vectors
-- must not be reverse-engineerable from the API.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in (
    'laugh', 'like', 'skip', 'save', 'share', 'meh',
    'duel', 'co_listen', 'drop_react', 'vibe_report'
  )),
  target_type text not null check (target_type in ('meme', 'track')),
  target_id uuid,
  weight numeric not null default 0,
  -- Set when the event was the Daily Drop, which carries a 1.5x multiplier.
  is_drop boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_user_created_idx on events (user_id, created_at desc);
create index if not exists events_target_idx on events (target_type, target_id);

alter table events enable row level security;

-- ---------------------------------------------- identity helper functions

/** The caller's user id, or null when anonymous. */
create or replace function current_user_id()
returns uuid
language sql stable as $$
  select auth.uid()
$$;

/** The caller's row, or null. Never raises, so policies can stay simple. */
create or replace function current_user_row()
returns users
language sql stable security definer set search_path = public as $$
  select * from users where id = auth.uid()
$$;

/**
 * The moderator flag. Server-only; no client policy may ever grant it.
 */
create or replace function is_moderator()
returns boolean
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claim.app_metadata', true)::jsonb ->> 'role') = 'moderator',
    false
  )
$$;

/**
 * The display-safe projection of a taste profile.
 *
 * Raw vectors never leave the database. This returns only what a card may show:
 * a score band's inputs, chips and counters. `fingerprint_view` is the only
 * thing the client reads for a Fingerprint, and it never exposes humor_vec or
 * music_vec either.
 */
create or replace function taste_projection(
  p_humor float8[],
  p_music float8[],
  p_top_artists text[],
  p_top_genres text[],
  p_top_categories text[],
  p_event_count int
)
returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'humor_dimensions', coalesce(array_length(p_humor, 1), 0),
    'music_dimensions', coalesce(array_length(p_music, 1), 0),
    'top_artists', to_jsonb(coalesce(p_top_artists, '{}')),
    'top_genres', to_jsonb(coalesce(p_top_genres, '{}')),
    'top_categories', to_jsonb(coalesce(p_top_categories, '{}')),
    'event_count', coalesce(p_event_count, 0)
  )
$$;
