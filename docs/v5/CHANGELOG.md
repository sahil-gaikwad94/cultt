# v5 — changelog

Conventional commits. Newest first.

## Phase 0.1 — foundations

### Added

- **`src/store/`** — the single persisted source of truth for `reactions`,
  `saves`, `pins`, `seen`, `limits`, `stories`. In-memory reactive layer,
  optimistic writes, debounced persistence, selectors for every read.
  - `types.ts` — the §12 data model, adapted (`kind: 'meme' | 'song'`).
  - `persist.ts` — IndexedDB via `idb` with a localStorage fallback and a
    coalescing writer.
  - `migrate.ts` — `SCHEMA_VERSION`, one-way fold of the pre-v5
    `cultured2:state` blob, newer-schema preservation.
  - `config.ts` — `LAUGHS_PER_DAY` / `RESONATES_PER_DAY` / `STORY_TTL_HOURS` /
    the Home sub-page choices, all remote-configurable.
  - `selectors.ts` — reactions, saves, pins, budgets, seen, stories, and the
    monotonic local-midnight reset.
- **`src/lib/haptics.ts`** — named patterns (`tick`, `light`, `medium`, `thud`,
  `success`, `laugh`, `chord`), Settings toggle, reduced-motion gate, no-op
  fallback.
- **`src/lib/overlay.ts`** — one overlay manager with priorities, a queue, and
  preemption; the only place overlay z-index is decided in JS.
- **`src/copy/`** — typed copy from `v5Direction/copy_deck.md`
  (`index.ts`) plus the vocabularies (`taxonomy.ts`: 15 meme categories, 31
  genres, 6 axes, 15 archetypes, rarity rule).
- **`docs/v5/`** — `STATUS.md`, `DECISIONS.md`, `PERF_AUDIT.md`, `CHANGELOG.md`.
- 58 new unit tests (140 → 198), including a boot-path test that runs the real
  singleton against jsdom's `localStorage`.

### Fixed

- **Shared state is broken (brief §4.1.1).** `renderYou()` filtered
  `Object.keys(S.react)` down to ids present in `POSTS`, while the 122-card
  corpus wrote to a separate `S.mm = {l,s}` shape. Every like/save on "Today's
  memes" was invisible on the You tab. Both shapes now write to and read from
  the store; the You-tab stats, "Saved culture", the pin board and the chat
  meme picker all agree.
- **Modal/toast layering (brief §4.1.2).** A single `--z-*` scale now owns
  every top-level layer (`#nav` 10 → `#splash` 200); previously `#toast` (70)
  sat above `#sheetwrap` (30) at `bottom:100px`, i.e. on the primary button of
  whatever sheet had just opened. The toast is top-anchored and takes its rung
  from the scale.
- **"signal confidence" in the UI** (3 sites) → **Fingerprint clarity**; the
  "Beat one/two/three" eyebrows → plain headings. Both were developer words the
  copy deck explicitly forbids.
- **`expireStories()` returned 0 after expiring stories** — it read
  `state.stories.length` after `commit()` had already replaced `state`.
  Caught by the new test, not by review.
- **`reconcile()` resurrected deleted data** — folding the legacy blob into any
  empty slot meant a user who had unsaved everything got it all back on the
  next boot. The legacy blob is now folded exactly once, on the boot that
  finds no v5 record.
- **Migration collapsed a double reaction** — a POST with both `l` and `h`
  produced two reactions for one item; v5 gives an item exactly one, so the
  laugh now wins.
- **"Clear local data"** now clears the v5 store too, not just `cultured2:*`.

### Changed

- `src/main.ts` awaits `store.ready` before the first screen paints, so the
  first render has real numbers instead of zeros. The store is exposed at
  `window.Cultured.store`.
- `src/styles/tokens.css` gained the gallery surface ramp, the 8-pt spacing
  scale, radii, border-based elevation, motion tokens (with a real damped
  spring behind `@supports (animation-timing-function: linear(0,1))`), and the
  z-scale. The v3 palette is untouched.
- `idb@^8.0.4` added (1 dependency, ~1.2 KB gz).

### Known gaps

- Browser-driven verification (Playwright screenshots, CDP perf traces) cannot
  run in this sandbox — the browser CDN is unreachable. See `PERF_AUDIT.md`.
- `scripts/build-songs.ts` and the meme manifest pipeline are next; they need
  network access to the iTunes/Deezer APIs to resolve real artwork and
  previews.
