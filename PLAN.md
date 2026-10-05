# Phase plan

## Phase 0 — foundation

1. Freeze v3 seam as the visual reference and keep the original file for diff review.
2. Create Vite + strict TypeScript + ESLint + Prettier + Vitest + Playwright + CI.
3. Extract HTML/CSS into a Vite entrypoint; isolate the seam in `src/legacy.ts`.
4. Add typed `Repo` contract, offline mock adapter, and Supabase adapter boundary.
5. Add asset manifest fallback contract and product docs.
6. Add visual baselines at 390×844 and 360×800 after browser install.
7. Migrate one screen at a time from legacy into `src/screens`, keeping visual diffs at zero.

## Phase 1 — core loop

1. Route Matrix reactions and decisions through the repo contract.
2. Add match/chat safety actions: report, vibe-report, block, and participant-only chat contract.
3. Add legal/data-control surfaces: privacy, terms, community guidelines, export, and 14-day deletion cooling-off UI.
4. Add Taste Twins/shared artist/shared meme hooks to Matrix cards.
5. Add a Daily Drop/streak contract behind the same mock boundary.
6. Add flow and non-feature tests before enabling any production adapter.

## Top five product risks (ranked)

1. **Trust and safety debt** — an unmoderated dating product is not store-ready; UGC must remain off.
2. **Matching promise without real signal** — fake vectors can erode the core value faster than visual polish can help.
3. **Privacy/consent gaps** — location, photos, deletion, exports, and vectors require server-side guarantees.
4. **Provider fragility** — Spotify, previews, moderation, and liveness need adapters and fallbacks.
5. **Cold-start quality** — candidates and Daily Drop need enough high-quality seed signal before broad launch.

## Needs from the owner before production

Supabase/Firebase/PostHog/Sentry/provider accounts, app-store accounts, legal review, launch geography, domain/trademark decision, and a final choice of enabled auth providers.
