-- 000_shim.sql — LOCAL TEST HARNESS ONLY. Never applied to a Supabase project.
--
-- Supabase owns the `auth` and `storage` schemas, so this file supplies the
-- minimum needed to run the real migrations and the real RLS tests against a
-- real PostgreSQL:
--
--   * real pgvector (`create extension vector`), so `vector(34)` columns and the
--     `<=>` operators are the genuine article, not a stand-in.
--   * `auth.users`, `auth.uid()` and `auth.role()`, backed by session settings
--     the same way Supabase backs them with a JWT claim.
--
-- If this shim were responsible for a security property, the test would be
-- meaningless. It is not: RLS, the 18+ gate, the mutual-reveal rule and the
-- session cap are all implemented in the migrations and are exercised unchanged.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "vector";

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  created_at timestamptz not null default now()
);

-- Mirrors the values Supabase reads out of the request JWT.
create or replace function auth.uid()
returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

-- Storage stand-in: the migrations only need the bucket metadata and the
-- `storage.foldername` helper used by the storage policies.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

alter table storage.objects enable row level security;

-- Supabase ships this helper; the storage policies call it.
create or replace function auth.is_service_role()
returns boolean
language sql stable as $$
  select auth.role() = 'service_role'
$$;

-- Supabase's role set. The migrations revoke from these by name, so they must
-- exist here or the revokes are no-ops and the RLS test would prove nothing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- Supabase grants these by default on the public schema. The migrations revoke
-- the sensitive tables back down; reproducing the grant here is what makes the
-- revokes meaningful.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- Mirror Supabase's insecure default so the migrations must explicitly revoke.
grant all on all tables in schema public to anon, authenticated;