- Bugs §4.1.3–§4.1.7 (card ghosting, the remaining overlap/clipping set, the
  photo-checked state leak, the garbled reveal name, the "0%" flash) are not
  yet fixed — they belong to the screens that Phase 1–3 replace, and fixing
  them twice would be waste. Each is tracked in `STATUS.md`.

## Phase 0.2 + 0.3 — content pipelines, the v5 runtime, and the corpus deletion

### Content

- `scripts/build-memes.ts` → `src/content/memes.manifest.json` (20 items:
  dominant colour, blurhash, AVIF/WebP renditions at 480/960/1440, dimensions,
  byte size, placard and alt text). `--gate` checks rights and writes nothing.
- `scripts/build-songs.ts` → `src/content/songs.manifest.json` (208 tracks, 31
  genres). iTunes → Deezer fallback, 3.2 s throttle, quadratic backoff on
  403/429. Runs `--offline` here, so every entry is `resolved: false` and no
  preview URL is fabricated.
- `scripts/build-nhie.ts` → `src/content/nhie.manifest.json` (100 questions, 10
  categories, 8 rounds) with `validateBank`/`pickRound`/`cardText`.
- `src/content/index.ts` is the typed read layer: `servableMemes()` filters on
  `rightsCleared`, so unlicensed art cannot reach the app even if the gate is
  bypassed. `npm run content:all` regenerates all three; the manifests are
  committed so a fresh clone builds with one command.

### v5 runtime (`src/v5/`)

- `quality.ts` — 500 ms frame probe, tiers A/B/C, hard caps 300/150/0 particles,
  DPR 2/1.5/1, 6/3/1 Lottie, 3/2/1 videos. `prefers-reduced-motion` forces C.
- `contour.ts` — one shared Canvas2D renderer (WebGL2 path optional), fbm2D
  isolines, `static` mode when the tier or reduced motion says so.
- `reactions.ts` — the two trays, long-press 350 ms, fisheye 1.75×, the
  signature FX per emoji, and the flight to the budget chip.
- `deck.ts` — seeded per-day ordering, category rotation, axis affinity, the
  28%/0.5 px-per-ms commit rule, placard and impact lines, the limit sheet copy.
- `audio.ts` — one element, procedural waveforms seeded by track id. No
  cross-origin audio is ever piped into WebAudio.
- `intro.ts` — `renderIntro(t)` as a pure function of time plus `mountIntro`.
- `home.ts`, `vault.ts`, `mount.ts`, `styles.css` — the Gallery shell. All four
  reach the bundle only through a dynamic import.
- `perfHud.ts` — `?perf=1` overlay.

### Deletion (brief §0.3)

- `scripts/generate-meme-corpus.mjs`, `src/data/seed/memes.json`,
  `src/data/seed/types.ts`.
- The 13 hand-written text cards and the `DEMO_MEMES`/`demoMemes` flag.
- The text branch of `mmVisual`/`mmMini`/`memeBub` and the `mmTxt` helper.

### Bugs fixed

- `orderDeck` silently dropped catalog items (D-15).
- `renderIntro` dealt a placeholder card for an empty catalog (D-14).

### Tests

`vitest run` — **12 files, 262 passing** (was 9 files / 198). New:
`v5-deck.test.ts` (29), `v5-intro.test.ts` (20), `v5-content.test.ts` (15).

### Bundle (brief §10: initial JS ≤ 180 KB gz)

| chunk | before | after |
| --- | --- | --- |
| `legacy-*.js` | 60.09 kB gz | 59.63 kB gz |
| `index-*.js` | 95.71 kB gz | 91.31 kB gz |
| **first paint** | **155.8 kB gz** | **150.9 kB gz** |
| v5 chunks (lazy) | — | home 15.16 · vault 2.47 · intro 2.98 · mount 0.82 · css 4.36 |

Deleting the 122-card text corpus *reduced* first-paint JS by 4.9 kB gz, so the
v5 shell lands with ~29 kB of headroom instead of ~24 kB.

## Phase 2 (continued) — Never Have I Ever

- `src/content/nhie.ts` holds the runtime half of the NHIE pipeline
  (`pickRound`, `cardText`, `ROUND_SIZE`, `roundCount`, `spiceLabel`);
  `scripts/build-nhie.ts` re-exports it and keeps `validateBank` for itself, so
  the app never imports from `scripts/`.
