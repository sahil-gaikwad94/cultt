
## 2026-10-06 — ambient backgrounds, vibe zones, and the playable Meme Duel

- Added layered backgrounds to relevant surfaces: AI-generated stills for the Matrix and profile header, a procedural brand-palette still for the Feed, and seamless 8-second silent Ken-Burns MP4 loops behind the Feed and Matrix. All media renders at low opacity with blur/tint under the UI, and Calm Mode plus `prefers-reduced-motion` disable it. The AI video-model route was unavailable on the current plan (credit limit), so motion loops were cut deterministically with FFmpeg instead of generated.
- Pulse gained a canvas particle layer (signal dots plus tiny note/star glyphs), a "Vibe zones" rail with named moods (Feral Hours, Golden Hour, 3AM Brain, Soft Sunday, Ramen Budget) that deep-link into the matching meme topic, and the Meme Duel is now a real five-prompt flow: independent caption picks, progress dots, a deterministic partner reveal, a verdict score, replay, and send-to-chat.
- Content taxonomy expanded: meme tabs renamed to fun topic names (For You, 9–5 Cyber, Main Character Audio, Couch Canon, Third Space, Situationship HQ, Ramen Budget) with new love/money topics and cards; music genres extended (Amapiano, Jungle, Neo-soul) with flavor tags shown on song detail; anti-genre list extended.
- A stylesheet mishap (an overwrite instead of an append) briefly unstyled the app; it was rebuilt from git history plus the session blocks, and all work is now committed to prevent recurrence.

## 2026-10-06 — Resonance Engine v1, real adapters, generated seed corpus

**What.** Added the matching engine (`src/lib/matching/`), the safety and
entitlement rules (`src/lib/safety.ts`, `src/lib/entitlements.ts`), the legal
copy (`src/content/legal.ts`), a 122-card generated meme corpus, and two real
`Repo` adapters. The Supabase adapter is written against the RPC contract but is
**not** enabled: `src/data/index.ts` still returns `MockRepo` unless
`CULTURED_CONFIG.backend === 'supabase'`.

**Vector layout.** Humor is **34-d = 4 style axes + 30 categories**, matching the
architecture PDF's "taxonomy of 30 humor categories x 4 style axes" and the brief.
The 30 categories are 20 content families plus 10 format/pace features, because
the PDF lists format features (reaction, deep-fried, wholesome-comic, text-post,
video-clip) as taxonomy entries rather than a separate region. Music is **48-d =
24 genres + 16 hashed artist buckets + 8 behavioural features**: pgvector has no
reason to carry 128 dims when 48 ranks identically, and a smaller vector is
cheaper to update on every reaction. `taxonomy.ts` throws at import time if the
category count drifts from the dimension count.

**The corrected incremental update rule.** The PDF's
`normalize(0.995 * v + w * x)` had five defects, each fixed in `update.ts`:
(1) one `w` for both blocks meant reacting to a meme needed a track embedding, so
events now name a domain and only move that block; (2) the 4 style axes are a
probability distribution but were decayed and cosine-compared as magnitudes, so
they now get re-projected onto the simplex after every event; (3) `normalize()` of
a near-zero vector amplifies noise, so a long run of meh/skip (w = -0.6, -0.2) no
longer explodes, it falls back to the target vector; (4) weights are clamped to
[-1, 2] so one event cannot flip a profile; (5) anti-genres are now first-class
and subtract from the genre block with a floor, instead of only costing points at
scoring time and staying in the vector.

**Cold-start.** `rankCandidates` applies a freshness boost (up to +0.08 on the raw
score, fading over 7 days) to profiles under 20 events, and a gender-ratio pacing
cap so an imbalanced pool throttles the over-represented side's deck rather than
flooding the scarce side. The pacing filter caps dominant-side cards in place and
never drops a scarce-side card, so relevance order is preserved. This is the
Schmooze retention guardrail from the PDF, kept explicit.

**Mock is a real backend.** `MockRepo` runs the actual engine: reactions write
events and update vectors, candidates are ranked by real Taste Twins over real
vectors from `src/data/population.ts` (48 people, deterministic, no hard-coded
scores), and decisions, threads, safety, sessions, duels and data rights all
persist to `localStorage`. `MockRepo` is what CI, tests and offline dev run
against; `SupabaseRepo` is checked against the same `Repo` interface.

