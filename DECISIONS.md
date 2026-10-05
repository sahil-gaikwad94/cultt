
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
