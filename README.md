# cultured

A calm, dark-only front-end prototype for a dating app that matches on humor and music before faces.

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:4173`. The default adapter is offline `mock`; no credentials are needed.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The original v3 seam remains the visual source of truth in `cultured_v4_seam.html`. The Vite entrypoint preserves its rendered structure and procedural art while loading it through `src/legacy.ts`. New typed contracts live in `src/lib` and `src/data`; screens can migrate from the seam one at a time without a visual rewrite.

## Adapter boundary

`src/data/index.ts` selects the offline mock adapter by default. The Supabase adapter is intentionally contract-complete but not enabled until migrations and project credentials exist. UI code should call `window.Cultured.repo`, never a backend SDK directly.

## Product guardrails

- No swipe-to-judge in Culture Feed.
- No “who liked you” paywall.
- No guilt notifications.
- No face grid; Matrix remains a single-card deck.
- UGC stays off until moderation and takedown workflows are real.
