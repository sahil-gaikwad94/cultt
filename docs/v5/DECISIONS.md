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


### D-17 · The NHIE runtime helpers live in `src/content`, not `scripts/`
`pickRound`, `cardText`, `ROUND_SIZE`, `roundCount` and `spiceLabel` were first
written inside `scripts/build-nhie.ts`. The app needs them at runtime, and an
app importing from `scripts/` inverts the dependency. They now live in
`src/content/nhie.ts` and the script re-exports them — the same arrangement as
`types.ts`, one definition and two consumers. `validateBank` stays in the
script: it validates raw JSON on the way in and the app never sees raw JSON.

`cardText` also flipped to `cardText(question, bank = nhie)`, because at runtime
the bank is the constant and the question is the variable.

### D-18 · Every WAAPI call goes through `src/lib/waapi.ts`
`Element.animate` is universal in the browsers cultured ships to, but absent in
jsdom and in the odd embedded webview, and an unguarded call throws — which
would take the interaction down with it, not just the animation. All eighteen
call sites in `src/v5/` now go through one guarded `animate(target, keyframes,
options)` that returns an `AnimationLike` whose `finished` resolves immediately
when there is no API. The two sites that await `finished` (the deck fly-out and
the tray dismiss) therefore still resolve, and the element lands in its final
state instead of mid-flight.

This is also what makes the v5 screens testable in jsdom without stubbing
WAAPI: `v5-nhie.test.ts` drives the whole round by clicking.


### D-19 · All four Home sub-pages exist; the two chosen are enabled
The brief fixes `HOME_YESTERDAY_SUBPAGE=Y1 (Receipts)` and
`HOME_TOMORROW_SUBPAGE=T1 (The Draft)`, and requires the other two to exist
behind flags. Until now the pager offered `verdict` and `forecast` labels while
the render switch fell through to `renderDraft()` — so flipping
`homeYesterdaySubPage` to `verdict` would have shown the Draft under a Verdict
tab. Both are now real:

- **Y2 The Verdict** (`verdictFor`) reads yesterday's reactions back as an
  archetype, a ranked axis breakdown, a top reaction and a Fingerprint clarity
  percentage. It is pure over `(state, now)`, so the tests pin it. Clarity is
  the top axis's share of the day: 1 for a day on one axis, ~0.17 for a day
  spread across six. Below two axes it says "Still developing" rather than
  naming an archetype from noise.
- **T2 Forecast** (`forecastIndex`) is a deterministic FNV-1a hash of the local
  day key over the six weather lines in the copy deck, so everyone gets the same
  forecast on the same day and it does not reshuffle on every render.

Both are reachable only by setting `window.CULTURED_CONFIG.homeYesterdaySubPage`
/ `homeTomorrowSubPage`; the defaults are still Receipts and The Draft.

### D-20 · Axis ids never reach the screen
`dry_wit` is a storage and matching-engine id. `axisLabel()` in
`src/copy/taxonomy.ts` maps all six to display words, and the Verdict test
asserts no rendered label contains an underscore. The helper lives in the copy
layer, not inline in the screen, so the next surface that shows an axis gets the
same words.


### D-21 · The profile is a projection, never a second copy
`readWall(state)` derives the whole wall — anthem, pinned memes, pinned songs,
remaining room per slot, and the Fingerprint — from the store on every call. It
stores nothing. That is the only way the wall, the Vault and the You tab can
show the same numbers, which is the class of bug §4.1.1 was: two stores, two
truths.

Two consequences worth naming:
- **A pin to content that is not in the manifest renders as nothing.** The store
  keeps the pin (never wipe user data), the wall just cannot hang an image it
  does not have. `readWall` filters rather than throwing, and a test pins it.
- **Editing the wall means unpinning.** There is no "add content" button,
  because everything on the wall arrived through a reaction in the Deck. That is
  what makes it a fingerprint rather than a bio — you cannot write your way to a
  personality here.

### D-22 · The Fingerprint contour is seeded from the user's own axis mix
`seed = round(clarity * 1000) + reactions.length`, so two people with different
taste get different isolines and the same person's shape only moves as their
reactions do. It is not random per render — a shape that changed on every
repaint would be decoration, not a fingerprint.