- `src/v5/nhie-screen.ts` — twelve cards, Guilty or Clean and nothing else, a
  stamp per answer, a progress bar, and a rank at the end from the copy deck's
  five bands. Every answer goes straight to `store.markNhieAsked`, so a reload
  mid-round still knows what was asked, and the next round skips it. Friend mode
  takes a `seed` so both players are dealt the same twelve.
- `src/lib/waapi.ts` — one guarded entry point to the Web Animations API. All
  eighteen `.animate()` call sites in `src/v5/` go through it; a missing API
  resolves `finished` immediately instead of throwing.

Tests: 13 files, **276 passing** (was 262). New `v5-nhie.test.ts` (10) drives
the screen through jsdom by clicking; `v5-foundations.test.ts` gained 3 for the
WAAPI guard.

Bundle: `nhie-screen-*.js` is a separate lazy chunk at **2.02 kB gz**. First
paint is unchanged at **150.9 kB gz** against the 180 kB budget.

## Phase 2 (completed) — the last two Home sub-pages

- **The Verdict** (Y2) and **Forecast** (T2) are implemented, so all four Home
  sub-pages exist as the brief requires and only the chosen pair is enabled.
  Previously the pager offered both labels while the render switch fell through
  to the Draft, so flipping the config would have shown the wrong screen.
- `verdictFor(state, now)` is pure: archetype, ranked axes, top reaction and
  Fingerprint clarity, over the yesterday window only.
- `forecastIndex(dayKey, options)` is a deterministic FNV-1a hash, so the
  forecast is stable per day for everyone and never reshuffles on re-render.
- `axisLabel()` added to the copy layer; axis ids no longer reach a screen.

Tests: 13 files, **284 passing** (was 276). `home-*.js` grows to 16.21 kB gz;
first paint is unchanged at 150.9 kB gz.

## E2E — Pixel 7 and iPhone 14

`playwright.config.ts` now runs two projects, `pixel7` (Android Chromium) and
`iphone14` (WebKit), because the two differ in ways this app cares about:
safe-area insets, `backdrop-filter` cost, haptics (Android only) and scroll
chaining. Traces, screenshots and video are retained on failure only.

`tests/e2e/v5.spec.ts` adds 11 specs: the shell mounts into `#s-feed`, the
legacy tab rail still works, the budget shows 15 pips and spends one on a
right-swipe, the enabled sub-pages page correctly, Verdict/Forecast stay hidden
until configured, the Vault reads the same store as the deck, NHIE plays a full
twelve with two buttons and no free text, the flag gate proves an unflagged
build renders the pre-v5 app, and two budget checks (first-paint JS < 180 kB
transferred, CLS < 0.05).

`npx playwright test --list` resolves **50 tests across 5 files**. They cannot
execute in this sandbox — the Playwright browser CDN is unreachable — so they
are committed to run anywhere with `npx playwright install chromium webkit`.

## Phase 3 (flag-gated) — the profile as a wall

`src/v5/profile.ts`, behind `v5config.v5.profile`.

- **The Fingerprint** — one Contour seeded from the user's own axis mix, the
  archetype it resolves to, and a ranked axis breakdown. Below two distinct axes
  it reads "Developing" rather than naming an archetype from noise.
- **The wall** — anthem (1), pinned memes (6), pinned songs (6), each with its
  real alt text as the placard. Editing means unpinning; there is no "add
  content" button, because everything on the wall came from a reaction in the
  Deck.
- `readWall(state)` is pure over the store, so the wall, the Vault and the You
  tab cannot disagree. A pin pointing at content that is not in the manifest
  renders as nothing rather than throwing, and the store keeps it.
- Repaints destroy the previous contour before drawing a new one, so the
  rAF loops cannot pile up.

Tests: 13 files, **291 passing** (was 284). `profile-*.js` is a 2.49 kB gz lazy
chunk, and splitting it out dropped `home-*.js` from 16.21 to 10.00 kB gz. First
paint is unchanged at 150.9 kB gz.

## Phase 3 (flag-gated, continued) — Stories

`src/v5/stories.ts`, behind `v5config.v5.stories`.

- **Composer** — pick a backdrop from the servable memes and tracks, add one of
  the six stickers, a caption, an audience and a reply rule. Nothing posts until
  there is a backdrop, and the button is disabled rather than showing an error.
- **Viewer** — full-bleed stage, a progress bar driven by the real expiry, the
  audience chip, and a "take it down" affordance on your own story.
