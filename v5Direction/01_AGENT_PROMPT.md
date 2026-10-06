# cultured v5 — build brief for the coding agent

You are the lead engineer and motion designer on **cultured**, a mobile-first web app (PWA, Vite + TypeScript, deployed on Vercel) that is a dating app built on memes and music: "less beauty contest, more vibes." Your job is to ship **v5**: a state-of-the-art UI/UX and look-and-feel overhaul plus a set of new features. Quality bar: it should feel like it was designed by an expensive studio and run at 60 fps on a mid-range Android phone.

`v5-content/` in the repo root has content you must use: `nhie_questions.json`, `songs_seed.csv`, `copy_deck.md`. Read all three before you design anything. `02_PRODUCT_BRIEF.md` (if present) explains the reasoning.

---

## 0. Rules of engagement

1. **Read the repo first.** Do not assume the framework, state library, backend or folder layout. Find: framework, router, state/storage, backend (Supabase/Firebase/custom/none), `/api` functions, where local memes live, existing tokens (colors, fonts, spacing), the Fingerprint generator, onboarding calibration data format, duel/NHIE logic. Open the app in a mobile-emulated Chromium via Playwright and use it before changing anything.
2. **Post a plan (max 300 words), then proceed without waiting.** Record every non-trivial judgment call in `docs/v5/DECISIONS.md` (decision, alternatives, why). If something is ambiguous, pick the sensible default and keep going. Ask me only if you are truly blocked.
3. **Work in phases, commit per phase** (conventional commits), keep `main` deployable behind feature flags. After each phase update `docs/v5/STATUS.md` (what shipped, screenshots in `docs/v5/screens/`, known issues, perf numbers).
4. **Finish earlier phases fully before starting later ones.** Quality over quantity: never leave a half-built screen visible. If scope runs long, ship Phases 0–2 perfectly and flag-gate the rest.
5. **Preserve what works.** Keep the brand voice, the contour Fingerprint, locked-reveal duels, fixed-choice (no free-text) game design, honest empty states, the 18+ server-side age check, and the photo-privacy behavior. Migrate existing stored data with a versioned migration; never wipe user data.
6. **No fake users or fake stats in production.** Seeded demo personas are allowed only behind `?demo=1` / a `DEMO` flag, clearly separated, never shipped on by default.
7. **No new heavy dependencies without justification.** Prefer platform features. Allowed and recommended: `motion` (MIT, springs + WAAPI; use its React bindings only if the app is React), `@lottiefiles/dotlottie-web` (or `lottie-web` light/canvas build) for emoji, `idb` or Dexie for IndexedDB, `workbox` for PWA caching, `@vercel/og`/`satori` for share images, `playwright` for tests. Avoid Three.js; write the one WebGL shader by hand (or with `ogl`). Record any other dependency in DECISIONS.md with its bundle cost.
8. **Commit the content pipeline scripts and generated manifests** so a fresh clone builds with one command.

## 1. CHOICES (edit these before sending; defaults shown)

```
HOME_YESTERDAY_SUBPAGE = Y1   # Y1 Receipts | Y2 The Verdict
HOME_TOMORROW_SUBPAGE  = T1   # T1 The Draft | T2 Forecast
LAUGHS_PER_DAY         = 15   # likes on memes/songs; resets at local midnight; remote-configurable
RESONATES_PER_DAY      = 15   # likes on people/pins in Matrix; separate counter; remote-configurable
DEFER_AUTH_TO_AFTER_REVEAL = true  # only if the backend/age-check allows an anonymous local session that upgrades on sign-in; else keep auth first but redesign it
STORY_TTL_HOURS        = 12
```

Implement all four sub-page specs in §8 behind flags so I can flip choices later; ship only the two chosen ones enabled.

## 2. Product context

- **Fingerprint:** a contour-line shape plus six humor axes: `deadpan, absurdist, dry_wit, chaotic, wholesome, niche_refs`. Built from meme reactions, music taste and play. Shown as a generative isoline shape. Share/Matrix compatibility derives from it.
- **Tabs:** Home, Arena, Matrix, People (chats), You. Existing mechanics: Daily Drop (one song + one meme), Today's memes, Meme Duel (5 fixed choices each, locked reveal, shareable link), Never Have I Ever, Icebreaker Roulette (needs a real match), Local Signal, Matrix (Dating/Friends, "Resonate" = like, undo, filters, detail with humor bars), pin board, playlists, "Look and feel" themes, share-your-Fingerprint sheet.
- **Principles:** no comments (like, save, share, react, duel only), nothing requires moderation where avoidable, honest empty states, photos optional.
- **Audience:** 18+, Gen Z and young millennials, mostly on Android Chrome and iOS Safari PWAs.

## 3. Design direction: "The Gallery"

Calm dark museum, loud exhibits.

