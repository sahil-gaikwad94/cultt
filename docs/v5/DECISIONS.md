# v5 — decisions log

Every non-trivial judgment call made while building v5, with the alternatives
considered and why this one won. Newest at the bottom within a phase.

Legend: **D-nn** decision id · *Alt* what else was on the table · *Why* the reason.

---

## Phase 0 — foundations

### D-01 · Content lives in `v5Direction/`, not `v5-content/`
The build brief refers to `v5-content/` in the repo root. The checkout has
`v5Direction/` containing the same three files (`nhie_questions.json`,
`songs_seed.csv`, `copy_deck.md`) plus `01_AGENT_PROMPT.md` (the brief itself,
byte-identical to the task) and `02_PRODUCT_BRIEF.md`.

- *Alt*: copy/rename the folder to `v5-content/`.
- *Why*: renaming would churn the owner's own working folder for no product
  gain. The pipeline scripts read `v5Direction/` and a `CONTENT_DIR` env var
  overrides the path if the folder is ever renamed.

### D-02 · v5 is built as new typed modules; the legacy seam is rewired, not forked
`src/legacy.ts` is a 2,057-line IIFE that renders every screen with
`innerHTML` and keeps everything in one `cultured2:state` localStorage blob.
There is no framework and no router (`#s-feed`, `#s-arena`, … are static
sections toggled by class).

- *Alt A*: rewrite the app in React/Svelte. Rejected — rule 7 forbids new heavy
  dependencies, and a framework rewrite would throw away 140 passing unit
  tests, the duel link flow and the RLS/supabase contract for zero user value
  in Phase 0.
- *Alt B*: keep patching the seam. Rejected — the seam has two parallel state
  systems (see D-03), which is the actual root cause of the headline bug.
- *Why*: new typed modules under `src/store/`, `src/lib/`, `src/copy/`,
  `src/v5/` become the source of truth; the seam imports them. Screens migrate
  one at a time, exactly as the existing `PLAN.md` already prescribes, and
  nothing is ever left half-built.

### D-03 · One persisted store; the two legacy state systems collapse into it
Root cause of bug §4.1.1 is now confirmed in code:

- `ACT.save` / `ACT.like` / `ACT.laugh` (`src/legacy.ts:556-558`) write
  `S.react[postId] = {l,h,s}` — keyed by the **10 hard-coded `POSTS`** ids
  (`d1a…y3`, built at `src/legacy.ts:154`).
- `ACT['mm-like']` / `ACT['mm-save']` (`src/legacy.ts:1871-1872`) write a
  **second** shape, `S.mm = {l:{},s:{}}` — keyed by the **122+ meme corpus**
  ids (`x1…x13` + `SEED_MEMES`).
- `renderYou()` (`src/legacy.ts:1385-1386`) computes
  `saved = Object.keys(S.react).filter(id => S.react[id].s && POSTS[id])`.

  So a save on any card in "Today's memes" is written to `S.mm.s`, is not in
  `S.react`, and even if it were, `POSTS[id]` is `undefined` for it — the
  filter drops it. Same for laughs. That is exactly "Resonances/Saved/Laughs
  given = 0" and "Saved culture: Nothing saved yet".

- *Alt*: patch `renderYou()` to also read `S.mm`. Rejected — that keeps two
  stores and guarantees the next screen repeats the bug.
- *Why*: `src/store/` is the single source of truth for `reactions`, `saves`,
  `pins`, `seen`, `limits`, `stories`. All screens read through selectors.
  The legacy shapes are read once, migrated, and then mirrored (not
  re-derived) so old installs keep their data — the brief's "never wipe".

### D-04 · Legacy reaction shapes map onto v5 emoji reactions
`S.react[id].l` (heart), `.h` (laugh), `S.mm.l[id]` (heart), `S.mm.s[id]`
(bookmark) predate the 8-emoji tray.

- Mapping: heart → `❤️`, laugh → `🔥` ("Slaps"), bookmark → a `Save`.
- Selector rule: **any reaction other than `❤️` counts as a laugh** (the brief
  says the first reaction picked on an item spends one laugh). `❤️` is kept as
  a legacy non-laugh reaction so migrated data never silently changes meaning.
- *Alt*: drop the hearts. Rejected — that is a data wipe by another name.

### D-05 · Persistence: IndexedDB (`idb`) with a localStorage fallback
- *Alt A*: keep localStorage only. Rejected — the `seen` set and reaction log
  grow without bound and localStorage is a 5 MB synchronous string store.
- *Alt B*: Dexie. Rejected — `idb` is ~1.2 KB gz and the schema is three
  object stores; Dexie's query layer buys nothing here.
- *Why*: `idb@8` (added to `package.json`, 1 dep, ~1.2 KB gz). A
  `PersistenceAdapter` interface hides the choice; Node/jsdom tests and any
  browser without IndexedDB get the localStorage adapter, so the same code path
  is exercised in CI.

### D-06 · Versioned migration, keyed `cultured@v5`, legacy key preserved
The store writes `localStorage['cultured@v5']` / IndexedDB db `cultured-v5`.
`cultured2:*` is **read and left in place** for one release so a rollback
cannot lose anything. `SCHEMA_VERSION` is stamped in the payload; an unknown
newer version is preserved untouched rather than reset.

### D-07 · Limits are advisory client-side, enforced by the store's monotonic day
`LAUGHS_PER_DAY = 15`, `RESONATES_PER_DAY = 15`, both read from
`window.CULTURED_CONFIG.limits` when present (remote config) and defaulted in
`src/store/config.ts`. The day key is `local YYYY-MM-DD` derived from
`Math.max(Date.now(), lastObservedTs)` so rolling the device clock back does not
mint a second budget. There is no backend enforcing it yet; that is recorded as
a known gap rather than silently trusted.