### D-23 · Repainting tears the previous contour down
The Fingerprint canvas is rebuilt on every store change, and each `createContour`
owns a `requestAnimationFrame` loop. Without an explicit `destroy()` on repaint
the loops pile up: pin six memes and you have six live loops redrawing one
canvas. The screen keeps a list and destroys it before each paint and on
unmount. This is the §10 "≤ 2 heavy effects at once" rule enforced structurally
rather than by counting.


### D-24 · Stories are compositions, never copies
A story is a stack of layers that *reference* a meme or song id plus a sticker
and a caption. No licensed bytes are ever copied into one. That matters for the
rights gate: `servableMemes()` is the only door art comes through, and if a
story could carry bytes it would be a second door. A test asserts a serialised
layer stack contains no data URI and that a layer is just an id.

`describeLayers` skips any layer whose id is no longer in the manifest, so
removing content removes it from stories too rather than leaving a broken frame.

### D-25 · No viewer count, because nobody has viewed it
`copy.stories.viewers` ("Who saw it") exists in the deck, and the screen does
not use it. With no backend there is nobody to have seen a story, and a
fabricated "42 views" is precisely the fake stat the brief forbids. The viewer
shows what is true: the audience you chose and when it expires. When a backend
lands, the count becomes real and the label is already written.

### D-26 · `timeLeft` reports the floor, and a finished story is "Gone."
The countdown floors hours and minutes and returns `copy.stories.expired` at or
after expiry, so a story never reads "1m left" for a minute it no longer has.
`STORY_TTL_HOURS=12` comes from `v5config.hours.storyTtl`, which is the same
value `expireStories()` compares against — one number, two consumers.


### D-27 · The invented population and the fabricated counts are demo-gated
Three places were shipping invented people and invented statistics to a
production build, because the gate only covered part of them:

1. **`MockRepo.getCandidates()`** returned all 48 seeded people. `MockRepo` is
   the default backend, so a production build with no config got a full Matrix
   of strangers who never signed up — verified by constructing the repo and
   reading back 20 ranked cards with names and bios.
2. **`legacy.ts` `PEOPLE`** — a hard-coded nine (Ines, Kai, Dev, Noor, Saoirse,
   Mateo, Wren, Idris, Lena) with scores, ages, bios and `likesYou: true`.
   `queue()` and `gatedCount()` read it directly and never touched the repo, so
   the Matrix screen users actually see was populated regardless. `ACTIVITY` and
   `CIRCLE_SOURCE` right next to it were already gated; this one was not.
3. **`DROPS` / `YEST` / `CIRCLE`** carried `likes: 312, laughs: 18` and
   social-proof lines like *"Saved by 41 people in your circles this week."*
   The detail page rendered them unconditionally, including a "Sent 730 times in
   your circles this week" sentence computed from the fake numbers.

All three now read `DEMO_DATA` (`DEV && flags.demoData !== false`) or, for the
repo, `v5config.demo` (`?demo=1` or an explicit config value). In production the
population is empty and every count starts at zero, so the only numbers on
screen are the ones the user's own taps produced.

Nothing the user created is touched. This gates invented content, not data —
decisions, threads, reactions and saves survive either way, and a test pins that.