**Flags.** Unchanged and all still off: `spotify`, `phoneOtp`, `ugc`.
`appleMusic` and `lastfm` are declared in the config type but have no adapter
wired yet (next step). Photo-check copy says "photo checked", never "verified
identity", and low-confidence captures route to a human review queue.

**Baselines.** No screen was touched in this step, so no Playwright baseline was
moved.

## 2026-10-06 — engine test suite, four engine bugs found, guardrail tests

**What.** Added 128 unit tests across five suites: the engine fixtures, safety,
entitlements, adapter contract, and the four binding non-features. The tests
found four real defects, all fixed in source rather than worked around:

1. **The humor vector was not unit length after an update.** Projecting the four
   style axes back onto the simplex (sum = 1) and then normalising the whole
   vector are contradictory requirements, so the vector drifted to ~1.25 and the
   cosine was measured against a moving scale. **Fix:** the axis block now
   occupies a fixed share of the vector (`AXIS_BLOCK_WEIGHT = 0.4`), so the axes
   stay a valid distribution *and* the vector stays unit length. `humorAxes()`
   exposes the distribution itself, which is what `humor_style` stores.

2. **An untagged profile fabricated a taste signal.** With no styles and no
   categories, `tasteHumorVector` used to invent `[0.4, 0.25, 0.1, 0.25]`, so two
   brand-new users looked identical and matched each other on nothing. **Fix:**
   no input means a zero vector. The fallback distribution only applies when
   there is taxonomy signal but no explicit axes.

3. **Anti-genre subtraction was mathematically erased.** A targeted subtraction
   followed by `normalize` is invisible to cosine, so the blocked genre went
   straight back up. This is the exact case the brief calls out — dislikes must be
   first-class. **Fix:** the shrink is now multiplicative (so it survives the
   renormalise as a relative loss) with an absolute floor, and a blocked genre
   test asserts the blocked dim ends up smaller than the unblocked one and still
   above zero.

4. **Diversity re-clustered at the tail.** Deferred cards were appended in order,
   which re-formed the very run the rule exists to prevent (a run of 3 with
   `maxRun = 2`). **Fix:** the hold-back buffer is retried after every accepted
   card, so deferred cards interleave instead of bunching. The test asserts the
   run limit and that nothing is ever dropped.

**Contract fixes found by typechecking the tests.** `getCandidates` no longer
requires the caller to supply the viewer's taste — the adapter resolves it from
the signed-in profile, because a caller that could pass in someone else's
vectors could read a score they should not see. `taste` survives only as an
explicitly offline-only override the mock adapter honours. `replayEvents` now
takes fingerprint-less drafts and threads the running vector through them.
`startListeningSession` refuses a capped session outright instead of creating a
row, so usage can never be inflated by a client retrying against the cap.

**Guardrail tests.** The four non-features from §1.3 are now asserted against the
shipped source: the Culture Feed never reaches `queue()`, `.pcard`, `PEOPLE` or
`decide()`, and its cards carry no pass/resonate action; no "who liked you" copy
exists anywhere and `likesYou` is read exactly once, inside `decide()`; a list of
guilt phrasings is absent, and the legal copy's only mention of a waiting count is
the sentence promising there is not one; the Matrix renders `q.slice(0, 3)` and
there is no face-grid class in the stylesheet.

**Flags.** Unchanged. `mock` is still the default adapter.

## 2026-10-06 — real Supabase schema, RLS, and the atomic react RPC

**What.** Wrote the ordered migration set (`supabase/migrations/0001`–`0007`)
that the architecture PDF §5 specifies, plus a runnable SQL test harness
(`supabase/tests/run.sh` + `010_rls.test.sql`) and a local `auth`/`storage` shim.

**Why an executable proof, not a schema dump.** A schema that has never been
applied is a drawing. Every migration now runs against a real PostgreSQL 14 with
real pgvector 0.7.4, and 59 assertions prove the security properties the product
promises. Building pgvector from source was worth it: `vector(34)`/`vector(48)`
columns, and every `<=>`-style comparison, are the genuine article rather than a
`float8[]` stand-in.

**Key decisions.**