- **Chrome is quiet:** near-black warm background, bone-white text, hairline borders, a static grain overlay (one small tiled PNG, never animated), gold micro-labels. Keep and extend the existing tokens; do not replace the palette.
- **Content is loud:** saturated memes and album art are the color.
- **Living contours** are the one visual language: story rings, avatar auras, progress, tap ripples, loaders, reveal. Build one shared `Contour` renderer (Canvas2D, with an optional WebGL2 shader path) driven by a seed + a few params, usable at any size, pausable offscreen.
- **Museum placards** under every meme and song (see copy deck). Placard text doubles as alt text.
- **Profile as a wall** with themes (see §7).
- **Typography:** keep the existing condensed display face. Add one monospace for placards and receipts (e.g. Space Mono or IBM Plex Mono, OFL) and one friendly sticker/handwritten face used sparingly (e.g. Caveat). Subset all fonts, `font-display: swap`, preload the display font.
- **Tokens:** define colors in OKLCH or hex as CSS variables, an 8-pt spacing scale, radii (cards 28, chips 999, sheets 32), and elevation via borders + inner glow rather than big drop shadows.
- **Tech for polish:** View Transitions API for shared-element transitions with a FLIP fallback; CSS `linear()` easing or `motion` springs; scroll-linked effects via CSS scroll-driven animations with a JS fallback; `dvh` units and safe-area insets everywhere; Pointer Events with `setPointerCapture` for all gestures; `overscroll-behavior: contain` on sheets.

### Motion principles

- Springs for anything the user touches; ease-out for system motion. Micro 120–180 ms, standard 240–320 ms, hero 600–900 ms. Stagger 25–40 ms.
- Animate `transform` and `opacity` only. Never animate layout, `filter`, `box-shadow` or large blurs in a loop.
- Everything is **interruptible** (a new tap cancels and redirects, never queues).
- At most two heavy effects at once. Particles share one overlay canvas (pooled, capped at 300 live particles, DPR capped at 2).
- **Haptics:** `navigator.vibrate` where available, wrapped in one `haptics.ts` with named patterns (`tick`, `light`, `medium`, `thud`, `success`, `laugh`); no-op elsewhere. **Sound:** optional UI sound sprite (≤ 40 KB total), default OFF, toggle in Settings; unlocked after first gesture.
- `prefers-reduced-motion`: swap effects for a short fade and color flash, no parallax, static intro, no shaking.

## 4. PHASE 0 — Foundations, bug fixes, content pipeline

### 4.1 Fix these observed bugs first (reproduce, root-cause, test)

1. **Shared state is broken.** After liking and saving items, `You` shows Resonances/Saved/Laughs given = 0 and "Saved culture: Nothing saved yet". Introduce one persisted store (IndexedDB via `idb`/Dexie, with an in-memory reactive layer) as the **single source of truth** for `reactions`, `saves`, `pins`, `seen`, `limits`, `stories`. All screens read through selectors. Optimistic updates; sync to the backend if one exists.
2. Modal/toast layering: the Meme Duel modal opening over Home after onboarding, and the "Welcome to cultured" toast overlapping buttons. Define a z-index scale and a single overlay manager (sheet, modal, toast, reaction tray, coachmark) with a queue and priorities.
3. Meme text ghosting through the song card during Deck card swaps. Cards must be isolated layers; only the top card and the one beneath are rendered.
4. Overlap/clipping bugs: onboarding contour and "% confidence" text over the track list, microcopy clipped under meme cards, Matrix detail blank box during the transition, "Something felt off?" overlay over humor bars, truncated toast text, clipped chip rows, top contour clipped by the "The Story" pill, blank playlist thumbnails.
5. "Photo checked on this device" state leaking into the music-source step.
6. Garbled display name on the reveal ("Alelllsb"): names must be explicitly entered, never derived from an email prefix.
7. "0%" flash on a new Matrix card before the score loads: show a skeleton or the previous value until computed.

### 4.2 Performance audit (do this before building new motion)

- Record a Chrome performance trace of the current intro and Home with 4× CPU throttle via Playwright's CDP. Identify long tasks, layout thrash, full-screen blur/backdrop-filter, animated SVG filters and oversized images/video. Write findings to `docs/v5/PERF_AUDIT.md`.
- Fix the root causes. Add a dev-only `?perf=1` HUD (FPS, long tasks, memory, active Lottie/video/particle counts).
- Add a **quality ladder**: on boot, read `deviceMemory`/`hardwareConcurrency` and run a 500 ms frame-time probe, then pick tier A (WebGL2 + full FX), B (Canvas2D + reduced FX), C (CSS/video fallbacks). Expose `quality.tier` to all effects.

### 4.3 Meme pipeline (local image + video memes)