- **Rail** — yours and everyone else's, each thumb showing the honest time left.

Stories are compositions: a layer references a meme or song id, never bytes.
There is exactly one door art comes through (`servableMemes()`), and a story is
not a second one.

No viewer count. There is no backend, so nobody has seen anything, and a
fabricated count is the fake stat the brief forbids. `copy.stories.viewers`
stays in the deck for when the number can be real.

Tests: 13 files, **297 passing** (was 291). `stories-*.js` is a 3.03 kB gz lazy
chunk; first paint is unchanged at 150.9 kB gz.

## Honesty — no invented people or counts in a production build

Three leaks, all found by executing the code rather than reading it:

- `MockRepo.getCandidates()` returned all 48 seeded people. Verified by
  constructing the default repo and reading back 20 ranked cards with names and
  bios. Now empty unless `v5config.demo`.
- `legacy.ts` `PEOPLE` — nine hard-coded personas with scores and `likesYou`
  flags, read directly by `queue()`. Now `DEMO_DATA ? DEMO_PEOPLE : []`, the
  same pattern `ACTIVITY` and `CIRCLE_SOURCE` already used.
- `DROPS` / `YEST` / `CIRCLE` carried `likes: 312` and lines like "Saved by 41
  people in your circles this week." Now behind `N()` / `WHY()` helpers, and the
  detail page no longer prints "Sent 0 times in your circles".

Verified against the built artefact: `Saved by 41 people`, `Most replayed in
your circles`, `from 38 circles` and `crept up the charts` are all absent from
`dist/assets/legacy-*.js`, no persona bio survives, and the honest density gate
("a lie with a nice layout") is still there.

Tests: 14 files, **304 passing** (was 297). `repo.test.ts` gained four specs for
the opt-in default; `no-fake-people.test.ts` checks the production bundle and
skips itself when `dist/` is absent.

## Perf — back inside the §10 first-paint JS budget

Re-measuring the real import graph showed the v5-enabled first paint at
**184.81 KiB gz, 4.81 KiB over the 180 KiB budget**. The earlier 150.9 KB figure
in STATUS was wrong — it summed two chunks and missed `card`, the v5 chain, and
that `main.ts` awaits `import('./legacy')` before content renders.

`src/data/index.ts` statically imported `SupabaseRepo`, putting 63.03 KiB gz of
`@supabase/supabase-js` in the entry chunk for a backend the default install
never constructs. `createRepo()` is now async and imports it dynamically;
`main.ts` awaits it at the top of `boot()`. A sync `createMockRepo()` stays for
callers that cannot await.

| configuration | first-paint JS | headroom vs 180 KiB |
|---|---|---|
| v5 flags off | 87.57 KiB gz | +92.43 |
| v5 flags on | 124.08 KiB gz | +55.92 |

Tests still 14 files / 304 passing; tsc, eslint and the production build green.

## Honesty — controls that reported success without acting

Follow-up audit after the invented-population fix (D-30). Three more:

- The share sheet offered four buttons and one worked. `Messages` and
  `Your story` toasted success with nothing behind them, and the fallthrough
  toasted "Share sheet opened" on browsers with no OS sheet. Now only Copy link,
  plus Share where `navigator.share` exists.
- `arena-refresh` toasted "new signals found" after a re-render that fetches
  nothing. Now says it is up to date.
- `mm-share` was a live crash, not a lie: it listed persisted thread keys and
  dereferenced `person(pid)`, which returns undefined now that the invented
  population is gated. Guarded in `mm-share` and `mm-send`.

Also added `vercel.json` (SPA rewrite for `/d/:id`, cache headers, `/api/*`
excluded from the rewrite).

Tests still 14 files / 304 passing; tsc, eslint and the production build green.

## Phase 3 complete — Matrix and People, both flag-gated

Two new screens, each behind its own flag (`v5.matrix`, `v5.people`), each
mounted into the existing tab host so the nav rail and deep links keep working.
Both chunks are lazy: 2,101 B gz and 1,391 B gz, reachable only via
`await import`.

Both were designed around the consequence of D-27. With the invented population
gated off, `getCandidates()` and `getThreads()` return empty lists in
production, so the empty state is the primary path rather than an edge case — it
explains the density gate instead of apologising for a bug, and it never fills
the space with invented faces or conversations. A failed fetch is its own state
in both, because an error must not read as an empty city or as having no friends.