1. **The incremental vector update lives in Postgres.** `react()` is one plpgsql
   function, so the events insert and the fingerprint update are one transaction
   and cannot half-apply. Brief §2.6 explicitly wants this instead of an Edge
   Function per reaction — it removes a per-reaction invocation cost and the
   lost-update race between two concurrent taps.
2. **Weights live in `system_config`, never in code.** `event_weights`,
   `weights`, `update`, `confidence`, `candidates`, `entitlements` and `flags`
   are rows. `react()` reads them at call time. Retuning the algorithm is an
   `update`, not an app release.
3. **`x = any (subquery)` does not unwrap an array column.** Postgres compares
   `x` to each returned row, which fails on a `text[]` column. Two places in
   `decide()` had to use `IN (subquery)` instead. Caught by running it.
4. **`users` has no `updated_at`.** The deck's freshness signal reads the latest
   `events` row, falling back to `created_at`. That is the honest definition of
   "last active" anyway.
5. **RLS on a filtered UPDATE does not raise.** Postgres matches zero rows and
   reports success, so the security test asserts *rows affected = 0* via
   `t_affected()` rather than expecting an exception. This is a stronger claim:
   it proves the write is impossible, not merely that one statement failed.
6. **`events` is revoked, not filtered.** `authenticated` has no `SELECT`
   privilege at all, so reading raises `permission denied`. If events were
   readable the vectors could be reverse-engineered from the API.
7. **Postgres validates SQL function bodies at CREATE time**, so a helper cannot
   reference a table defined later in the same migration. `is_thread_participant`
   moved below `threads`.

**Proven properties** (see `010_rls.test.sql`): a signed-in user cannot read
another user's profile, raw humor/music vectors, incoming likes, events, or
messages from a thread they are not in; cannot insert or update another
account's rows; `anon` sees no private table; a 17-year-old cannot be created and
DOB is immutable after signup; the mutual-match reveal happens only when *both*
sides have acted (an incoming like is never disclosed); the anti-genre penalty
measurably lowers a blocked-genre listener's score; a repeated reaction is
idempotent and does not move the vector.

**Flags added.** None at runtime. `flags` stays in `system_config`; mock remains
the default adapter. `supabase/` is inert until credentials exist.

## 2026-10-06 — generated seed migration

**What.** `scripts/build-seed-sql.mjs` emits `supabase/migrations/0009_seed.sql`:
122 original memes and 24 original tracks, with real `vector(34)` / `vector(48)`
values, plus a fortnight of daily drops.

**Why generate rather than hand-write.** The vectors come from the app's own
`memeStyleVector` / `trackEmbedding`, loaded through esbuild. Re-implementing the
taxonomy in SQL would be a second source of truth that drifts silently: a tag
added to `taxonomy.ts` would change the client's vectors and not the database's,
producing a feed that ranks incorrectly with no error anywhere. Now the seed and
the client cannot disagree, and the emitted SQL is committed so deploys never
depend on the script having run.

**Why the assertions check properties, not row counts.** A seed that inserts 122
rows with null vectors passes a row count and breaks the entire feed. `005_seed`
checks every row for a non-null, correctly-sized vector, for caption and alt
text, for a real feed tab, and for the `cultured-original` provenance marker —
the last one because a licensed row appearing in this corpus would mean shipping
content without a clearance. It also measures the engine's central premise
against the seeded data: same-tag cosine 0.68 vs different-tag 0.31.

**Ordering.** The seed test runs *before* the RLS test (`005_` before `010_`)
because the RLS fixtures insert their own meme and track; running the seed checks
afterwards measured the fixtures too.

**Added.** `npm run db:seed` (regenerate) and `npm run test:db` (throwaway
database + all migrations + all SQL tests).

## 2026-10-06 — the Cold Open (onboarding scene 0)

**What.** `src/motion/timeline.ts` — an ~10.6s scripted intro that replaces the
static hero card that used to be onboarding step 0. Beats: grain and a
self-drawing ring; the ring becomes a vinyl whose grooves resolve into the
Fingerprint contours; the vinyl splits and each half carries an original
typographic meme card while "Match on your humor." / "Not your headshot." type
out word by word; the halves drift back together as coral and yellow sound
ribbons weave; a heart pulse and a slow 1→1.04 push-in; then the lockup and CTA.