- Find the local meme assets. Build `scripts/build-memes.ts`: scan the folder, generate AVIF/WebP at 480/960/1440 px widths, video posters, dominant color + blurhash, intrinsic size, video duration, and write `src/content/memes.manifest.json`.
- Optional per-meme overrides in `src/content/memes.meta.json`: `title`, `category` (use the 15 display categories in the copy deck), `mood`, `axis`, `placard` (impact line), `credit`, `rightsCleared` (default `false`).
- **Build gate:** the production build fails (override with `ALLOW_UNLICENSED=1`) if any meme has `rightsCleared !== true`. I will clear rights before launch; this prevents accidents.
- **Delete the AI-generated text-meme generator, its seed data and any text-card meme UI.** Only real image/video memes appear. Keep human-written text for games (NHIE, duels) only.
- Video memes: `muted playsinline loop`, play only when ≥ 60% visible, **one playing at a time**, `preload="metadata"`, poster first, pause on tab hide. Cap decoded videos at 3.
- Image delivery: `<img>` with `srcset`/`sizes`, blurhash placeholder, `decoding="async"`, preload the next two Deck cards.
- **Every meme gets the full action set:** react (tray), like/laugh, save, share, pin (from Vault), "add to story". Memes need stable ids.
- If the catalog is small, the Deck must still feel endless: shuffle without repeats per user (persist a `seen` set), cycle categories for variety, then show the "seen it all" state. Show a count ("412 in the gallery") so the volume is visible.

### 4.4 Song pipeline

- `scripts/build-songs.ts` reads `v5-content/songs_seed.csv` (208 tracks, 31 genres) and resolves each via the **iTunes Search API** (`/search?term=…&entity=song&limit=5`; throttle, since Apple documents roughly 20 requests per minute, and back off on 403/429), with **Deezer's public search API** as fallback. Match on normalized title + artist. Store `trackId`, `previewUrl`, `artworkUrl` (upscale iTunes artwork by swapping the `100x100bb` segment for `600x600bb`), `trackViewUrl`, `durationMs`, `genre`, `vibe`. Print an `unresolved.txt` list for manual fixes. Output `src/content/songs.manifest.json`.
- Add `/api/preview?id=…` (Vercel function): re-resolves and caches a fresh preview URL (Deezer URLs are time-limited). The client always asks this endpoint, with a short in-memory cache.
- Playback: one shared `<audio>`, one global mini-player, fade in/out 120 ms, resume position, pause on blur. Show "Listen on Apple Music / Deezer" links. **Do not scrape Spotify** and do not pipe cross-origin audio into WebAudio (it returns silence): draw waveforms procedurally, seeded by track id and synced to playback progress.
- Replace every fictional artist/song in the app with real manifest entries. Genre filters use the 31 genre slugs and their display names from the copy deck.

### 4.5 Copy

Move every user-visible string into `src/copy/` (typed) from `copy_deck.md`. Apply the voice rules. Rename "signal confidence" to "Fingerprint clarity" in the UI.

## 5. PHASE 1 — The first five minutes

### 5.1 Intro (5.5 s, silent, skippable)

Implement as a **pure function `renderIntro(t)`** over a master timeline so the same code runs live and can be captured frame-by-frame to video. First frame must paint under 400 ms (a poster/first-frame inline, JS chunk lazy). Play once per install and again after 14 days; add "Replay intro" in Settings. Respect reduced motion (static poster + CTA).

Timeline:

- 0.0–0.4 s: black; one ember dot pulses once.
- 0.4–1.6 s: contour lines bloom outward from the dot (iso-lines of a 2D noise field with an animated threshold; shader or Canvas2D), ember to bone color.
- 1.2–2.6 s: real memes from the manifest deal in on springs with 3D tilt, stack and fan; each landing sends a ripple through the contours and a 2–3 px camera nudge.
- 2.4–3.4 s: kinetic type with mask reveals: "Match on your humor." then "Not your headshot." in gold, where "headshot" pixelates and vanishes.
- 3.2–4.2 s: the contours morph into an audio waveform that pulses with a tiny EQ bounce.
- 4.2–5.2 s: everything collapses into the logo mark; the wordmark "cultured" assembles letter by letter; one light sweep.
- 5.2 s onward: CTA rises (**Find my fingerprint** / I already have one) with a calm idle drift at a low frame cost.

Tiers: A = WebGL2 field at ≤ 1.5 DPR; B = simplified Canvas2D rings; C = a pre-rendered 720×1280 H.264/WebM (≤ 1 MB) with a poster. Provide `scripts/render-intro.ts` (Playwright frame capture in deterministic mode + ffmpeg) to generate tier C. The old intro is deleted.

Acceptance: no dropped frames on tier A during a 4× CPU-throttled run (≥ 55 fps p95); no spinner anywhere before brand is visible.

### 5.2 Onboarding (target: under 90 s to the reveal)

Replace the 9-segment bar with a **miniature Fingerprint in the header that grows as you go**. Save progress after each step; support Back; never block on an unavailable integration. Steps (text from the copy deck):

