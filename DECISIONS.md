
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
