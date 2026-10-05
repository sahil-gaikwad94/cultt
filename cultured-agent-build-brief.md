# CULTURED — Agent Build Brief
**Goal:** turn the current v3 front-end prototype into a real, store-ready app, without changing how it looks or behaves today.
**Date written:** 5 Oct 2026

---

## 0. How to use this brief

You have three inputs:

| Input | What it is | Authority over |
|---|---|---|
| `cultured v3.html` (in the repo) | The working prototype: all screens, theme, copy, interactions | **Look, feel, copy, UX.** If this brief and v3 disagree on UI, v3 wins. |
| `Cultured — Architecture v4.0` (PDF) | Backend, data model, matching algorithm, safety, roadmap | **Backend, schema, algorithm, phases.** Follow it, except where Section 2 below corrects it. |
| `cultured___image___video_prompts.html` | Old prompt ideas for images and videos | **Mood only.** The owner is NOT generating videos and is NOT generating images by hand. You handle visuals (Section 5). |

Think of it like this: v3 is the **face**, v4 is the **body**, this brief is the **plan to connect them**.

**Work style:**
- Work in small steps. Commit after each one. Keep the app runnable at every commit.
- When something is unclear, make the most reasonable choice, write it down in `DECISIONS.md`, and keep going. Only stop and ask for things only the owner can do (Section 8).
- Never claim something works without running it. Run the app, run the tests, look at screenshots.

---

## 1. Non-negotiables

These protect what already works.

**1.1 The theme stays exactly as is.**
- Use the existing CSS variables only. Brand tokens (verify against v3, v3 wins):
  - **v3 is dark-only** (`color-scheme: dark`). Real token names: `--ink #0A0A09`, `--coal #121211`, `--ash #1b1b19`, `--ash2 #262522`, `--line rgba(255,255,255,.11)`, `--stone #8e8b83`, `--mist #b9b5aa`, `--bone #EFE9DA`, `--paper #FBF7EC`, `--heart #ff5d7a`, `--sun #ffd166`, `--ok #9be8bf`, `--bad #ff7a7a`, `--glass`. Font: Bricolage Grotesque. Do NOT add a light theme unless the owner asks; ignore "both themes" rules below.
- No new colors, no new fonts, no new border radii, no new spacing scale.
- Both light and dark themes must keep working on every screen, including new ones.
- Respect `prefers-reduced-motion`, safe-area insets, and `viewport-fit=cover` as v3 does.

**1.2 Functionality parity.** Every interaction in v3 must still work after the rewrite: onboarding, Culture Feed, Daily Drop, Match Matrix, Resonate, chat, listening sessions (15-minute cap), Circles, Fingerprint edit mode, settings. Same behavior, now backed by real data.

**1.3 The "deliberate non-features" are binding** (PDF section 1.3). Turn them into tests so they cannot regress:
- No swipe-to-judge gesture anywhere in the Culture Feed.
- No "who liked you" paywall. Incoming likes are only revealed on a mutual match.
- No guilt-trip notifications ("3 people are waiting!").
- No grid of faces. The Match Matrix is a calm, single-card deck.

**1.4 Visuals never carry the UI.** Images and animation are *scenery behind* the interface. Buttons, text, cards and inputs stay real HTML. No text is baked into any image or animation (Section 5.1).

**1.5 Safety gates are real.** 18+ is enforced on the server. Under-18 signup is hard-blocked. Report, block and account deletion work end to end. Do not ship UGC (user-posted memes) without moderation in place.

---

## 2. Corrections to the architecture PDF (checked October 2026)

The PDF is mostly right. These parts will break at launch. Apply the fix and note it in `DECISIONS.md`. Re-check each against the provider's current docs before building on it.