1. **Age gate**, playful but real: a three-drum picker (day, month, year) with accessible fallbacks. Keep the server-side 18+ check. Under 18 shows the "Come back at 18" screen and persists nothing.
2. **Humor Gauntlet:** 12 real memes from the manifest. Swipe right = "That's me", left = "Meh", up = "Too real" (save). Buttons mirror gestures. The live contour at the top gains a ring per reaction with a haptic tick and number ticker for clarity. Milestone lines at 4 and 8. On card 7 teach the tray: a ghost-hand long-press animation. Gauntlet reactions never count toward daily limits.
3. **Genre bubbles:** physics-driven bubble field (simple Verlet, ~30 genres from the manifest). Tap to inflate favorites (up to 6) with a satisfying pop-swell; unselected bubbles drift and nudge.
4. **Sound check:** three real previews with swipe reactions. Procedural waveform. If preview fails, skip gracefully with the "No preview" line.
5. **Signature laugh:** choose one of 8 reaction emojis.
6. **Name tag:** display name (≤ 16 chars) with a random quirky suggestion button; generated bio suggestions ("Collects songs that sound like 4pm in October." style) the user can edit.
7. **Photo (optional):** keep the existing privacy behavior; restyle only.
8. **Reveal ceremony (~8 s):** the swipes replay as particles flowing into the contour shape; the humor archetype appears (copy deck table, top two axes) with a rarity line only if real data allows; one primary action "Keep it" and a share button.
9. **Save it (auth)** if `DEFER_AUTH_TO_AFTER_REVEAL`; otherwise do it at step 1 as a single-screen name-tag ceremony. Equal-size auth buttons: Email magic link, Apple, Google.
10. **Notifications and location** as one light screen each, skippable.
11. **First-run coachmarks** (hold to react, swipe to decide), once only.

Do not list Last.fm / Apple Music / Spotify unless they work; add a "Connect later" chip row in Settings instead.

## 6. PHASE 2 — Home, Deck, Reactions, Vault

### 6.1 Home structure

- Top bar: contour logo, **laugh streak** flame, and the **Laugh budget** meter (15 pips around the heart; a pip pops when spent).
- A pill segmented control: `[Yesterday-slot] [Today] [Tomorrow-slot]` with a liquid indicator, swipe between pages (horizontal pager with parallax). Default tab names per CHOICES.
- **Today:** (1) The Drop hero: today's song + meme as framed exhibits with placards; (2) **The Deck**; (3) "Now playing in your Matrix" (real activity of matches; empty state is a call-to-action to start a duel, not dead text); (4) a Quick Games strip; (5) a small daily ritual ring (laugh 3 · save 1 · react once) that is encouraging, never nagging.

### 6.2 The Deck

- Full-height card stack, **render at most 3 cards**, virtualize the rest, preload 2 ahead.
- **Meme card:** full-bleed media, placard bottom-left, action rail right (signature-laugh, save, share, more), category chip top.
- **Song card:** real artwork, title/artist, genre chip, circular play ring with progress, equalizer bars when playing, "Listen on …" link.
- Gestures (Pointer Events): drag with rotation proportional to dx; commit at 28% width or velocity > 0.5 px/ms; stamp overlays ("HAHA" right, "MEH" left, "KEPT" up) fade in with drag; next card scales 0.94→1; rubber-band when the action isn't allowed.
  - Right = laugh (signature reaction, spends 1 laugh). Left = pass (unlimited). Up = save (unlimited). Tap = flip to details (placard, category, who else laughed). Double-tap = signature reaction with a burst at the tap point. Long-press = reaction tray (§6.3). One free **undo** of the last swipe.
- What spends a laugh: right swipe, the laugh button, double-tap, and the first reaction picked on an item. Changing the reaction on the same item is free. Combos are cosmetic and free.
- When laughs hit 0: right-swipe rubber-bands and opens the **limit sheet** (copy deck) with a countdown to midnight and a "See what I saved" button. Saving, passing, sharing and reacting-to-chat remain available. The budget meter drains with a comic deflate.
- Mix: meme/song ratio roughly 3:1, category diversity, weight toward axes the user reacts to, never repeat within the persisted `seen` set. Keep this simple and deterministic; log decisions for debugging.
- "Seen it all" state at the end of the catalog, with the next drop time.

### 6.3 Reaction system (the showpiece)

Build a standalone `ReactionTray` module used on memes, songs, pins, stories and chat bubbles.

