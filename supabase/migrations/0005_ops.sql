-- 0005_ops.sql — abuse reports, moderation queue, notifications, billing, consent

-- --------------------------------------------------------------- reports

-- The ABUSE path. Distinct from vibe_reports, which recalibrate and never
-- punish. Both stores require a working reporting flow with a human on the end.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references users (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'meme', 'message', 'comment', 'circle_post')),
  target_id uuid not null,
  reason text not null,
  detail text check (char_length(detail) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  priority int not null default 0,
  reviewer uuid references users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_open_idx on reports (status, priority desc, created_at);
create index if not exists reports_reporter_idx on reports (reporter);

alter table reports enable row level security;

create table if not exists moderation_queue (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('meme', 'photo', 'message', 'comment', 'profile', 'liveness')),
  item_id uuid not null,
  user_id uuid references users (id) on delete set null,
  auto_score numeric(4, 3),
  auto_flags text[] not null default '{}',
  reviewer uuid references users (id) on delete set null,
  decision text check (decision in ('approve', 'hold', 'remove', 'escalate')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists moderation_queue_pending_idx on moderation_queue (decided_at nulls first, created_at);

alter table moderation_queue enable row level security;

-- --------------------------------------------------------- notifications

-- `category` carries the per-type toggle from Settings. Three sections in the
-- product, four toggleable push categories. Marketing defaults off.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  category text not null check (category in (
    'match', 'message', 'feed', 'fingerprint', 'daily_drop', 'marketing'
  )),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create table if not exists push_tokens (
  user_id uuid not null references users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

-- Notification preferences, kept server-side so push fan-out can respect them
-- without asking the client.
create table if not exists notification_prefs (
  user_id uuid primary key references users (id) on delete cascade,
  matches boolean not null default true,
  feed_activity boolean not null default false,
  daily_drop boolean not null default true,
  marketing boolean not null default false,
  quiet_from time,
  quiet_to time,
  updated_at timestamptz not null default now()
);

alter table notification_prefs enable row level security;

-- ------------------------------------------------------------- billing

create table if not exists subscriptions (
  user_id uuid primary key references users (id) on delete cascade,
  product_id text not null,
  store text not null check (store in ('app_store', 'play_store', 'stripe')),
  status text not null default 'active' check (status in ('active', 'grace', 'expired', 'refunded')),
  expires_at timestamptz,
  original_transaction_id text,
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- playlist_pass, rewind credits, meme packs. Core social functions are never
-- gated; these are the extras from PDF §10.
create table if not exists entitlements (
  user_id uuid not null references users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table entitlements enable row level security;

-- ------------------------------------------------------------- consent

-- GDPR/CCPA consent log: what was agreed to, when, and against which version.
create table if not exists consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  document text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text
);

create index if not exists consent_log_user_idx on consent_log (user_id, document);

alter table consent_log enable row level security;

-- ------------------------------------------------------- data requests

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'queued' check (status in ('queued', 'ready', 'purged', 'cancelled')),
  requested_at timestamptz not null default now(),
  effective_at timestamptz,
  completed_at timestamptz,
  download_url text
);

create index if not exists data_requests_user_idx on data_requests (user_id, kind, requested_at desc);

alter table data_requests enable row level security;

-- ------------------------------------------------- server-side rate limits

/*
 * Launch-scale rate limiting for the surfaces a client can spam: reactions,
 * messages and reports. Keyed by user and a time bucket so a burst is capped
 * without a scheduled job. The moderation adapter reads these; the blocklist is
 * the classifier until Sightengine text or an open model is wired in behind
 * `moderate_text` (build brief §2.3 — Perspective API is not used).
 */
create table if not exists rate_limits (
  user_id uuid not null references users (id) on delete cascade,
  action text not null,
  bucket timestamptz not null,
  count int not null default 0,
  primary key (user_id, action, bucket)
);

alter table rate_limits enable row level security;

/**
 * Increments a bucket and reports whether the caller is still within budget.
 * `p_limit` of null means uncapped.
 */
create or replace function consume_rate_limit(p_action text, p_limit int, p_window interval)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  bucket_ts timestamptz := date_trunc('hour', now());
  current_count int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_limit is null then
    return true;
  end if;

  insert into rate_limits (user_id, action, bucket, count)
  values (auth.uid(), p_action, bucket_ts, 1)
  on conflict (user_id, action, bucket)
    do update set count = rate_limits.count + 1
  returning count into current_count;

  return current_count <= p_limit;
end $$;