**Decisions.**

1. **The reduce-motion gate has to live in JavaScript, not CSS.** The global
   `.calm` and `prefers-reduced-motion` rules in app.css work by forcing
   `animation-duration:.001ms`, which only affects CSS animations and
   transitions. Everything here is Web Animations API, which runs on the
   compositor and ignores those rules entirely — an `element.animate()` call
   keeps playing at full speed inside Calm Mode. `src/motion/reduce.ts` is now
   the single gate: when motion is off the timeline renders the *settled final
   frame* directly, with no rAF loop, no particles and no audio.
2. **`#onboard>*{position:relative}` beats `.co`.** The rule that lays out the
   ordinary onboarding steps outranks a bare class selector, and a
   relatively-positioned layer whose children are all absolute collapses to zero
   height — so the intro was present in the DOM and invisible. The appended
   block scopes the rule to `#onboard .co`. Caught by the Playwright test, not
   by typecheck or lint.
3. **No video file required.** The whole intro is DOM + one canvas (grain, 34-54
   motes, and the ribbons), 12.2 KB minified / 4.9 KB gzipped, measured with
   esbuild. `manifest.heroVideo.file` is honoured as a slot underneath the live
   text when the asset pipeline supplies one.
4. **Sound is opt-in and synthesised, not shipped.** A 55Hz filtered hum and a
   two-note chime built with Web Audio, gated on the new Settings → Sound
   toggle (default on, mirroring how Haptics behaves). Nothing is downloaded and
   there is no licence to clear. Haptics route through the seam's existing
   `haptic()`, so the setting cannot be bypassed.
5. **No population claims.** The intro promises what the product does and says
   nothing about how many people are on it. There is no counter, no "people near
   you", no implied user base.

**Added.** `src/motion/reduce.ts` (the gate, motion tokens, a visibility helper),
`src/motion/timeline.ts` (the intro), `tests/visual/playwright.config.ts` (a
config with no `webServer`, so it reuses the managed preview instead of
competing for port 4173), `tests/visual/cold-open.spec.ts` (4 tests: play/skip/
advance, 360x800 fit, reduced motion, Calm Mode).

**Baselines.** `tests/visual/updated/cold-open-{start,settled}-390x844.png`,
`cold-open-settled-360x800.png`, `cold-open-reduced-motion-390x844.png`.

## 2026-10-06 — the honesty pass

**What.** Removed the things in this build that were not true, and labelled the
rest.

1. **The feed ships originals, not scraped images.** `MM` was 13 hand-written
   cards plus 20 images collected from public web image search (see
   `public/memes/sources.json` — Bored Panda and friends, no licence). It is now
   the 13 plus the 122-card generated corpus, all tagged, all with alt text. The
   searched images survive behind `DEMO_MEMES` for local demos.
2. **Comments are gone.** Like, save and share only. `SEEDC` — comments
   attributed to people who do not exist — went with them.
3. **The invented number is gone.** "12 people around you loved the same 14
   seconds" and "Everyone is saving the bridge" are replaced by a true empty
   state that explains when local signal will switch on.
4. **Rooms are behind `FEATURE_ROOMS=false`.** Because they are off, every room
   affordance became the honest one: send the song to the match with a
   30-second clip. `LIVE` — fabricated room occupancy ("Kai, 6 listening") — is
   now unreachable rather than merely unused.
5. **`DEMO_DATA` is on in dev, off in production, and dev is labelled.** A
   visible banner says the people, posts and counts are invented. It appears
   after onboarding, not over the Cold Open: on top it also swallowed the
   tap-to-skip, because a z-index 70 banner sat above the overlay it labelled.
6. **`DEMO_MEMES` cannot be enabled in production.** Not by config, not by
   `window.CULTURED_CONFIG`.

**Two things measurement caught that reasoning did not.**

- **The flag did not actually remove the images.** `grep` on the production
  bundle found `meme-01.webp` still present: writing the guard as
  `!!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD)`
  defeats the bundler's constant folding. Using `import.meta.env.DEV` directly
  makes it fold, and the web-image strings are gone from `dist` (verified: 0
  references, 0 meme `.webp` files).
