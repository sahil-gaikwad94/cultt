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