- **Open:** long-press 350 ms (a thin progress ring + `tick` haptic at 200 ms) anywhere on a reactable surface. Tray springs in above the finger (below if no space), items stagger 30 ms with 1.12 overshoot; the content behind dims.
- **Tray contents:** 8 reactions per surface (memes: 💀 😭 🗿 🤡 🧠 🫠 🥹 🔥; songs: 🔥 🎧 🥹 😭 🤌 🫠 🕺 💀) plus a "+" that opens a searchable emoji sheet (curated set animated, the rest static). Names from the copy deck appear as a tiny label under the focused emoji.
- **Emoji rendering:** Google's Noto animated emoji (Lottie, CC BY 4.0). Vendor only the ~40 you use into `public/emoji/` (36–66 KB each; combine into a dotLottie bundle if practical), play once on tray open, then idle-blink every 3–5 s. Max 6 live Lottie instances. Add the credit line to Settings → About.
- **Drag-to-select:** while the finger is down, a gaussian **fisheye** magnifies the emoji under it (neighbors scale by distance), `tick` haptic when focus changes, release on an emoji selects, release outside cancels.
- **Select animation:** the chosen emoji lifts, flies along a curved path to the reaction chip while rotating and scaling, spawns its **signature FX** on landing, and the chip **squashes** (scaleY 0.8 → 1.1 → 1) while its count rolls. Everything completes ≤ 900 ms and is skippable by any tap.
- **Signature FX** (canvas particles + springs, all ≤ 1.2 s, non-blocking):
  - 💀 **Dead:** the item slumps and desaturates, skull drops and bounces, then the item springs back to life.
  - 😭 **Can't breathe:** item jitters with laughter in 3 pulses, tear jets sideways, a pooled "HAHAHA" bursts, `laugh` haptic.
  - 🗿 **Deadpan:** a stone slam from above, 3 px camera shake, dust ring, `thud` haptic.
  - 🤡 **Self-own:** a party hat drops onto the item, a red nose bounces, a honk-ring ripples.
  - 🧠 **Galaxy brain:** brand contour rings ripple out from the tap point and tint the item.
  - 🫠 **Existential:** the item sags with a drip and re-forms.
  - 🥹 **Soft:** warm sparkle bloom, slow.
  - 🔥 **Slaps:** embers rise, the chip glows for a beat.
  - Song-only: 🎧 vinyl spin + waveform ripple; 🤌 gold sparkle; 🕺 equalizer bars bounce.
- **Combos:** repeated fast taps on the same item escalate the effect (x2, x3, x5 UNWELL banner) and never change stored state beyond the first reaction.
- **Chips:** reactions render as chips under the item (`💀 12`). A new reaction from another user animates in with a small ping.
- **Meaning:** each reaction adds weight to the user's axes (💀 absurdist+chaotic, 😭 wholesome, 🗿 deadpan, 🤡 chaotic, 🧠 niche_refs+dry_wit, 🫠 dry_wit, 🥹 wholesome, 🔥 none, songs add genre/vibe weight). Store `reaction`, `itemId`, `ts`; fingerprint derives from these.
- **Tier fallbacks:** tier B halves particle counts; tier C shows a color flash and a single Lottie, no particles.

### 6.4 Save, laugh, share, story-add animations

- **Laugh:** burst at the tap point (12–24 particles: reaction emoji, confetti shards, a contour ripple), number ticker +1, a budget pip pops, the card does a 2–3 pulse jitter with the `laugh` haptic.
- **Save:** bookmark path-morphs to filled, a dog-ear folds on the card corner, a thumbnail flies on an arc into the You/Vault tab icon, the icon bumps and its badge increments. A small "Kept." toast with Undo.
- **Share:** card lifts and flips to a placard; the share sheet assembles the card piece by piece (frame, art, placard text types in).
- **Add to story:** the thumbnail shrinks into a circle and lands on your story ring in People; the ring draws itself with a contour wobble; a 12-hour countdown ring begins.
- **Pass:** card flicks off with a whoosh-style rotation; a tiny "meh" glyph trails.
- **Streak:** the flame increments with a tick-up and ember burst.

### 6.5 The Vault (fixes "I can't see liked/saved")

New private screen from the You tab and from the Deck's save button. Tabs: **Saved · Laughed · Pinned**. Search, filter by meme/song/category/genre/reaction, sort by recent. Virtualized grid. Swipe a tile to unsave (with Undo). Multi-select mode with "Pin to profile". Counts match the stats everywhere (single store). Empty states use the copy deck. Songs can be organized into named playlists; memes into boards.

### 6.6 Profile pins (visible to matches)

- Up to **6 meme pins, 6 song pins and 1 anthem** chosen from the Vault via a bottom sheet (drag to reorder, tap to unpin).
- Matches see these in Matrix detail and the chat profile peek.
- **Resonate on this** (on any pin) is the strongest opener: it spends one Resonate and arrives in the recipient's inbox as "💀 on your pin: {title}".

## 7. PHASE 3 — Matrix, Profile, People, Stories

### 7.1 Matrix

