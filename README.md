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
npm run test:e2e        # Playwright against the dev server
```

`tests/e2e` covers the two-party Duel link (creator tab + recipient tab on one
localStorage) and the reduced-motion/Calm contract: every core interaction must
still land its state with animation suppressed. If the sandbox cannot reach
Playwright's browser CDN, point the suite at a local build with
`CULTURED_CHROME=/path/to/chrome npx playwright test`.

The original v3 seam remains the visual source of truth in `cultured_v4_seam.html`. The Vite entrypoint preserves its rendered structure and procedural art while loading it through `src/legacy.ts`. New typed contracts live in `src/lib` and `src/data`; screens can migrate from the seam one at a time without a visual rewrite.

## Duel links

`/d/:id` (with a `?d=id` fallback for static hosts) is the Meme Duel recipient
page — no account, no app chrome, five choice prompts, and a verdict that only
exists once both players have submitted. Duel records live in their own
`cultured2:duels` store with a 14-day TTL; the watermark and growth CTA appear
only on cards that leave the app.


## Adapter boundary

`src/data/index.ts` selects the offline mock adapter by default. The Supabase adapter is intentionally contract-complete but not enabled until migrations and project credentials exist. UI code should call `window.Cultured.repo`, never a backend SDK directly.

## Product guardrails

- No swipe-to-judge in Culture Feed.
- No “who liked you” paywall.
- No guilt notifications.
- No face grid; Matrix remains a single-card deck.
- UGC stays off until moderation and takedown workflows are real.