- **A flag cannot un-copy a file.** Vite copies `public/` verbatim, so all 20
  images landed in `dist/` even with the code path removed.
  `scripts/prune-demo-assets.mjs` now deletes them from the output after the
  build. It runs as part of `npm run build`.

**Added.** `DEMO_DATA`, `DEMO_MEMES`, `FEATURE_ROOMS` flags; the prototype
banner; `scripts/prune-demo-assets.mjs`; `tests/visual/honesty.spec.ts` (5
tests).

**Flagged off.** Rooms, UGC, demo memes in production, and the seeded people and
posts in production.

## 2026-10-06 — the intro video export

**What.** `scripts/export-intro-video.mjs` records the Cold Open with Playwright
and transcodes it to `public/assets/intro.mp4`: 10.600s, 540x960 (9:16), H.264
`yuv420p`, muted, `+faststart` (verified — `moov` at byte 36, before `mdat`),
84 KB against a 1 MB budget. A WebM and a poster frame come with it.
`marketing/intro-video-prompts.md` holds the four-shot prompt set for an
external video model.

Capture mode (`?introCapture=1`) renders the visual beats with no words in
frame, so the clip can sit under the live text overlay rather than baking the
copy into the pixels.

**Two real defects the export exposed, both fixed.**

1. **The splash was hiding the whole opening image.** `#splash` is z-index 90
   and `#onboard` is 50, so the ring drawing itself and the vinyl were playing
   under an opaque overlay — viewers joined at the split. `drawColdOpen` now
   waits for the splash to leave before starting the clock. This was live in the
   shipping path and no test had caught it.
2. **The clip double-rendered with the DOM beats.** Supplying `heroVideo` added
   footage but did not suppress the DOM ring, split, ribbons and heart, so both
   drew at once, slightly out of step. Keyframes targeting visual-only nodes are
   now dropped when a clip is playing, the canvas layer stays off, and under
   reduced motion the clip is paused to its poster instead of playing.

**The trim is computed, not detected.** A luma scan cannot find the start of the
intro: the splash and the intro are both dark, so the floor is identical on both
sides. The intro's length and the tail are known by construction, so the clip is
the last `TIMELINE_MS + TAIL_MS` of the take. Deterministic, and it cannot drift
— the earlier luma detector reported 0.00s on a take with 2.76s of boot in it.

**Enabled.** `manifest.heroVideo.file` now points at `/assets/intro.mp4`, so the
slot is live. `tests/visual/hero-video.spec.ts` skips itself when the manifest
leaves the slot empty, so it cannot pass against a configuration nobody runs.

### follow-up: the guardrail test caught my own comment

Gating the seeded `likesYou` behind `DEMO_DATA` means a production build can no
longer manufacture a mutual out of demo scaffolding. The first attempt at the
comment explaining it contained the phrase "liked you", which tripped
`guardrails.test.ts` — that suite scans `legacy.ts` for paywall copy, and it
cannot tell a comment from UI text. The test is the correct one here, so the
comment was reworded rather than the assertion relaxed.

## 2026-10-06 — onboarding rebuild, duel-link growth engine, and the honesty tails

**Prompt wins over the brief.** The build prompt overrides `cultured-agent-build-brief.md`
wherever they disagree; the cases that came up this phase, logged as instructed:

- Duel prompts are five fixed *choice* cards with no free-text anywhere — the
  brief's older framing allowed a caption box; the prompt's "5 choice prompts,
  NO free text (no UGC)" won. Nothing on the recipient side needs moderation
  because nothing can be typed.
- The watermark + "duel your friends" CTA is drawn **only** on cards that leave
  the app (`renderDuelCard(..., {external:true})` for save/share; the in-app
  sheet canvas never carries it). The brief had treated the card as always
  watermarked.
- The verdict computes when and only when *both* sides have submitted — the
  brief's flow let the creator see a score early. `duelStore.submitPicks`
  refuses partial submissions outright.

**The repo bridge was dead in production builds and nobody noticed** because
the mock adapter is also where "working" is measured. `main.ts` installs
`window.Cultured = {repo}` before `legacy.ts` evaluates; legacy then ran
`window.Cultured = {…helpers}` and silently wiped the repo. Every `repoCall()`
was a no-op in the built app. Fixed with an `Object.assign` merge, and
`tests/e2e` now exercises a cross-repo flow (the duel) so the bridge can never
quietly die again.

