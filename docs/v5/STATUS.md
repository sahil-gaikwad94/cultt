# v5 — status

Working branch: `arena/692eddb5-cultt`. Baseline commit: `53e05ea`.

## Baseline (measured before any change)

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | pass, 0 errors |
| Unit tests | `npx vitest run` | **140 passed** (6 files) |
| Lint | `npx eslint .` | 0 problems |
| Build | `npm run build` | OK — `index` 344.4 kB / **95.7 kB gz**, `legacy` 175.9 kB / **60.1 kB gz** |
| Dev server | `npm run dev` | up on `:5173`, `GET /` → HTTP 200 |
| Browser install | `npx playwright install chromium` | **fails** — `cdn.playwright.dev` ECONNRESET (host not in the sandbox allowlist) |

## Repo facts established by reading, not assuming

- Framework: **Vite 6 + TypeScript, no framework, no router.** Static
  `<section class="screen">` elements in `index.html` toggled by `go(tab)`.
- State: one `localStorage` blob, `cultured2:state`, merged over `DEF()` in
  `src/legacy.ts:207`. A second, parallel shape `S.mm = {l,s}` lives at
  `src/legacy.ts:1861`.
- Backend: `Repo` contract (`src/lib/types.ts`) with `MockRepo` (default) and a
  contract-complete `SupabaseRepo` gated on `window.CULTURED_CONFIG`. Seven
  SQL migrations exist under `supabase/migrations/`. **No `/api` directory and
  no Vercel config** — so `/api/preview` in §4.4 is a new file, not an edit.
- Local memes: `public/memes/meme-01..20.webp`, unlicensed web-search images
  (`public/memes/sources.json`), gated behind `DEMO_MEMES = DEV && flags.demoMemes`
  — already never in a production build. Plus **122 AI-generated typographic
  memes** in `src/data/seed/memes.{ts,json}` + the generator
  `scripts/generate-meme-corpus.mjs` — §4.3 says these get deleted.
- Tokens: `src/styles/tokens.css` (6 lines: ink/coal/ash/bone/heart/sun…),
  1,516 lines of `src/styles/app.css`, display face = **Bricolage Grotesque**
  via Google Fonts (variable, opsz/wdth/wght). No monospace, no sticker face.
- Fingerprint generator: `fpParams(seed)` → `{a:[3 amplitudes], p:[3 phases], d}`
  and `fpSVG(params, c1, c2, {n, w})` (`src/legacy.ts:272-288`). Seed comes from
  `hash(S.prof.humor + '|' + artists + '|' + tastes)` — **not** from reactions,
  which is why §6.3's "reactions are data" needs the new store first.
- Onboarding: 9-segment bar, steps 0-8 in `drawObNow()` (`src/legacy.ts:1718`),
  `OB.photoChecked` is a module-level field reused across steps (bug §4.1.5),
  age is a `<input type="date">` + client-side `>=18` check at `:1737` with the
  real server check inside `repo.onboard()`.
- NHIE: `NHI_CARDS` inline in `src/legacy.ts:994`, 10 cards, no persistence of
  asked ids → repeats every round (matches brief §3 row 20).
- Duel: locked reveal, `src/duel/{card,page}.ts`, `/d/:id` route in
  `src/main.ts`, records in `cultured2:duels` with a 14-day TTL.

## Shipped

### Phase 0.1 — single store, layering, haptics, copy (this pass)

- `src/store/` — persisted single source of truth for `reactions`, `saves`,
  `pins`, `seen`, `limits`, `stories`, with an in-memory reactive layer,
  optimistic updates, selectors, and a **versioned migration** that reads the
  legacy `cultured2:state` (both shapes) and never deletes it. IndexedDB via
  `idb`, localStorage fallback for jsdom/older browsers.
- Bug §4.1.1 fixed at the root: `renderYou()` stats, "Saved culture", the pin
  board and the meme-card like/save buttons all read and write through the
  store. Regression tests added.
- `src/lib/overlay.ts` + `--z-*` scale in `src/styles/tokens.css`: one overlay
  manager with priorities and a queue (bug §4.1.2).
- `src/lib/haptics.ts`: named patterns, one module, no-op fallback.
- `src/copy/`: typed copy from `v5Direction/copy_deck.md`; "signal confidence"
  → "Fingerprint clarity".

### Verified this pass

```
npx tsc --noEmit   → 0 errors
npx eslint .       → 0 problems
npx vitest run     → 198 passed / 9 files   (baseline 140 / 6)
npm run build      → OK, demo assets pruned from dist
GET / on :5173     → 200; /src/store/index.ts, /src/lib/overlay.ts,
                     /src/lib/haptics.ts, /src/copy/taxonomy.ts all 200
```

The code paths those commands actually executed: `createStore()` → `reconcile()`
→ `migrateLegacyState()` on a real legacy blob (asserting 4 saves and 2 laughs
survive), `laughBudget()` at the cap, `spendResonate()`, `expireStories()`,
`createOverlayManager()` preemption/queueing, `createHaptics()` under a
reduced-motion media query, and `archetypeFor()` / `nhieRank()` /
`compatLabel()` against the copy deck. The boot-path test imports the real
`getStore()` singleton in jsdom and asserts it migrates and persists to
`cultured@v5`.

What was **not** executed: anything needing a real browser. See below.

## Known issues / gaps

- **Browser-driven verification is blocked in this sandbox** (Playwright
  browser CDN unreachable). Screenshots in `docs/v5/screens/` and the
  `PERF_AUDIT.md` trace therefore have to be produced on a machine with
  network; the scripts and configs are committed so it is one command.
  Substituted here: vitest + jsdom harnesses that exercise the real modules,
  plus `tsc`/`eslint`/`vite build`.
- `scripts/build-songs.ts` cannot reach the iTunes/Deezer APIs from here
  (see DECISIONS D-10). Manifest generation is committed but unresolved until
  it runs with network.
- Bugs §4.1.3–§4.1.7 are **not fixed yet**: card ghosting during Deck swaps,
  the remaining overlap/clipping set, the `OB.photoChecked` state leak, the
  garbled reveal name, and the "0%" flash. They live on screens Phase 1–3
  replace; fixing them twice is waste. Recorded here so nothing is silently
  dropped.
- **Resolved since Phase 0.1:** `scripts/generate-meme-corpus.mjs` and
  `src/data/seed/memes.json` are deleted, and `src/data/seed/memes.ts` is now a
  70-line adapter over `src/content/memes.manifest.json`. The Deck is not
  empty: it renders the 20 real images in `public/memes/`.