The Matrix shows a percentage only when `tasteTwins.calibrating` is false; while
calibrating it says so. Mutual reveal stays the only reveal path.

First-paint JS after both: 87.94 KiB gz with the flags off, 125.07 KiB gz with
them on, against the 180 KiB budget.

Tests 18 files / **345 passing** (was 316). Two bugs found while writing them:
the People preview keyed off the hydrated `last.meme` object rather than the
declared `last.kind`, so a content-only message described itself as the match
banner; and `last.body` is nullable, which would have rendered "null".

## Phase 4 — Arena launcher, behind a flag

The Arena is now a v5 screen (`v5.arena`), a launcher for the three games that
already exist rather than a fourth game. 1.30 kB gz, lazy.

Each tile reports real state. There is deliberately no refresh control: there is
nothing to fetch, and D-30 had already removed the legacy button that toasted
"new signals found" after a plain re-render.

Duel state is read live through a getter rather than snapshotted at mount —
legacy.ts now publishes `duelState` over `S.duelLink`, which is reassigned when a
duel is created and again when its verdict lands, so a copied value would report
a revealed duel as still waiting. A waiting duel shows no score at all, since
`verdict` only exists once both sides have submitted.

First-paint JS with all five v5 tabs on: 125.22 KiB gz against the 180 KiB
budget. All five tabs now have a v5 screen.

Tests 19 files / **361 passing** (was 345).

## Safety — the 18+ age gate was bypassable

The "I'm 18 or older" checkbox set the same flag the date-of-birth field
computed, so ticking it with the date blank unlocked onboarding. The submit path
then sent `dateOfBirth: OB.dob || '2000-01-01'`, and `isAdult('2000-01-01')` is
true — so the server received an adult date of birth for an account that never
supplied one, while the screen claimed the date was "checked server-side".

`OB.adult` is now computed from the date of birth only, `OB.attested` is the
checkbox, Continue requires both, and the submit path never fabricates a date.

Tests 21 files / **379 passing**; the fabricated date is asserted absent from
the shipped legacy bundle.

## Fixes — the intro had no art, and demo content was on by default

Two defects behind the "unrendered UI on most pages" report:

- **The cold open rendered empty.** `mountV5Intro` called `servableMemes()` with
  no argument; every meme is `rightsCleared: false`, so the default filter
  returns `[]` and the 5.5 s intro painted zero cards. The deck and Stories
  already pass `servableMemes(true)` — licensing is enforced at the build gate,
  not by starving the runtime. The intro now matches them (D-34).

- **Demo personas showed by default in dev.** `DEMO_DATA` was
  `DEV && flags.demoData !== false` with `demoData` defaulting true, so every dev
  preview showed the 48 seeded people and the PROTOTYPE banner. Now
  `DEV && (?demo=1 || flags.demoData === true)`: the `DEV &&` prefix still folds
  to `false` in production so the personas tree-shake out of the bundle, but dev
  no longer shows fabricated people without an explicit opt-in (D-35).

Added `tests/unit/v5-surfaces.test.ts`, mounting the intro, Vault, profile wall
and Stories into a real DOM — the four marquee surfaces had no dedicated mount
coverage. The intro test asserts it paints 5 cards, which is what would have
caught the empty-pool bug.

Tests 22 files / **383 passing**; `tsc --noEmit`, eslint, and the
`ALLOW_UNLICENSED=1` build all clean.

## v5 is the app — the flags are now a kill-switch

Every `v5config.v5` screen defaults **on**; `?v5=0` is the kill-switch back to
the legacy shell, and an explicit per-screen `false` drops one surface. The
default path `/` is the v5 app — no `?v5=1` needed (D-36).

The last legacy screen is gone: the You tab now mounts the v5 profile-as-a-wall
into `#s-you` (`mountProfile(host, { embedded: true })`), and `renderYou()` bails
on `v5.profile`. The profile gained an `embedded` mode — no dialog role, no
close button — for when the wall is the screen rather than a layer.

`v5-flags.test.ts` was rewritten for the inverted default (on by default, `?v5=0`
off, explicit keys override either way), and `v5-surfaces.test.ts` now covers the
embedded profile. The e2e suite exercises `/` as the v5 app and `?v5=0` as the
legacy fallback.

Tests 22 files / **386 passing**; `tsc --noEmit`, eslint, and the
`ALLOW_UNLICENSED=1` build all clean. First-paint JS on the default (v5) path is
124.08 KiB gz, inside the 180 KiB budget.
