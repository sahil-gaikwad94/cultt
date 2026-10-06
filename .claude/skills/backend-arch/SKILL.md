---
name: backend-arch
description: Build the Cultured Supabase backend per the v4.0 architecture PDF with the build brief's corrections.
# backend-arch
---
Scope: src/data/*, migrations/, supabase/, tests. Read PDF §4-7 + brief §2 (brief wins).

Rules: mock stays default; Repo interface only, no SDKs in UI; RLS everywhere, tests prove no cross-user reads; brief §2: import manual>Last.fm>Apple>Spotify-flag, previews iTunes>Deezer cached; NEVER Perspective API, moderateText()=blocklist+rates+report; phone OTP flagged; badge "photo checked"; rpc/react=plpgsql same-tx, weights in system_config; DOB 18+=CHECK+trigger+re-check; Edge only for outside APIs.

Steps (phase-gated, commit each):
1. Migrations: tables, pgvector, RLS, triggers, seed.
2. rpc/react: atomic event+vector update; 30 humor cats x 4 axes.
3. Resonance Engine TS+SQL: cosine rank, anti-genre penalty, damping, 15-min cache.
4. Flagged adapters: MusicImport, PreviewProvider, moderateText().
5. Auth: Apple+Google+email OTP; 3-layer DOB gate.
6. Chat channels, participant RLS; 15-min session tokens.
7. PostHog via track(); Sentry flagged; env vars only.

Verify: migrations+RLS+unit tests pass; checks green; DECISIONS.md per phase.
Never: UI changes, Repo bypass, Perspective API, prod default-on, hard-coded keys.
---