**2.1 Spotify login cannot be the main music import.**
The PDF says the Spotify extended-quota requirement (250k MAU) is "irrelevant at launch." It is the opposite. As of Spotify's current docs, Development Mode apps need a Premium developer account and are limited to a small allowlist (5 users), and Extended Quota is for registered businesses with ~250k monthly users. A public app cannot rely on it.
**Fix:** build music import as an adapter (`MusicImportProvider`) with these providers, in this order:
1. **Manual** (artist/genre chips plus the 10 audio calibration swipes). This is the default for everyone.
2. **Last.fm username** import (public scrobble data, free). Users type their username; no OAuth quota problem.
3. **Apple Music (MusicKit)**. Needs the Apple Developer account the owner must buy anyway.
4. **Spotify**, behind a feature flag, for the few allowlisted alpha testers only.
Everything downstream (vectors, Taste Twins) must only see a normalized `{artists, genres, tracks}` object, never provider-specific data.

**2.2 Song previews.**
Spotify's `preview_url` was removed for new apps in 2024, so "15-sec preview" and "10 × 7-second clips" may return nothing. **Fix:** a `PreviewProvider` that resolves a 30-second preview by artist + title from a free no-auth source (iTunes Search API first, Deezer API as backup). Cache results in `tracks.preview_url`. Cut clips to 7 or 15 seconds in the player. Check each provider's terms for attribution rules and show the attribution.

**2.3 Perspective API is shutting down (31 Dec 2026).**
Do not build moderation on it. **Fix:** `moderateText()` adapter. Start with a blocklist plus rate limits plus the report flow, and plug in a replacement classifier (Sightengine text moderation or a small open toxicity model on the Hugging Face free tier) behind the same function. Image moderation (Sightengine) stays as in the PDF.

**2.4 Phone OTP is not free.**
Supabase phone login needs an SMS provider (Twilio, etc.). **Fix:** Sign in with Apple + Google + **email OTP/magic link** are the default. Phone OTP is built but behind a flag, off until the owner connects an SMS provider. The 18+ date-of-birth step still runs for everyone.

**2.5 Liveness check is best-effort.**
ML Kit gives on-device face detection, not strong anti-spoofing, and a result computed on the client can be faked. **Fix:** build it as in the PDF, but (a) call the badge **"photo checked"** in the UI copy, not "verified identity", (b) send low-confidence cases to the human review queue, (c) keep the vendor swap point (`verifyLiveness()`) clean for a paid provider later.

**2.6 Keep vector math out of Edge Functions where possible.**
The PDF calls an Edge Function on every reaction. With a 500k/month invocation cap, that gets used up fast. **Fix:** do the incremental vector update in a Postgres function (`rpc/react` as plpgsql with pgvector) in the same transaction as the `events` insert. Keep the API contract from PDF section 7 identical. Use Edge Functions only for things that need outside APIs (Last.fm, push, Taste Card render, moderation).

**2.7 "$0" still has three small costs.** Apple Developer Program (about $99/year), Google Play (one-time fee), and a domain. Also, free Supabase projects can pause after a period of inactivity and have no backups, so plan the Pro tier before public launch. Verify current numbers on the pricing pages.

---

## 3. Step 0 — Audit and freeze the look (do this before any refactor)

1. **Write `AUDIT.md`**: list every screen and overlay in v3, every piece of state and every `localStorage` key, every hard-coded string and fake data array, every CSS variable, every animation, every external dependency.
2. **Map v3 to the schema** using PDF Appendix A. Mark each fake-data array with the table or RPC that replaces it.
3. **Build the visual baseline**: set up Playwright. For each screen, capture screenshots at 390×844 (and 360×800) in dark and light theme. Save as `tests/visual/baseline/`. After every later step, re-run and diff. Any unexpected pixel change in an existing screen is a bug.
4. **Don't redesign.** If you spot something ugly in v3, add it to `IDEAS.md`. Do not fix it unasked.

---

## 4. Build plan (follows PDF section 12, with agent-level detail)

Gates are go/no-go checks, not dates. Finish and verify each phase before the next.

