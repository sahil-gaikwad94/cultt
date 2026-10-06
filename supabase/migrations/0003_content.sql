-- 0003_content.sql — memes, tracks, drops, reactions, comments, circles
--
-- Memes ship source='pack' and status='live' from the generated seed corpus.
-- UGC already has the column and the moderation state, but nothing can insert a
-- UGC row until the `ugc` flag is on and the moderation pipeline is live
-- (build brief §6.3). The flag is enforced in the RPC, not just in the UI.

create table if not exists memes (
  id uuid primary key default gen_random_uuid(),
  -- A stable id from the generator, so the seed is re-runnable.
  slug text unique,
  source text not null default 'pack' check (source in ('ugc', 'licensed', 'pack')),
  image_url text,
  thumb_url text,
  caption_text text not null,
  -- Text alt for screen readers: caption plus a short description.
  alt_text text not null default '',
  ocr_text text,
  -- Phase 1: set from the human taxonomy tags. Phase 2: CLIP + OCR embeddings.
  style_vec vector(34),
  categories text[] not null default '{}',
  topic text not null default 'all',
  -- The v3 seam already paints cards in these three tokens.
  bg text not null default '#EFE9DA',
  fg text not null default '#141413',
  ac text not null default '#F26B4E',
  likes int not null default 0,
  laughs int not null default 0,
  license_meta jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'live', 'removed')),
  uploader_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists memes_status_topic_idx on memes (status, topic);
create index if not exists memes_categories_idx on memes using gin (categories);

alter table memes enable row level security;

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  spotify_id text unique,
  title text not null,
  artist text not null,
  -- Resolved on demand by the PreviewProvider and cached here (brief §2.2).
  preview_url text,
  preview_source text check (preview_source in ('itunes', 'deezer', 'provider')),
  preview_attribution text,
  preview_checked_at timestamptz,
  genres text[] not null default '{}',
  length_seconds int,
  style text,
  blurb text,
  embedding vector(48),
  created_at timestamptz not null default now()
);

create index if not exists tracks_artist_idx on tracks (artist);
create index if not exists tracks_genres_idx on tracks using gin (genres);

alter table tracks enable row level security;

-- Last.fm enrichment caches. Keyed by MBID / artist+track so any artist is
-- fetched once, ever. Drained by a 1-per-400ms cron (PDF §4.4).
create table if not exists artist_tags (
  artist text primary key,
  tags jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists track_tags (
  track_key text primary key,
  tags jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists enrich_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('artist', 'track')),
  target text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (kind, target)
);

create index if not exists enrich_jobs_status_idx on enrich_jobs (status, created_at);

alter table artist_tags enable row level security;
alter table track_tags enable row level security;
alter table enrich_jobs enable row level security;

create table if not exists daily_drops (
  day date primary key,
  meme_id uuid not null references memes (id),
  track_id uuid not null references tracks (id),
  hint text,
  created_at timestamptz not null default now()
);

alter table daily_drops enable row level security;

-- Reactions are the client-visible echo of an event. The event is the truth.
create table if not exists reactions (
  user_id uuid not null references users (id) on delete cascade,
  meme_id uuid not null references memes (id) on delete cascade,
  kind text not null check (kind in ('laugh', 'like', 'meh')),
  created_at timestamptz not null default now(),
  primary key (user_id, meme_id, kind)
);

alter table reactions enable row level security;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 140),
  status text not null default 'live' check (status in ('live', 'held', 'removed')),
  created_at timestamptz not null default now()
);

create index if not exists comments_meme_idx on comments (meme_id, created_at);

alter table comments enable row level security;

-- Saved culture: what lands on the Fingerprint's meme shelf and playlist.
create table if not exists saves (
  user_id uuid not null references users (id) on delete cascade,
  target_type text not null check (target_type in ('meme', 'track')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table saves enable row level security;

-- ------------------------------------------------------------- circles

create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists circle_members (
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  meme_id uuid references memes (id) on delete cascade,
  track_id uuid references tracks (id) on delete cascade,
  caption text check (char_length(caption) <= 200),
  -- Squad remix: a repost of another circle post with a new caption.
  remix_of uuid references circle_posts (id) on delete set null,
  created_at timestamptz not null default now(),
  check (meme_id is not null or track_id is not null)
);

create index if not exists circle_posts_circle_idx on circle_posts (circle_id, created_at desc);

alter table circles enable row level security;
alter table circle_members enable row level security;
alter table circle_posts enable row level security;

/** Membership check used by the circle policies. */
create or replace function is_circle_member(p_circle uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from circle_members cm
    where cm.circle_id = p_circle and cm.user_id = auth.uid()
  )
$$;

-- ------------------------------------------------------- candidate cache

-- A per-user top-N deck, cached 15 minutes and invalidated early on a new match
-- or a filter change (PDF §4.4).
create table if not exists candidate_cache (
  user_id uuid primary key references users (id) on delete cascade,
  payload jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

alter table candidate_cache enable row level security;