### D-08 · Haptics behind one module; sound stays opt-in and off by default
`src/lib/haptics.ts` exposes named patterns (`tick`, `light`, `medium`, `thud`,
`success`, `laugh`) over `navigator.vibrate`, no-ops elsewhere, and respects the
existing `set.haptics` toggle plus `prefers-reduced-motion`. The seam's ad-hoc
`haptic([8,30,8])` call sites migrate onto names over the phases.

### D-09 · One overlay manager with an explicit z-scale
Bug §4.1.2 (duel modal over Home, welcome toast over buttons) is a layering
problem with no owner. `src/lib/overlay.ts` owns open/close/queue with
priorities (`toast` < `sheet` < `modal` < `reaction-tray` < `coachmark`) and
`src/styles/tokens.css` gains a `--z-*` scale that is the only place z-index
numbers are written.

### D-10 · Song/meme pipelines are committed, but resolution needs a network this sandbox does not have
The sandbox's outbound allowlist is `github.com`, `api.github.com`,
`registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`. `itunes.apple.com`
and `api.deezer.com` are **not** reachable here, and neither is
`cdn.playwright.dev`.

- Consequence: `scripts/build-songs.ts` is written, committed and unit-tested
  against a recorded fixture, but its first live run (208 tracks → artwork +
  30 s previews) has to happen on a machine with network. Until then the
  manifest is generated with `resolved: false` and the UI shows the honest
  "No preview for this one. Open it in Apple Music or Deezer." line from the
  copy deck.
- The Playwright suites are committed and runnable (`npm run test:e2e`) but
  cannot execute in this sandbox for the same reason. `docs/v5/STATUS.md`
  records what was verified how.
- *Alt*: fabricate artwork/preview URLs so the screens look finished.
  Rejected — rule 6 (no fake data) and it would ship dead links.

### D-11 · Copy is a typed module generated from the deck, keyed by screen
`src/copy/` exports one frozen object per screen plus shared vocabularies
(categories, genres, archetypes, reaction names). Components never hard-code
strings. "signal confidence" is renamed **Fingerprint clarity** in the two
places the seam still prints it (`src/legacy.ts:1509`, `:1792`, `:1794`).


### D-12 · The text-meme corpus is deleted, not deprecated
`scripts/generate-meme-corpus.mjs` (277 lines), `src/data/seed/memes.json`
(122 generated typographic cards) and the generated `memes.ts` are gone.
`src/data/seed/memes.ts` is now a hand-written adapter that maps the real image
manifest to the shape the feed, `MockRepo` and the seed SQL consume, so there is
exactly one source of truth: `src/content/memes.manifest.json`.

Three consequences were accepted deliberately:
- **The feed shrank from 122 cards to 20.** That is the honest size of the
  corpus. The Deck says so (`"N in the gallery"`), and the empty state is real
  rather than padded with generated cards.
- **Seeded like/laugh counts are gone.** They were fabricated
  (`likes: 208, laughs: 212`) and rule 6 forbids fake stats. A meme now starts
  at 0 and only the user's own taps move it. `supabaseRepo` reads `image_url`
  (a column that has existed since `0003_content.sql`) and unlicensed rows seed
  as `status = 'pending'` rather than `'live'`.
- **The legacy card markup lost its text branch.** `mmVisual`, `mmMini` and both
  `memeBub` variants rendered `<span class="mm-e">` plus `mmTxt(...)` when a
  card had no image. No card can lack an image now, so those branches are dead
  code and were removed rather than left to rot.

*Alt*: keep the generator behind a flag. Rejected — the brief says delete it,
and a flag would leave 122 fabricated cards one config value away from
production.

### D-13 · v5 screens live behind `v5config.v5`, opt-in via `?v5=1`
`readV5Config()` gained a `v5: { intro, home, vault }` block. All three default
to `false`; `?v5=1` turns the whole shell on and `window.CULTURED_CONFIG.v5` can
opt a single screen in or out. `main.ts` reaches `src/v5/mount.ts` only through
a dynamic import, and `legacy.ts` reads the same flag to bail out of
`renderFeed()`, so a build without the flag renders byte-for-byte the pre-v5
app. That is what keeps `main` deployable while Phase 2 lands.

### D-14 · The intro never invents a card
`renderIntro(t, memes)` dealt `Math.max(1, …)` cards, so an empty catalog still
showed one blank card — a placeholder standing in for content that does not
exist. It now deals `min(5, floor(memes))`, and with nothing servable the
ember, the contours and the wordmark carry the 5.5 s on their own. This matters
because every shipped meme is currently `rightsCleared: false`, so
`servableMemes()` returns `[]` in a production build.

### D-15 · Deck ordering scans the whole pool each pick
`orderDeck`'s meme picker kept a monotonic cursor and searched forward from it.
Any meme skipped because its category was over-used at that moment was never
revisited, so a 24-meme + 8-song catalog dealt **30** of its 32 items and the
missing two were invisible. The picker now scans every unused meme and orders
by (category use, affinity score). O(n) per pick, n ≤ ~250 — well inside a
frame. The test that caught it pins the invariant: every catalog item reaches
the deck exactly once.

### D-16 · Placard overrides replace the `Exhibit №n` template
The copy deck specifies `Exhibit №{n} · {category} · Mood: {mood}`, and
`placardFor()` still composes exactly that at render time. The `placard` field
in the manifest is the *hand-written* line for that specific image
(`memes.meta.json` overrides), which is what `alt` is built from
(`title. placard`). Two different jobs, deliberately: the template is the
museum furniture, the override is the real alt text.