### Phase 0 — Foundation
1. **Repo and tooling:** Vite + TypeScript, ESLint, Prettier, Vitest (unit), Playwright (visual + flows), GitHub Actions (typecheck, lint, test, build). Keep it vanilla/TS if v3 is vanilla. Do not introduce a UI framework just to modularize.
2. **Modularize v3** into `src/screens/*`, `src/components/*`, `src/styles/tokens.css`, `src/data/*`, `src/lib/*`. Pure refactor: visual baseline must still pass at 0 diff.
3. **Data layer behind an interface:** `src/data/repo.ts` with two adapters, `mock` (the current fake data, used for tests and offline dev) and `supabase`. Screens only talk to the interface. This lets you swap screen by screen.
4. **Supabase project:** split PDF section 5 into ordered migration files. Enable RLS on every table. Add `pgvector`. Write RLS tests (a user can never read another user's rows, likes, raw vectors or events). Add seed data.
5. **Auth:** Apple, Google, email OTP (phone behind flag). DOB 18+ enforced by CHECK constraint **and** trigger **and** server re-check on profile edit.
6. **Events + vectors:** `events` table, `rpc/react`, taxonomy of 30 humor categories × 4 style axes, vector update rules from PDF section 6.2. Weights live in `system_config`, not code.
7. **Resonance Engine (section 6 of PDF):** implement Taste Twins as a pure, unit-tested function plus the SQL candidate query. Test with fixtures: two clearly similar users must outscore two clearly different users; anti-genres must lower the score; new users (low confidence) must be damped.
8. **Onboarding wired** to `rpc/onboarding_complete`: calibration swipes become real events.
9. **Candidates v1:** hard filters + cosine ranking, cached 15 minutes.
10. **Plumbing:** Capacitor project (iOS + Android) that opens the built app; FCM push token registration; PostHog events from PDF section 7.4; Sentry.

**Done when:** 20 test accounts complete onboarding; their vectors visibly differ; visual baseline passes; RLS tests pass; crash-free in a manual run on a real Android device and an iOS simulator.

### Phase 1 — Core loop
1. Match Matrix + `rpc/decide` + mutual match + realtime chat (RLS: thread participants only).
2. Meme pipeline (Section 6 below) + moderation queue + simple internal moderation page.
3. Daily Drop table + 9:00 AM local push (cron per timezone shard) + streak counter.
4. Taste Twins badge + shared-artist/meme chips on cards.
5. Report / vibe-report / block as three **separate** flows.
6. Liveness flow (Section 2.5 caveats) gating Matrix visibility.
7. Legal pages: Privacy Policy, Terms, Community Guidelines (draft text, marked "needs lawyer review"), in-app account delete (14-day cooling-off) and data export.

**Done when:** two real phones can sign up, match, and chat in realtime; blocked users vanish from each other's decks; a deleted account is fully purged (rows, storage files, push tokens).

### Phase 2 — Signature experiences
Listening Sessions (host-authoritative sync, 15-min free cap via entitlements), Our Soundtrack, Meme Duel, Taste Card (Edge Function SVG to PNG, with live data), Icebreaker Roulette, Circles + remix, concert radar, music trivia.

**Done when:** a listening session stays within about 300 ms drift between two phones on normal Wi-Fi; Taste Card renders for any user in under 2 seconds.

### Phase 3 — Launch and monetize
Store builds and submission checklists (PDF section 9), premium + IAP (StoreKit / Play Billing, via a Capacitor plugin), Apple Music provider, Last.fm enrichment queue at full throughput, analytics dashboards for the gates.

---

## 5. Visual direction

### 5.1 The one idea to hold on to

> **The UI is the stage. Art is the set behind it.**

The app's identity is already in the typography, cards and the coral/yellow-on-ink palette. Art should make screens feel *warm and alive*, never busier. If a screen looks worse or harder to read with the art on, the art loses.

Rules that apply to every asset:
1. **No text inside images or animations.** Lines like "you two resonate." or "culture first. chemistry always." are rendered as live text in the app's own font, so they can be translated, themed, and use real names.
2. **No real faces, no real brands or logos, no recognizable copyrighted memes.** Memes in art are abstract and unreadable.
3. **Always put art under a scrim.** Every background layer gets a gradient fade into `var(--bg)` so text keeps contrast of at least 4.5:1. Check it, don't guess.
4. **Art layers are decoration:** `aria-hidden="true"`, `pointer-events: none`, `z-index` below all content.
5. **Both themes.** Dark-ink art must not slam onto the cream light theme. Either draw the art with theme variables (preferred) or tint/reduce opacity per theme.
6. **Same palette only:** ink, bone, coral, yellow. Soft film grain (a tiny tiled noise, 3–5% opacity) is allowed as a global overlay.
7. **Calm by default.** Motion is slow, small, and stops when the tab is hidden, the user prefers reduced motion, or battery saver is on.

### 5.2 Where visuals come from (use this ladder, top to bottom)

The owner will not generate assets by hand. You make them.

1. **Draw it in code (default).** SVG, CSS gradients, CSS/Web Animations, and `<canvas>` produce almost everything needed, they are tiny, they scale, and they follow the theme variables. This is the first choice for every slot in 5.3.
2. **Use an image generator only if your environment has one**, and only for slots marked "photo-like" in 5.3 where code looks flat. Use the prompts in Appendix B (with the brand style line, with quoted text removed). Generate 3–4 variants, pick one, compress to WebP/AVIF.
3. **Leave a slot ready.** Every art slot reads from `assets/manifest.json`. If a real file exists for the slot, use it; otherwise use the code-drawn version. That way the owner can drop in a better image later with zero code changes.

Never download images from the internet and use them. Never scrape memes.

### 5.3 Asset slots (what to make, where it goes, what it must not do)

| # | Slot | Where it appears | Make it with | Notes / guardrails |
|---|---|---|---|---|
| 1 | **App icon + splash** | Home screen, store listings | Hand-written SVG master: lowercase "c" as a sound-wave ring with a small heart-shaped gap, cream on a coral→yellow gradient | Must read clearly at 60 px. Export 1024 PNG, Android adaptive icon (separate foreground/background), iOS icon set, splash. Use `@capacitor/assets` to generate sizes. No text. |
| 2 | **Welcome hero** (3 intro slides) | Onboarding step 1 | Layered SVG: a vinyl record split in two halves, each half carrying a meme card, a coral heart where they meet; small orbiting objects (see #3) | Live headline text on top: "Match on your humor, not your headshot." Hero takes the top ~55% of the slide only. |
| 3 | **Sticker set (8)** | Onboarding steps, empty states, chips, Daily Drop card, streak badge | 8 SVG stickers with a thin white outline: vinyl, laughing face, cassette, headphones, heart-with-play, speech-bubble-with-note, bookmark, sparkle | Flat-to-soft-3D look via gradients and one highlight. Each under 3 KB. Reuse everywhere instead of making new art. |
| 4 | **Culture Feed ambience** ("night bus window") | Behind the top of the Feed / Home only | CSS: a few blurred coral and yellow radial-gradient "bokeh" blobs drifting slowly, plus a light canvas rain-streak layer | Max 40% of screen height, fades to `--bg`. Feed cards stay fully opaque. This replaces the old "bus window" video. Photo-like option: generate the still (Appendix B #4). |
| 5 | **Match Matrix background** ("resonance ribbons") | Behind the single-card deck | SVG: two translucent sound-wave ribbons (coral, yellow) drifting toward each other and merging into a fingerprint pattern in the center | Very low opacity (10–18%). Stays calm. The card is the hero; the ribbons only frame it. Also used in the empty state. |
| 6 | **Fingerprint (profile) header** | Top of Fingerprint tab | Code-drawn warm gradient + silhouettes of records, speaker, string lights (SVG) | Photo-like option: bedroom-shelf still (Appendix B #6), no readable posters. Header area only. Must not compete with the user's own photos, which stay equal-weight with the Fingerprint. |
| 7 | **Mutual-match moment** | Full-screen overlay when two people match | Two glossy meme cards tilt and touch at a corner → canvas confetti in coral/yellow, tiny hearts and music notes → SVG rings rippling out into a fingerprint | Live text "you two resonate." with real names. About 2 seconds, tap to skip. Pairs with a haptic and a synthesized chime (5.5). Replaces the old "match moment" video. |
| 8 | **Taste Card template** | Share sheet, generated by the server | Not a prompt-made image. Build an SVG template (cream card on ink, fingerprint of sound waves, 3 meme tiles, 3 artist squares, title "my cultural fingerprint") filled with the user's **real data** by the Edge Function | Watermark + "find who else relates" CTA. Design it at 1080×1920 (Stories) and 1080×1080. |
| 9 | **Empty / loading / error states** | Everywhere | Reuse stickers (#3) with short live copy, plus skeleton loaders in `--card` | v3's Match Matrix empty-state copy ("come back to the Culture Feed…") stays. |
| 10 | **Meme cards (seed corpus)** | Feed, Drop, duels | See Section 6 | Original, typographic, legally safe. |
| 11 | **Small icons** | Verified badge (small check, not a banner), streak flame, Resonate, rewind | Existing v3 icon style | Match stroke weight and size of v3 icons exactly. |

**Not in the app build:** the old "two phones" social ad and launch teaser are marketing assets. Put the prompts in `/marketing/` and skip them. Do not block the build on them.

### 5.4 Motion: the video replacement

The owner dropped video. Motion now comes from code, which is smaller, loops perfectly, follows the theme, and costs nothing to host.

| Old video idea | New code-driven version | Budget |
|---|---|---|
| Landing hero loop (vinyl spins, splits into two meme cards, merges into a coral heart, emoji orbit) | SVG + Web Animations API. Slow ~8 s loop: vinyl rotates, halves separate, cards flip, heart pulses on reunion, stickers orbit on a few lazy paths. Slow camera "push-in" = a gentle scale from 1.00 to 1.04. | No video file. Under 30 KB. 60 fps on a mid-range Android. |
| Onboarding / home ambience (rainy bus window, bokeh, glowing phone) | CSS blurred gradient blobs + sparse canvas rain streaks (cap at ~40 streaks, `devicePixelRatio` max 2). Extremely slow drift. | Pause when hidden or reduced-motion. |
| Match moment (cards touch, confetti, ripples, fingerprint) | Canvas confetti (about 80 particles, 1.8 s) + SVG rings expanding and fading + cards animated with CSS transforms | One-shot, then removes itself from the DOM. |
| Launch teaser | Skip. | n/a |

Rules for all motion:
- `@media (prefers-reduced-motion: reduce)` → show a single static frame (the final composition), no loops.
- Pause when `document.hidden`, when the screen is not in view (`IntersectionObserver`), and when the OS reports low-power mode where detectable.
- Never animate layout properties (`top`, `left`, `width`). Use `transform` and `opacity` only.
- One ambient animation per screen at a time.

**Optional video slot (do not require it):** if the owner later supplies `hero-loop.webm/mp4`, the Welcome hero can switch to a muted, autoplay, `playsinline`, looping `<video>` with the static frame as `poster`, controlled by `manifest.json`. Build the slot, but ship without a video.

### 5.5 Sound and haptics
- No audio files in the bundle by default. Generate the match chime and the soft Daily Drop sound with the Web Audio API (a short two-note sine/triangle blip with a quick fade).
- Sound is off when the phone is on silent, and there is a settings toggle. Ambient/background audio: none.
- Haptics through Capacitor: light tap on like/react, success pattern on mutual match, subtle tick on the Daily Drop streak.

### 5.6 Performance and accessibility budgets
- Any raster image: WebP/AVIF, max 1080 px wide, under 150 KB, lazy-loaded, with a dominant-color placeholder.
- Total art per screen: under 300 KB. First paint must not wait on art.
- Lighthouse mobile performance 85+ on the main screens.
- Contrast 4.5:1 for all text over art, in both themes (test with real screenshots).
- All meaningful images have alt text; decorative art is `aria-hidden`.
- Memes: every meme card has a text alt (caption + short description).

### 5.7 The slot pattern (so art is swappable)

```json
// assets/manifest.json
{
  "heroImage":   { "file": null, "fallback": "procedural:hero" },
  "feedAmbience":{ "file": null, "fallback": "procedural:bokeh-rain" },
  "matrixBg":    { "file": null, "fallback": "procedural:ribbons" },
  "profileHeader":{ "file": null, "fallback": "procedural:shelf" },
  "matchMoment": { "file": null, "fallback": "procedural:confetti-rings" },
  "heroVideo":   { "file": null, "fallback": null }
}
```

A small `<ArtSlot name="feedAmbience">` helper reads the manifest: if `file` exists, render the image (with scrim); if not, render the procedural version. Add an `assets/README.md` telling the owner what size, format and aspect ratio each slot expects.

---

## 6. Meme content and the legal side

The meme feed is the product's heartbeat and its biggest legal risk. Do this carefully.

1. **Never scrape or copy memes.** No downloaded images, no screenshots from social apps.
2. **Seed corpus:** write a generator script that makes about 120 **original** meme-style cards across the 30 taxonomy categories: bold typographic cards, absurd/deadpan/wholesome captions, on abstract SVG backgrounds in brand colors. Tag each card with category, humor-style axes and format features, set `source = 'pack'`, `status = 'live'`. These tags are what the matching engine learns from, so make the captions genuinely varied and funny, not filler.
3. **UGC (user-posted memes)** stays switched off until: image moderation runs on upload, the report button exists on every UGC surface, the DMCA takedown endpoint and repeat-infringer policy exist, and the owner has registered a DMCA agent (Section 8). Build all of it, hide it behind a flag.
4. **External shares** (to Instagram/WhatsApp) add the small Cultured watermark + CTA. In-app, never.
5. **Music:** store only metadata and preview links. Never host or re-stream audio.

---

## 7. Testing and "done" checklist

**Automated (run in CI on every push):**
- Typecheck, lint, unit tests (Taste Twins, vector updates, age check, entitlement cap).
- RLS tests: no cross-user reads; incoming likes hidden until mutual; events not readable; raw vectors never exposed.
- Visual regression: all baseline screens, dark and light, 0 unexpected diff (art-slot areas allowed to differ only in the commits that add them).
- Flow tests (Playwright): onboarding → feed → react → match → chat → report → block → delete account.
- "Non-feature" tests from Section 1.3.

**Manual before each phase gate:**
- Real Android device + iOS simulator pass. Airplane-mode and slow-network behavior is graceful.
- Both themes, reduced-motion on, and large font sizes.
- Delete account, then confirm data is gone.

**Never done until:** the app builds with Capacitor for both platforms and a TestFlight/Play internal-testing build installs and runs.

---

## 8. Things only the owner can do (ask once, early, in a single list)

- Create Apple Developer and Google Play accounts.
- Create Supabase, Firebase (for push), PostHog, Sentry, Sightengine and Last.fm accounts and hand over keys through environment variables (never commit keys).
- Register a DMCA agent with the U.S. Copyright Office before UGC goes live.
- Choose and connect an SMS provider if phone OTP is wanted.
- Get the Privacy Policy, Terms and Community Guidelines reviewed by a lawyer.
- Pick launch cities and a final app name/domain ("Cultured" is the working title; check trademark availability).

Until these arrive, build against the `mock` adapter and local Supabase so work does not stall.

---

## Appendix A — Brand style line (for any image generation)

> Near-black warm ink background (#0A0A09), cream/bone highlights (#EFE9DA), coral-pink (#ff5d7a) and sunny yellow (#ffd166) accents, soft film grain, premium editorial feel, playful Gen-Z internet culture, no real people's faces, no real brands or logos.

## Appendix B — Image prompts (only if your environment can generate images)

Append the brand style line to each. **Remove any quoted text** from the prompt and render it as live text in the app instead.

1. **Hero (9:16):** A giant glossy vinyl record floats in the center, split in two halves that each carry a different colorful meme card, a coral heart glowing where the halves meet. Tiny 3D laugh emoji, cassette tape, headphones, bookmark and sparkle orbit it in soft clay-3D style with gentle rim light. Dramatic dark studio, volumetric glow, shallow depth of field.
2. **App icon (1:1):** Bold lowercase "c" shaped like a sound-wave ring with a small heart-shaped gap, cream on a coral-to-yellow gradient, subtle grain, very simple, readable at 60 px. (Prefer the hand-drawn SVG version from slot #1.)
3. **Sticker sheet:** 8 glossy 3D objects with thin white sticker outlines: vinyl, laughing face, cassette, headphones, heart with play button, speech bubble with music note, bookmark, sparkle. Soft clay-3D, coral/yellow/cream, evenly spaced. (Prefer the SVG set from slot #3.)
4. **Feed ambience (9:16):** View from inside a night bus: rainy window with coral and warm-yellow neon reflections, blurred city bokeh, earbuds on the seat, a phone glowing with an unreadable blurred meme. Moody lo-fi film look, no people, large dark empty area at the top for UI.
5. **Matrix background (9:16):** Two flowing sound-wave ribbons, one coral and one yellow, drifting toward each other and intertwining into a fingerprint pattern at the center. Dark ink, glass-like translucent ribbons, fine particles, soft bloom, lots of calm negative space.
6. **Profile header (9:16):** Warm dim bedroom corner at golden hour: wall of abstract meme posters (unreadable), vinyl records leaning on a shelf, small speaker, string lights, amber lamp. No people. Film grain, soft focus, empty space at top.
7. **Match moment (1:1):** Two floating meme cards, one tilted left and one tilted right, touching at a corner and releasing coral and yellow confetti, tiny hearts and music notes. Glossy 3D paper cards, dark background, dramatic backlight.
8. **Taste Card (9:16, design reference only):** Poster-style cream card on dark ink: glowing sound-wave fingerprint at top, three small meme tiles, three album-style squares, magazine-grade grid, coral and yellow highlights. Build the real one as an SVG template with live data.
9. **Marketing (skip in app build):** Two phones facing each other with a meme flying between them as a trail of coral light. Save under `/marketing/`.

Tip for generation: make 3–4 variants per prompt, keep them in one session for consistent style, then compress and wire them in through `manifest.json`.

---

## 9. v3 audit findings (read before Step 0 — these override assumptions above)

I opened `cultured_v3.html` (161 KB, one IIFE, no framework). Facts:

- **Structure:** screens `#s-feed`, `#s-match`, `#s-people`, `#s-you`; overlays `#onboard`, `#overlay`, `#splash`. Clicks are delegated through `data-act` → `ACT[...]` handlers. Render functions: `renderFeed`, `renderMatchShell`/`renderDeck`, `renderPeople`/`renderMsgs`, `renderYou`, `showMutual`.
- **State:** one object `S`, saved by `store` under `localStorage` keys prefixed `cultured2:`. Fake data lives in constants `TRACKS`, `MEMES`, `PEOPLE`, `TASTES`, and the daily-drop object `DK`. These are exactly what the `repo` adapter (Phase 0, step 3) replaces.
- **Art is already procedural.** v3 draws its own posters (`poster()`), fingerprints (`fpSVG`, `pairFP`), sticker set (`STK`), palettes (`palFrom`), film grain (`grainInit`), blurred ambience (`.tint`), splash, haptics, and a calm mode (`applyCalm`). Reduced-motion is handled globally. **So Section 5 changes:** do not redraw this art. Reuse these generators for (a) the server-side Taste Card, (b) the ~120-card seed meme corpus (`rng`/`hash` give deterministic output), and (c) empty states. Only three things are truly missing: app icon + store splash, the Taste Card template, and the optional `ArtSlot` manifest override for `.tint`.
- **Onboarding is 3 steps** (18+ switch, intent, starting tastes). The v4 funnel (PDF 2.1) has 9. Add steps using the same `.step / .ob-body / .opt / .cta` markup and generalize the progress dots (`[0,1,2]` is hard-coded). Order: welcome → auth + DOB → photo check → music (manual / Last.fm / Apple Music; Spotify behind flag) → meme calibration → audio calibration → photos + prompts → basics → permissions. The 18+ switch becomes a real server-checked date of birth.
- **Fonts:** Google Fonts is loaded by link. Self-host Bricolage Grotesque for Capacitor/offline use.
- **Seam added (`cultured_v4_seam.html`):** v3 plus `window.Cultured = {config, track, store}`, feature flags (Spotify, phone OTP, UGC off; Last.fm on), and `track()` calls (`app_open`, `match_created`) that forward to PostHog if present. No visual or behavior change. Add more `track()` calls at each PDF 7.4 event as you wire screens.