- **Card:** a living aura built from the person's contour in their accent palette; their top meme pin as a tilted polaroid sticker; their anthem as a record sleeve peeking from behind; name, age, distance (approximate), intent chip, vibe line. A **two-contour compatibility visual** replaces the lone number: your shape and theirs slide together; overlap area = score; tick up the percentage and label (Taste twin / Strong overlap / Plot twist potential / Opposites, loudly).
- **Gestures:** right = Resonate (spends 1), left = pass, undo (one free). Drag tilts the card and warps its contour slightly. Stamps "RESONATE" / "PASS".
- **Detail view** (shared-element transition from the card): the overlap visual, a **six-axis radar overlay** (you vs them), "You both laughed at" (carousel of shared reacted memes showing both reactions), "You both play", their **Pin board** and **Shelf**, prompts, wall theme, signature laugh, and a sticky bottom bar (Resonate + score). A "Something felt off?" report sheet that never overlaps content.
- **Mutual moment:** full-screen. Both contours merge into one shape with a chord-like haptic pattern, meme confetti drawn from your shared reactions, then actions: **Send a meme** and **Spin an opener**. Add a "Pass the phone" quick share.
- **Filters sheet** ("Tune the room"): Dating/Friends, distance, age range (age stays private), genres, humor axes. Resonate limit state per the copy deck. No "0%" flash.

### 7.2 You (profile) and the Edit Studio