**Streaks.** The brief asks for a streak counter; the seam renders **no streak
UI at all**. Decision: keep `dropStreak` passive in the adapter (a counter that
only grows, surfaced nowhere as obligation) and ship no visible number, because
any visible streak is a loss frame the moment it resets. The guardrail test
bans the loss copy; the counter stays as data for a future, gentler surface.

**Honesty, finished.** The activity feed's invented rows are gone — production
shows the two demo rows only under `DEMO_DATA`, labelled by the prototype
banner. Crew/"who moved this" falls back to `Who's moved this · 0` plus a line
saying nobody was invented. Demo chat transcripts now also seed only under
`DEMO_DATA`; a real account opens People with an empty state ("cultured won't
write the first message for you"). The Matrix density gate is a stated policy
(dating opens at 25 people in this city, friends mode works from day one), with
a waitlist that stores a local intent — no queue counter, no claims.

**Two real bugs the new surfaces exposed.** (1) An unclosed
`@media (max-height:720px)` in the inherited `app.css` made *every rule after
it* — about 200 lines, including all of Phase-2 — conditional on a viewport
that tall phones never match. Pixels on a Pixel were silently missing. Closed.
(2) `micro.ts`' toast decorator was a MutationObserver watching the `class`
attribute whose callback *changed* the class attribute: every toast starved the
microtask queue (forced reflow ping-pong) for its entire 2.3s life, which is
what froze the duel submit path. The observer now keys on message identity and
returns when nothing changed. Lesson written into the file: never watch what
you touch without a guard.

**Onboarding wiring fixes** (found by scripted play-through, all real):
skipping the Cold Open ran the intro's `destroy()`, which unhooks
`#onboard.on`; the next scene painted *inside a closed panel*. `drawOb()` now
reopens the host. The final step's CTA was `ob-next` clamped by `Math.min(8,…)`
— onboarding literally could not finish; it now dispatches `ob-done`. The
adult switch didn't unlock its own Continue button. Seed audio ids needed the
`t_` prefix (`seedTrackId`) or calibration events would have written fake ids
into the repo. And `startViewTransition` is now serialized with `ready` /
`updateCallbackDone` handled — Chrome's "invalid state" abort used to surface
as an uncaught page error during fast step changes.

**Micro contract, tested not promised.** Playwright specs run the core
interactions (like, tab, switch) with `prefers-reduced-motion` on: state flips
land, zero `.fx-particle` nodes are created, Calm mode behaves identically,
and in normal motion a burst never exceeds ten particles and cleans itself up.

## Phase B — Arena games, Tomorrow plate, profile identity, logout

**Arena is a games shelf, not a manifesto.** The intro copy was three stacked
paragraphs doing the design's talking for it; it's now one sentence and the
game cards carry the tone. The duel card says "Same meme, different damage."
because that is the whole mechanic in four words. Chips lost their adjectives
("MEME DUEL · REAL LINK", "NEVER HAVE I EVER · 2 MIN") and the card grid moved
to an 86px art thumb so three games read as a shelf instead of three posters.

**Never Have I Ever is the taste-maker now.** Ten cards, each a real, specific,
slightly embarrassing cultural habit (14-second-outro replays, the unsent
playlist, the cab-driver's playlist) instead of generic party icebreakers.
Every one has an answer-independent hint line so the game keeps moving when
nobody is guilty. They redraw the humor map — and stay on the device, per the
no-UGC rule: the only outbound thing is the five-prompt duel link.

**Tomorrow finally has its background.** The layer existed but `--media-url`
was never set anywhere — a permanently empty div. It now always paints a
procedural dusk plate (`posterSVG`, seed-palmed from tonight's hint, zero
network bytes) and the manifest bitmap, when present, rides on top at
soft-light. A 2KB generated webp gets to texture the scene, not replace it.

**Profile identity lives in two knobs, both device-local.** A profile photo is
picked through a file input, downscaled to 240px JPEG on a canvas, and stored
as a data URL under the existing state key — nothing uploads, removal is one
tap. The tint picker borrows five palettes that already exist in TRACKS (no
new colors, per the token rule) and recolors the hero wash, the Fingerprint
bleed, and the fallback orb. Name and bio stay inline-editable where they
already were; a duplicate "edit profile" sheet would be a third way to do one
thing.

**Logout is honest or it's theatre.** This prototype has no session to end. The
row sits above delete-account (logout first, destruction second), and the sheet
says exactly what happens: back to the welcome screen, nothing deleted, nothing
uploaded, same profile on sign-back-in. The repo layer gains `logout()` — a
resolved no-op offline, a real `auth.signOut()` on the Supabase adapter — so
when the backend arrives the UI doesn't change. The emoji/tofu caveat above
applies to all Phase B screenshots; card glyphs are emoji by design.

## Phase B2 — the page, not the card

Follow-up pass on the same four surfaces after a live look at the prototype.

**Tomorrow's background is now the page.** The first cut put the dusk plate
inside `.tm-art`, which still wore the bitmap treatment (opacity .42,
brightness .62, scrim) designed for a photo, so the art read as dead black.
The plate moved out to a page-level layer (bleeding under the date row, slow
drift, fades to ink), the card became frosted glass, and `.drow` got a stacking
fix — an absolutely-positioned later sibling was painting over the date.
Lesson recorded: a "background image" that lives inside a card is a card
decoration, not a background.

**The games' questions are the product.** The duel's five prompts were
generic-A/B; they are now jokes with two honest answers each ("The song
everyone mocks. You still… replay it in the dark / skip it twice a day,
ritualistically"), tags remapped to the real taxonomy so calibration signals
stay valid. The icebreaker spun from a pool of four safe questions; the wheel
now carries eleven openers with a point of view, seeded on the shared song
first so a spin still feels like it knows you.

**Profile gets a third knob and it pulls the other two together.**
"Look and feel" gained On the wall (Rings / Poster / Quiet) — the hero art is a
procedural bloom in the chosen tint or nothing at all — and the tint now
threads through stats borders via a `--acc` var on the page, so picking a mood
visibly changes the whole profile, not one gradient. The CTA chevron in the
arena cards no longer wraps to its own line (`.cta` is display:block; flex was
declared where it needed to be).

**Sandbox note.** The environment blocks Playwright's browser CDN, so the
suites run against a locally extracted Chromium when `CULTURED_CHROME` is set
(both configs read it). Emoji render as tofu under that headless shell because
the image has no color-emoji font — a testbed limitation, not a product one;
screenshots taken with it should be read accordingly.

## Fix — the sixth dot could not be passed

**The sound-calibration step dead-ended and nothing on screen said so.** Its clip
list is the one onboarding scene whose content renders outside `.ob-body` (the
meme deck's sibling), so its height was never bounded: at 390px the four
`.ob-wave` rows came to ~1470px, the grid items stretched to their content, the
question above them was squeezed into a 26px scroll window, and the pinned
footer — Continue included — landed at y=968 in an 844px viewport. `#onboard`
was `overflow:hidden` and the step had no scrollable region wide enough to help,
so no gesture reached the button. The funnel stopped on dot six of nine, with
nothing visibly broken to explain why.

**The scene now has an anatomy with a scroll region.** The question keeps its
natural height, the clip list becomes the flexible child
(`flex:1 1 auto;min-height:0`) and scrolls inside itself, and the footer stays
where it is — the same shape the other steps get from `.ob-body`. The rail drops
118px → 100px, which is what lets each row read as two lines instead of eight;
the preview status is clamped to two lines so a longer PreviewProvider string
can never re-inflate the list. `#onboard` also gains `overflow-y:auto` as a
backstop — a step taller than the panel should be scrollable rather than fatal —
but no step needs it: `scrollHeight` equals `clientHeight` on all nine.

**The guard is an e2e contract, not a screenshot.** A capture of the broken step
looks plausible with the CTA 180px below the fold. `tests/e2e/onboarding-flow.spec.ts`
walks the whole funnel with real taps at 390x844 and 360x800 and asserts, per
step, that the forward control is inside the viewport and is the topmost element
at its own centre, plus that the clip list scrolls without moving the footer.
Reverting the CSS fails it on exactly the sound step, at both viewports. The
sandbox's font caveat from Phase B2 applies to any screenshot of this step.
