-- 0004_matching_and_chat.sql — likes, matches, blocks, threads, sessions, duels

-- --------------------------------------------------------------- likes

-- A like is a private act. The sender can read their own row; the recipient can
-- only ever learn about it through a mutual match. That is how "no paywall on
-- seeing likes" stays true and stays scrape-proof (PDF §5.1).
create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references users (id) on delete cascade,
  to_user uuid not null references users (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'resonate')),
  -- Where the like came from: matrix | meme | artist | drop.
  via text not null default 'matrix' check (via in ('matrix', 'meme', 'artist', 'drop')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

create index if not exists likes_to_user_idx on likes (to_user);

alter table likes enable row level security;

-- -------------------------------------------------------------- matches

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  -- user_a < user_b so a pair can never be stored twice.
  user_a uuid not null references users (id) on delete cascade,
  user_b uuid not null references users (id) on delete cascade,
  -- Snapshot at match time so the card does not drift as tastes change.
  taste_twins int,
  shared_artist text,
  shared_meme_cat text,
  source text not null default 'matrix' check (source in ('matrix', 'duel', 'meme', 'artist', 'drop')),
  created_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)
);

alter table matches enable row level security;

-- ----------------------------------------------------------------- blocks

create table if not exists blocks (
  blocker uuid not null references users (id) on delete cascade,
  blocked uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create index if not exists blocks_blocked_idx on blocks (blocked);

alter table blocks enable row level security;

-- A vibe-report is a recalibration signal, not an abuse report. It is stored
-- separately so it can never be shown to the other person or used to punish
-- them (PDF §8, brief §1.3).
create table if not exists vibe_reports (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references users (id) on delete cascade,
  to_user uuid not null references users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

alter table vibe_reports enable row level security;

-- ------------------------------------------------- membership helpers

/**
 * Match membership. SECURITY DEFINER on purpose: it has to read `matches` to
 * decide, and it must not be possible to satisfy it by inserting a row the
 * caller can already see. It only ever answers a boolean.
 */
create or replace function is_match(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.unmatched_at is null
      and (
        (m.user_a = p_a and m.user_b = p_b)
        or (m.user_a = p_b and m.user_b = p_a)
      )
  )
$$;

create or replace function is_my_match(p_match uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.id = p_match
      and m.unmatched_at is null
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
$$;

/** True when either side has blocked the other. Blocking is symmetric in effect. */
create or replace function is_blocked_pair(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks b
    where (b.blocker = p_a and b.blocked = p_b)
       or (b.blocker = p_b and b.blocked = p_a)
  )
$$;

-- The other participant in a match, from the caller's point of view.
create or replace function match_other(p_match uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when m.user_a = auth.uid() then m.user_b
    else m.user_a
  end
  from matches m
  where m.id = p_match
$$;

-- --------------------------------------------------------------- threads

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches (id) on delete cascade,
  last_msg_at timestamptz,
  created_at timestamptz not null default now()
);

alter table threads enable row level security;

-- Defined after `threads` exists: Postgres validates SQL function bodies at
-- CREATE time, so a forward reference to a table in the same migration fails.
create or replace function is_thread_participant(p_thread uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from threads t
    join matches m on m.id = t.match_id
    where t.id = p_thread
      and m.unmatched_at is null
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
$$;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads (id) on delete cascade,
  sender_id uuid not null references users (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'voice', 'meme', 'track')),
  body text check (char_length(body) <= 280),
  media_url text,
  meme_id uuid references memes (id) on delete set null,
  track_id uuid references tracks (id) on delete set null,
  reply_to uuid references messages (id) on delete set null,
  status text not null default 'live' check (status in ('live', 'held', 'removed')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and body is not null)
    or (kind in ('meme', 'track') and (meme_id is not null or track_id is not null))
    or (kind in ('image', 'voice') and media_url is not null)
  )
);

create index if not exists messages_thread_idx on messages (thread_id, created_at);

alter table messages enable row level security;

-- ------------------------------------------------------------- sessions

/*
 * Listening sessions.
 *
 * The 15-minute cap is enforced server-side by a signed, expiring token rather
 * than by trusting a client-reported duration: `session_tokens.expires_at` is
 * set from the entitlement at start, and `session_end` clamps the recorded
 * duration to it. A client that keeps playing past expiry has no valid token to
 * send with its `session_moments`.
 */
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  started_by uuid not null references users (id) on delete cascade,
  track_id uuid references tracks (id) on delete set null,
  seats int not null default 2 check (seats between 1 and 4),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds int not null default 0 check (seconds >= 0),
  -- The hard ceiling for this session, from the entitlement at start time.
  cap_seconds int,
  created_at timestamptz not null default now()
);

create index if not exists sessions_match_idx on sessions (match_id, started_at desc);

alter table sessions enable row level security;

create table if not exists session_tokens (
  token uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists session_tokens_session_idx on session_tokens (session_id);

alter table session_tokens enable row level security;

create table if not exists session_moments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  track_id uuid references tracks (id) on delete set null,
  t_ms int not null check (t_ms >= 0),
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now()
);

alter table session_moments enable row level security;

-- "Our Soundtrack": tracks a match listened to together.
create table if not exists soundtracks (
  match_id uuid not null references matches (id) on delete cascade,
  track_id uuid not null references tracks (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (match_id, track_id)
);

alter table soundtracks enable row level security;

-- ----------------------------------------------------------- meme duel

create table if not exists duels (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  meme_set uuid[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'revealed', 'expired')),
  created_at timestamptz not null default now(),
  unique (match_id)
);

alter table duels enable row level security;

/*
 * Captions are hidden until BOTH sides have submitted. RLS enforces that, not
 * the client: the select policy only exposes the partner's row once the caller
 * has their own row AND the duel status is 'revealed'. There is no "peeking".
 */
create table if not exists duel_captions (
  duel_id uuid not null references duels (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  captions text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

alter table duel_captions enable row level security;