- **Exhibit view:** aura header with avatar (optional photo or a fingerprint-generated avatar), name, vibe line, humor archetype badge, stats row (Resonances, Saved, Laughs given, Called it), signature laugh, anthem player, Pin board, Shelf, prompts, playlists, "Receipts" (fun stats), duel history.
- **Edit Studio** (a mode of the same screen, with live preview and a "how matches see me" toggle):
  - **Wall themes:** Gallery (wall #EFE9DD, frame #111, accent #C8553D) · Corkboard (cork #B98A5B, paper #F4EBD0, pins #D64545) · Zine (paper #F2F0E8, halftone, ink #1B1B1B, accents #FF3EA5 and #FFE600) · Record Crate (wood #1C140E, accent #F2B544) · Arcade (night #0A0F25, neon #35F2FF and #FF2E97) · Bus Window (gradient #1A2433 to #0C1118, CSS rain only while visible, accent #9CC4FF).
  - **Aura styles:** Contour (default), Ripple, Topo-color, Dots, Halftone.
  - **Frame styles:** Gallery, Polaroid, Tape, Torn paper, Sticker (die-cut), Neon.
  - **Font pairs:** three curated options. **Accent palette:** 8 swatches. **Sticker packs:** 3 small packs (SVG).
  - **Blocks:** reorder and hide: Pin board, Shelf, Prompts, Playlists, Receipts, Duel history.
  - **Prompts:** pick up to 3 from templates ("My most replayed shame song", "A meme that explains my love language", "Pick a meme for my Monday", "The song I'd defend in court", "My red flag, as a meme") answered by picking a meme or song, not free text.
  - Persist as a `profileTheme` JSON; render the same component in preview and in matches' views.
- Fix: blank playlist thumbnails (use the first four tracks' artwork as a mosaic), truncated text in the photo block, clipped chip rows, clipped top contour.

### 7.3 People: chats

- Layout: **Stories rail** on top (contour rings; animated pulse for unseen, static for seen; your own first with "+"), then **Fresh resonances** (matches who haven't spoken, horizontal), then threads.
- **Thread row:** avatar with ring, name, a **vibe line** (e.g., "💀 reacted to your meme", "sent a song: Glasshouse") instead of raw text snippets, unread as a glowing contour dot.
- **Thread view:** a header with the **merged contour** of both people; message types: text, **meme card** (reactable via the tray), **song card** (inline waveform + preview), **story reply** (quoted thumbnail), duel invite, system chips. Long-press any bubble for the reaction tray (chips under bubbles). Swipe-to-reply. Typing indicator as a small waveform. Composer quick row: **Meme · Song · Opener**, where Meme/Song open the Vault as a picker (send from Saved), and Opener opens Roulette templates. Optional per-chat themes (3 to start).
- Respect the existing principle that the app never writes the first message for the user.
- Later add-on (flag, not required): shared **Mixtape** per match.

### 7.4 Stories (12 h)

Data: `story {id, ownerId, createdAt, expiresAt = createdAt + 12h, layers[], audience, replyRule}`. Store a **composition (layers JSON) that references meme/song ids**; do not re-upload licensed bytes. Expiry is enforced server-side if a backend exists, and client-side filtering otherwise.

- **Create:** from the Deck/Vault/Share sheet ("Add to story") or the "+" on the rail.
- **Editor tools:** **Frame** (Gallery, Polaroid, Tape, Torn paper, Sticker, Neon), **Backdrop** (solid, gradient, contour field, blurred meme, pattern), pinch/rotate/drag the meme, **Stickers** (Music = album art + tap to preview, Mood, W or L, Blessed or Cursed, Add Yours chain, Countdown), **Text** (3 fonts, max 60 chars), **Draw** (pen, marker, neon), **Filter** (4 presets), undo/redo, snapping guides with haptic ticks.
- **Settings:** audience (Everyone · Matches · Inner circle · Hide from…), reply rule (Anyone can react · Matches can reply · Replies off), allow share on/off, save to a private **Archive**.
- **Viewer:** full-screen, segmented progress (6 s per image, video up to 15 s), tap forward/back, hold to pause, swipe up for the reaction tray and reply, mute toggle. Viewer list with their reactions for the owner.
- **Add Yours:** a chain sticker with a prompt; viewers can respond with their own story that links back; show the chain count.
- **Expiry:** fade-to-dust particle dissolve on the ring and content.
- **Safety:** report/block on every story, a basic client wordlist for text overlays, and an 18+ gate already in place. Music is an in-app **sticker only**; do not bake audio into exported images/videos.

## 8. PHASE 4 — Sub-pages, Arena, sharing, viral loops

### 8.1 Home sub-pages (implement all four behind flags; enable the two chosen)

- **Y1 Receipts:** `/home/receipts`. Yesterday as a thermal-paper receipt (monospace, serrated edge, barcode generated from the fingerprint hash): up to 8 line items (`time · title · reaction`), totals (laughs, saves, shares), "Peak chaos: {time}", top reaction, archetype of the day, and a **PAID IN FULL** stamp that slams in. Share as a receipt card. Below: a **Missed drops** shelf. Empty state: "Nothing to report. Suspicious."
- **Y2 The Verdict:** top meme and song by weighted reactions, the **Split Decision** (highest reaction entropy) with animated reaction bars and "You sided with {x}%", and a city/campus mini leaderboard. Hide behind "Verdict opens at 50 voters" with a progress meter until the data exists.
- **T1 The Draft:** two blurred candidate memes (24 px blur, hint tags) and two song teasers (genre and vibe only); vote once a day, free; countdown to 9:00; "Called it" badge and a profile counter when your pick wins; result push. Implement behind a `DraftService` interface. If no backend yet, run a deterministic local mock labeled honestly in-UI ("Practice mode: results arrive at 9:00 once voting is live").
- **T2 Forecast:** pick tomorrow's **weather** (six cards in the copy deck) plus one saved meme and one saved song as **Tomorrow-me**, shown as a 24-hour status ring on your Matrix card and chat avatar; "Same weather" badge between matches; optional low-pressure IRL chips (coffee, walk, listening party) that are signals only.

### 8.2 Arena

- Redesign tiles with animated Lottie hero emoji, live status lines, and the same Gallery language. Keep Meme Duel, Never Have I Ever, Icebreaker Roulette.
- **Meme Duel:** keep locked reveal and fixed choices; redesign animation: two cards slam in from the sides (spark, 3 px shake), each lock plays a "ka-chunk" lock animation, the reveal is a 3-2-1 with contours colliding, matching answers glow and connect with a line, then the **Damage Report** card (compatibility ticker, both contours merged) with share.
- **Never Have I Ever:** load `v5-content/nhie_questions.json`. 12 cards per round, no repeats until the bank is exhausted (persist asked ids), optional category filter and spice setting. Card text = `prefix + text`, subtext = `sub`. **Guilty** slams an ink stamp with a 3 px thud; **Clean** shows a halo and sparkle. Each answer nudges the question's `axis`. Result: a count-up score and a **rank title** (copy deck), then play again/done. Add **friend mode:** the same 12 via link, and the reveal shows "You're both guilty of: …".
- **Icebreaker Roulette:** needs a real match; add a **practice spin** with sample templates, clearly labeled "Practice spin. Nobody's notified."
- **City meter** (replaces "Your city is still quiet"): a progress ring "{city} unlocks at 100 people. {n}/100", an invite link that moves you up, and a leaderboard of campuses/cities once ≥ 3 have members. Show only real numbers.

### 8.3 Sharing

- One **placard-style template**, restrained: grain, contour watermark, the item framed, placard text, tiny wordmark and short URL. Three sizes: 9:16 story, 1:1, link preview (1200×630). Types: meme, song, Fingerprint, Duel result (Damage Report), Receipt, Weekly recap.
- Generate with Canvas/OffscreenCanvas on device for the image; generate OG images with `@vercel/og` for links. Use `navigator.share({files})` when supported, else download. Share sheet targets: Story, Messages, Copy link, Save image, Match.
- **Link landing page** `/r/:id`: lightweight (separate small entry, no full app bundle) that plays the preview, shows the item, lets the visitor react with the tray (no account), and shows "Find your own fingerprint. Thirty seconds, no photo." Attribute with a privacy-friendly `?ref=` token.

### 8.4 Viral loops to implement now

1. **Duel Link, no install:** the friend plays in the browser in under 30 s with no account and gets a Damage Report plus their own Fingerprint; prompt to keep it. Duel streak with a friend.
2. **Cultured Weekly:** Sundays at a user-set time, story-format recap (slide titles in copy deck), shareable; humor archetype changes highlighted.
3. **Smoke Signals:** share any meme/song by link; non-users react in the browser; the sender sees reactions live ("reaction receipts"); replying requires joining.
4. **City meter** (see 8.2).
5. **Laugh streak** and **Add Yours** chains (in Stories).

Phase-2 backlog (design the data model so they fit): **Crew Fingerprint** (2–4 friends, one link, group fingerprint and superlatives) and **Double Date** mode.

Guardrails: no contact scraping, no anonymous-sender mechanics, no dark patterns, 18+.

## 9. Micro-interaction catalog (implement all that apply)

Press states with spring (scale 0.96) on every tappable; liquid nav indicator with icon micro-animations and badge dots as small contour pings; pull-to-refresh with a contour ripple; skeletons that shimmer with a faint contour pattern; number tickers (rolling digits) for counts and percentages; toggles with squish; chips with `tick` haptic; copy-link button morph to "Copied"; shared-element transitions card→detail; scroll-linked parallax on aura backgrounds; subtle device-tilt parallax on hero cards (opt-in permission on iOS, off in reduced motion); rubber-banding at limits; idle looping animations on empty states; stacked toasts with swipe-to-dismiss and Undo; input focus glow; keyboard-aware sheets; velocity-based card throw physics; long-press hint rings; tab-bar hide-on-scroll-down inside long lists only.

## 10. Performance budgets (enforce in CI where possible)

- Mid-range Android, 4G: LCP < 1.8 s, INP < 200 ms, CLS < 0.05.
- Initial JS ≤ 180 KB gz (route-split; intro, Lottie, WebGL, story editor and share generator are lazy chunks). Fonts ≤ 120 KB total. Images AVIF/WebP with `srcset`.
- 60 fps gestures (≥ 55 fps p95 at 4× CPU throttle on Home, Deck, Matrix, Chat).
- Caps: ≤ 3 decoded videos, ≤ 6 live Lottie, ≤ 300 live particles, 1 audio element.
- Service worker (Workbox): precache shell and manifests, runtime-cache memes and artwork (cache-first with expiry), never cache audio previews or API results with auth.
- Add a Playwright perf script (CDP tracing, 4× throttle) that writes FPS/long-task numbers to `docs/v5/PERF_REPORT.md`.

## 11. Accessibility, safety, legal

- Tap targets ≥ 44 px, visible focus states, labels on every icon button, color contrast ≥ 4.5:1 for text, placard text as alt text, `prefers-reduced-motion` handled everywhere, haptics/sound toggles in Settings, captions not needed (no speech) but never rely on sound alone.
- Safe-area insets, `dvh`, keyboard handling. Test at 360×640, 390×844, 412×915 and 768 wide.
- Report/block on profiles, stories, chat. Minimal client wordlist for story text.
- Licensing: meme build gate (4.3); music previews from iTunes/Deezer only, with attribution links; Noto animated emoji credit in About; no Telegram assets; music in stories only as in-app stickers.
- Settings must include: Sound, Haptics, Reduce motion override, Replay intro, Clear local data, About + credits.

## 12. Data model sketch (adapt to the existing backend)

```ts
type ItemRef = { kind: 'meme' | 'song'; id: string };
type Reaction = { itemId: string; kind: 'meme'|'song'; emoji: string; ts: number; surface: 'deck'|'pin'|'story'|'chat'|'onboarding' };
type Save = { itemId: string; ts: number };
type Pin = { itemId: string; slot: number; kind: 'meme'|'song'|'anthem' };
type Limits = { day: string /* local YYYY-MM-DD */; laughsUsed: number; resonatesUsed: number };
type ProfileTheme = { wall: string; aura: string; frame: string; fonts: string; accent: string; stickers: string[]; blocks: { id: string; visible: boolean }[]; prompts: { promptId: string; itemId: string }[]; signature: string; anthemId?: string };
type Story = { id: string; ownerId: string; createdAt: number; expiresAt: number; layers: unknown[]; audience: 'everyone'|'matches'|'circle'; hideFrom: string[]; replyRule: 'react'|'matches'|'off' };
```

Limits: enforce server-side if a backend exists (client is advisory), reset on local midnight, guard against clock tampering with a monotonic check. Both caps live in remote config.

## 13. QA and Definition of Done

- Playwright suite (Pixel 7 + iPhone 14 emulation): onboarding to reveal, Deck gestures, limit sheet at 15, tray open/select/cancel, save→Vault→pin→appears on profile and in a match's view, story create→view→expire (with a time mock), share card generation, Duel link no-install flow, NHIE round without repeats. Save screenshots to `docs/v5/screens/`.
- A visual pass at the four viewport sizes with no overlap, clipping or truncated toasts. The seven bugs in §4.1 each have a regression test.
- `tsc --noEmit`, lint and build pass; no console errors; Lighthouse PWA and performance run recorded.
- Perf numbers meet §10 or the shortfall is documented with a plan.
- Deliver: `docs/v5/STATUS.md`, `DECISIONS.md`, `PERF_AUDIT.md`, `PERF_REPORT.md`, and a short `docs/v5/CHANGELOG.md`. Preview deployment URL in the final message.

**Start now:** explore the repo, post your plan, then execute Phase 0.