`endHTML()` already had the honest alternative written ("A dating deck with
three people in it is a lie with a nice layout"), so an empty population renders
a screen that explains the density gate rather than a broken one. The reaction
chip and the detail-page sentence now branch on a zero total instead of printing
"0 reactions" / "Sent 0 times", which is true but reads like a bug.

### D-28 · The production guarantee is tested against the artefact
`tests/unit/no-fake-people.test.ts` reads the real `dist/assets/legacy-*.js` and
asserts the persona bios and the social-proof strings are absent, and that the
honest density gate survived. It checks the bundle rather than the source
because the failure mode is a constant that does not fold: `DEMO_DATA` is
`DEV && …` and `DEV` is `import.meta.env.DEV === true`, and an earlier
`typeof import.meta !== 'undefined'` guard defeated the folding and left the
seeded people in the shipped bundle. Source-level assertions would have passed
through that. The test skips itself when `dist/` has not been built, so a plain
unit run does not require one.

The room seat map still carries ten first names behind `FEATURE_ROOMS`, which is
off by default and reachable from no shipping surface. That is dead code, not a
visible fake, so it is left alone rather than half-gated.


### D-29 · The Supabase client is imported lazily
Measuring the real first-paint graph (static imports only, from `dist/index.html`
inward) put the v5-enabled critical path at **184.81 KiB gz — 4.81 KiB over the
§10 budget of 180**. The figure recorded earlier in these notes (150.9 KB) was
wrong: it summed two chunks and missed `card`, the v5 chain, and the fact that
`main.ts` awaits `import('./legacy')` before any content renders, which puts
legacy on the critical path even though the import is dynamic.

The cause was `src/data/index.ts` statically importing `SupabaseRepo`, whose
`@supabase/supabase-js` import put **63.03 KiB gz** in the entry chunk. Supabase
is the *optional* backend — it is only constructed when the host page sets
`CULTURED_CONFIG.backend === 'supabase'` — so the default install paid for a
client it never used.

`createRepo()` is now `async` and imports `supabaseRepo` dynamically. `main.ts`
awaits it once at the top of `boot()`; `installRepoBridge` moved inside `boot()`
with it. A sync `createMockRepo()` remains for callers that cannot await.

Result, measured from the rebuilt graph:

| configuration | first-paint JS | JS+CSS | vs 180 KiB |
|---|---|---|---|
| v5 flags off (main today) | 87.57 KiB | 113.55 KiB | +92.43 headroom |
| v5 flags on (`?v5=1`) | 124.08 KiB | 150.06 KiB | +55.92 headroom |

`supabaseRepo-*.js` now appears in the graph only as a dynamic edge off the
entry, so it is fetched after first content and only for the backend that needs
it.

**How these numbers are taken.** Chunk membership is resolved by parsing only
real `import` statements out of the built files — `import"./x.js"`,
`import{…}from"./x.js"` and `import("./x.js")` — never by scanning for string
literals. The naive version of that scan also matched the `__vite__mapDeps`
precache array at the top of every entry, which made the transitive closure
swallow all 18 chunks and reported two different configurations as identical at
226.16 KiB. Anyone re-measuring this should expect a wrong number if they grep
instead of parsing.


### D-30 · Audit for actions that lie, after the audit for people that lie
D-27 removed invented people. Auditing the rest of the app for the same class of
dishonesty — a control that reports success without doing the thing — turned up
three more, all in `legacy.ts`:

**The share sheet.** It offered four buttons and one of them worked. `copy`
copied the link; `more` opened the OS sheet where one existed. `msg` toasted
*"Sent to Messages"* and `story` toasted *"Added to your story"* with no
implementation behind either, and the fallthrough toasted *"Share sheet opened"*
when the OS sheet was missing — so on a desktop browser, three of four buttons
claimed a share that never happened. A button that lies is worse than no button,
because the user walks away believing a message was sent.

The sheet now offers only Copy link, plus Share where `navigator.share` exists,
and states plainly that the link is the only way out where it does not. A
dismissed OS sheet no longer toasts (cancelling is not a failure), and the copy
path reports failure instead of assuming the clipboard worked. The native sheet
already covers every real target, so nothing the user could actually do was
lost.

**`arena-refresh`.** It increments a counter and re-renders from state already
on the device, then toasted *"Arena refreshed · new signals found"*. It fetches
nothing. The Arena screen around it was already honest — the duel status is read
from the real localStorage record and the week badge is computed from the actual
ISO date — so the button was the only dishonest part of it. It now says it is up
to date.

**`mm-share` was a crash, not a lie.** It listed `Object.keys(S.threads)`, and
thread keys are persisted while the people behind them are not. With the
invented population gated off, `person(pid)` returns `undefined`, so `orb(p)`
and `p.name` threw on a list that used to be populated. This is the blast radius
D-27 opened and the reason that change needed a follow-up pass rather than a
commit on its own. `mm-share` now filters to people who resolve; `mm-send` bails
with a message rather than dereferencing `undefined`.

Threads are left on disk. These are view-level guards: nothing the user created
is deleted, and a thread becomes visible again the moment its person exists.

The three remaining `person(...).name` dereferences are all inside the listening
room and are covered by the `openRoom` guard — `R.w` is seeded from the
validated `withWho`, and `room-who` only cycles `R.friends`, which is
empty-checked before `ROOM` is ever created.

### D-31 · `vercel.json`, and why the build gate has to fail a deploy
Added the missing deployment config: one rewrite of everything except `/api/*`
to `index.html` (the `/d/:id` duel deep link parses `location.pathname`, so it
needs the SPA fallback), immutable caching on Vite's content-hashed `/assets/*`
and the generated media, and `must-revalidate` on `index.html` so a deploy is
never stale. The rewrite regex is compiled and checked; `/api/preview` keeps
serving from the function rather than falling through to the SPA.

`npm run build` begins with `content:gate`, which fails on the 20 unlicensed
memes unless `ALLOW_UNLICENSED=1` is set. That is the brief's build gate working
as specified, so the override is deliberately **not** baked into `vercel.json` —
it has to be set as a deployment env var by someone choosing to ship
unlicensed placeholder art. Defaulting it on would have defeated the gate that
exists to prevent exactly that.


### D-32 · The 18+ checkbox is an attestation, not a substitute for a date of birth
The onboarding age gate was bypassable, defeating the server-side 18+ check the
brief lists under *preserve*.

`OB.adult` was written by two unrelated things. The date field's `oninput`
handler computed it from the real date of birth; the "I'm 18 or older" checkbox
flipped it directly with no date involved. Continue was gated on `OB.adult`
alone, so leaving the date blank and ticking the box unlocked the flow.

The submit path then covered the gap:

```js
dateOfBirth: OB.dob || (OB.adult ? '2000-01-01' : '')
```

`isAdult('2000-01-01')` is `true`, so the server received an adult date of birth
for an account that never supplied one. The screen reads "Your date of birth is
checked server-side" while sending a date the user never entered — the check was
running against a value invented to pass it.

Confirmed by executing `isAdult()` against the three payloads involved: `''`
rejects, `'2015-06-01'` rejects, `'2000-01-01'` accepts.

The two concepts are now separate flags. `OB.adult` is computed from the date of
birth and nothing else; `OB.attested` is the checkbox — a legal acknowledgement,
not evidence of age. Continue requires both, and the submit path sends the real
date of birth or nothing. The checkbox markup was rebound from `OB.adult` to
`OB.attested`; without that the switch would not have visually reflected the
click.

`legacy.ts` is `@ts-nocheck`, so this is pinned two ways: the build proves it
compiles, and `no-fake-people.test.ts` asserts `'2000-01-01'` is absent from the
shipped `legacy-*.js`.

### D-33 · The legacy screens are production, not scaffolding
STATUS carried a note that bugs §4.1.3–§4.1.7 "live on screens Phase 1–3
replace; fixing them twice is waste." That reasoning stopped holding once every
v5 flag defaulted off: `main` ships the legacy screens, so those bugs are live
for every user, and the age gate in D-32 was found on exactly that path.

The lesson worth keeping: a flag-gated replacement does not retire the thing it
replaces until the flag is on by default. Until then both are production, and
the old one has the larger audience.

### D-34 · The intro read the licensed-only meme pool and got nothing

`mountV5Intro` called `servableMemes()` with no argument. Every meme in the
manifest is `rightsCleared: false` (they are placeholder art), so the default
filter returns `[]` — the 5.5 s cold open rendered with zero cards. The deck
(`home.ts`) and Stories already pass `servableMemes(true)`; the intro was the one
caller that did not.

Licensing is enforced where it matters — the build gate fails a production build
while any meme is unlicensed (§0, `content:gate`). A build that exists was
allowed to ship, so the runtime serves the same pool everywhere. The intro now
matches the deck. Pinned by `tests/unit/v5-surfaces.test.ts`, which mounts the
intro and asserts it paints 5 cards; with an empty pool that assertion fails.

### D-35 · Demo content is opt-in on every build, dev included

`legacy.ts` had `DEMO_DATA = DEV && CFG.flags.demoData !== false`, and the config
defaulted `demoData: true`. The result: every dev preview showed the 48 seeded
personas, the circle transcripts, and the yellow PROTOTYPE banner — fabricated
social proof handed to anyone who opened the URL. That is the one thing the
honesty rules forbid, and it was the default path.

Now `DEMO_DATA = DEV && (?demo=1 || flags.demoData === true)`. The `DEV &&`
prefix is load-bearing: it folds `DEMO_DATA` to the constant `false` in a
production build, so the personas tree-shake out of the shipped bundle —
`no-fake-people.test.ts` asserts their bios are absent from `dist`. Dropping the
prefix would gate them at runtime but still ship them. In dev the personas now
cost one query param instead of being on by default. This mirrors the v5 `demo`
gate (`?demo=1`), so the invented population is never the default path anywhere.

### D-36 · v5 is the app, not a flag

Until now every v5 screen defaulted off and `?v5=1` turned the shell on, so the
shipping app was the legacy one and v5 read as a prototype bolted to the side.
That framing was wrong: v5 is the product. The defaults are flipped — every key
in `v5config.v5` is `true` — and the flags survive only as a kill-switch.
`?v5=0` hands all five screen hosts back to the legacy renders; an explicit
per-screen `false` drops one surface without a redeploy. `readV5Config` resolves
`shellDefault = getParam('v5') !== '0'`, so the default path `/` is the v5 app
and the only way to reach legacy is to ask for it.

This also retired the last legacy screen. The You tab was still `renderYou()`;
`main.ts` now mounts `mountProfile(host, { embedded: true })` into `#s-you`, and
`renderYou()` bails on `v5.profile`. The profile grew an `embedded` mode for
this: no `role="dialog"`, no `aria-modal`, no close button, because when the wall
*is* the screen there is nothing to close back to. Opened as a layer from the
Home avatar it is still a modal.

What did **not** change: the legacy module still provides the shell — nav rail,
onboarding, the duel route, settings — and the honesty rules. The personas stay
behind `?demo=1` (D-35), and the production bundle still tree-shakes them out
(D-27). Flipping v5 on does not smuggle in fake people; the demo gate is
independent of the shell flag, and `v5-flags.test.ts` asserts exactly that.

The §4.1.3–§4.1.7 legacy screen bugs (D-33) are now reachable only through the
`?v5=0` kill-switch rather than on the default path. Onboarding and the shell
remain legacy for everyone, so the age gate (D-32) still matters.

### D-37 · OG cards are generated, not stored, and rasterised at the edge

A shared duel link with no `og:image` previews as a bare URL, and the viral loop
dies at the share sheet. The card is generated on request rather than baked per
duel: `src/lib/og.ts` is a pure `renderOgCard(input) → svg` with no I/O and no
state, so it is trivially testable and impossible to go stale. `api/og.ts`
rasterises it to PNG with `sharp` (already a dependency) because Facebook and
Twitter do not render SVG `og:image`.

Two safety points, both pinned by tests: every dynamic string is XML-escaped and
the accent is validated as a 6-digit hex, so a crafted `?title=</svg><script>`
cannot inject markup; and the rasterised PNG is asserted non-blank (peak luma
above the ink ground), which is what catches a missing font in the deploy
environment silently shipping an empty card.

What this does **not** do: per-duel `og:title`/`og:image` on the `/d/:id` route.
That path is served as the static SPA shell, and crawlers do not run JS, so the
meta has to be injected server-side before the crawler sees it — an edge rewrite
on the deploy target. The endpoint already takes the params; only the per-route
HTML injection is outstanding, and it cannot be built or tested in this sandbox.

### D-38 · The original screens are the app; v5 is the alternative

D-36 made v5 the default. That was the wrong call: the v5 Gallery layout
replaced a design that already worked, and the product owner's verdict was that
the original cultt screens were the better base — "previous app layout was good,
and you shifted hard on it." So the default is reverted.

`readV5Config` now resolves the v5 *screens* off by default and on only under
`?v5=1`; the original `renderFeed`/`renderMatchShell`/`renderPeople`/
`renderArena`/`renderYou` own their hosts again. This reverses D-36 for the
screens.

The one v5 piece kept on by default is the **intro**. Its cold-open animation
was explicitly liked ("good new animation"), and it replaced the legacy ~11s
cold open — which is now skipped when the v5 intro runs, fixing the double intro
both were playing back to back. Two readability fixes went with it: a scrim
behind the headline and a text-shadow, because the gold type sat directly on the
meme art and was unreadable.

The lesson: a redesign is not automatically an improvement. The v5 work stays in
the tree behind `?v5=1` so none of it is lost, but the shipping app is the
original layout, with the cards enriched (depth, gradient ground, image vignette,
filled category pill) rather than replaced.
