# Session brief — cultt, read end to end

Everything below is from reading the repository at commit `970f5b9` and running
its own checks. File:line references are included so any claim can be checked.

---

## 1. What the product actually is

A dating app where **humor and replay history are the profile**. You react to
memes and songs; the app grows a **Fingerprint** — a contour shape derived from
six humor axes (deadpan, absurdist, dry wit, chaotic, wholesome, niche refs) —
and **Matrix** introduces you to people whose fingerprints overlap. Photos are
optional. There are no comments; interaction is like / save / share / react /
duel.

The product guardrails are explicit and load-bearing (`README.md`, and enforced
by tests):

- no swipe-to-judge in the Culture Feed
- no "who liked you" paywall
- no guilt notifications
- no face grid
- **UGC off until moderation is real**
- **no fabricated social proof** — like/laugh counts start at zero and only grow
  from the user's own taps (`legacy.ts:213` `const N=n=>DEMO_DATA?n:0`)

That last one is the constraint that shapes every idea in §5. It is asserted by
`tests/unit/no-fake-people.test.ts` against the **built bundle**, not the source.

## 2. Architecture, as it actually stands

Vite 6 + TypeScript, **no framework, no router**. `index.html` holds static
`<section class="screen">` shells; `go(tab)` in `legacy.ts:461` toggles them.

| Layer | Path | Role |
|---|---|---|
| Shell | `src/main.ts` (115 ln) | Boots repo → store → intro → dynamic-imports each screen into its tab host |
| App | `src/legacy.ts` (2,385 ln, `@ts-nocheck`) | The whole original app: nav, feed, Matrix, People, You, onboarding, chat, duels, settings |
| Alt UI | `src/v5/*.ts` (~4,000 ln) | A parallel v5 design, **off by default** |
| State | `src/store/*` | Typed, persisted, migrated store (reactions/saves/pins/limits/stories) |
| Legacy state | `S` in `legacy.ts:207` | One `localStorage` blob, `cultured2:state` |
| Data | `src/data/{mockRepo,supabaseRepo}.ts` | `Repo` contract; mock is default, Supabase is contract-complete but disabled |
| Content | `src/content/*` + `scripts/build-*.ts` | Generated manifests for memes, songs, NHIE |
| Motion | `src/motion/*`, `src/v5/reactions.ts` | Micro-interactions, cold open, the 8-emoji reaction tray |
| DB | `supabase/migrations/0001–0009` | 7 SQL migrations + 3 pgTAP test files |

### The v5 flag gate — important, and easy to get wrong

`src/store/config.ts:76`:

```ts
v5: { intro: true, home: false, vault: false, profile: false, stories: false,
      matrix: false, people: false, arena: false }
```

**Only the v5 intro is on by default.** Everything else is behind `?v5=1`.
`docs/v5/STATUS.md` records the reversal (D-38): "The v5 Gallery layout replaced
too much of a design that already worked." So:

- `#s-feed`, `#s-match`, `#s-people`, `#s-you` render **legacy** code by default.
- `src/v5/home.ts` (952 ln), `vault.ts`, `profile.ts`, `matrix.ts`, `people.ts`,
  `arena.ts` are **shipped but unreachable** without `?v5=1`.
- `src/v5/stories.ts` and `src/v5/reactions.ts` **are** reachable — legacy
  imports them directly for the stories rail and the long-press tray.

**This matters for your list.** "Redesign the stories UI" and "profile
customization" both have a fully-built v5 implementation sitting dark. Some of
your asks are a wiring job; others are new work.

## 3. Current state, surface by surface

### Home (`legacy.ts:632` `renderFeed`)

Three sub-pages behind a folder tab (`legacy.ts:643`):
`[['-1','Rewind'],['0','Today'],['1','Tomorrow']]`.

- **Rewind** (`rewindHTML`, `legacy.ts:532`) — gradient hero, "vibe of the day",
  three big stats, "most you" meme, filmstrip. Reads real store data.
- **Today** (`homeBodyHTML`, `legacy.ts:591`) — a 4–6 card drop deck +
  `mmHTML()` "Today's memes".
- **Tomorrow** (`draftHTML`, `legacy.ts:568`) — "The Draft": two blurred
  candidate memes, one free vote/day, countdown to 9:00. Labelled Practice Mode
  because nothing tallies real votes.

**Two findings that matter for "expand the home feed":**

1. **The hero deck is still placeholder art.** `dcardHTML` → `artOf` →
   `memeArt` (`legacy.ts:336`) draws a *procedural typographic text card* from
   the four hand-written `MEMES` objects at `legacy.ts:204`. The 20 real image
   memes live in a *separate* list (`MM`, `legacy.ts:2150`) and only appear in
   the smaller "Today's memes" strip. So the most prominent surface in the app
   shows fake cards while the licensed art sits one scroll down.
2. **The feed is capped at 6 of 20 memes.** `mmHTML` renders
   `mmList().slice(0,6)` and the header literally says "6 of 20 in the gallery".
   Topic tabs are stubbed: `ACT['mm-tab']` just toasts "Topic tabs are off in
   this phase" (`legacy.ts:2161`).

### Meme images — **broken, now fixed** (see §4)

### Share (`ACT['mm-share']`, `legacy.ts:2174`)

Opens a sheet titled "Send to a match" listing existing threads, or "Match with
someone first". That is the entire share surface for memes. There is a separate
`openShare()` (`legacy.ts:919`) for drop cards offering Copy link + OS share,
and `ACT['share-receipt']` (`legacy.ts:723`) for the Rewind page.

The comment at `legacy.ts:913` explains the minimalism: buttons that used to say
"Added to your story" and "Sent to Messages" were removed because they lied.
**Any new share target has to actually do something** or the honesty test fails.

### Stories

Rail on the feed (`storiesRailHTML`, `legacy.ts:605`) → dynamic-imports
`src/v5/stories.ts` into a `.stories-host` div. The v5 viewer:

- `describeLayers()` resolves a layer stack to `{src, alt, caption, sticker}`
- stage renders `<img>` plus one sticker plus one caption
- **no progress bar animation** — the bar shows *time until expiry*, not playback
- **no tap-to-advance, no auto-advance, no swipe between stories, no pause**
- **no viewer reactions, no reply box**

Compose: pick a backdrop from the first 6 memes and 4 songs, one sticker, one
80-char text line, audience, reply rule. No drag/resize/rotate, no draw, no
filters, no multi-slice story.

Layout: `.v5-story-stage img` has no `object-fit` rule of its own — see §5.6.

### Profile

**Legacy** (`renderYou`, `legacy.ts:1688`): tint (5 presets, `PROF_TINTS`
`legacy.ts:199`), wall background (`rings`/`poster`/`quiet`), photo, humor chips,
artists, 2 prompts, photos, pin shelf, visibility segment.

**v5** (`src/v5/profile.ts`): profile-as-a-wall — anthem, pinned memes, pinned
songs, a contour seeded from the user's own axis mix. **No theme picker, no
accent picker, no drag-to-reorder, no "how matches see me" preview** — the brief
(§6) asked for all four and none shipped.

There is **no profile object in the v5 store at all** (`src/store/types.ts`
`StoreState` has no `profile` key). Customization lives only in legacy `S.prof`.

### Like / save animations

`src/motion/micro.ts` (670 ln): `pop`, `burst` (10 particles), `flyTo`,
`countTo`, `spring`, plus a 350 ms long-press that opens the full 8-emoji tray
with fisheye drag and per-emoji signature FX (`src/v5/reactions.ts`).
Everything is transform+opacity, 120–400 ms, and swaps to the instant final
state under reduced motion.

Current meme-card behaviour (`legacy.ts:2163`): like → `burst(b,'#ff5d7a')` +
`floatFromEl(b, V5_LIKE, 3)` + haptic. Save → **a toast** ("Kept." / "Let go.")
and a haptic. The product brief §3 row 13 called this out verbatim: *"Save = a
toast. Feedback is functional, not delightful."*

---

## 4. Fixed this session: meme images not rendering

Your rights purchase is already recorded — all 20 entries in
`src/content/memes.meta.json` are `rightsCleared: true`, and the build gate
passes. The images were still invisible for **two independent reasons**, either
of which alone was enough:

### Cause 1 — dev: the optimised variants were never generated

`src/data/seed/memes.ts:73` resolved every image to
`meme.variants.at(-1)?.webp` → `/memes/gen/meme-01-480.webp`.
`public/memes/gen/` is gitignored (`.gitignore`) and only
`npm run content:memes` creates it — and nothing ran it. On a fresh checkout:

```
items: 20   missing files: 19      # 20th is meme-13.webp, 236×224, too small for any variant
```

### Cause 2 — production: the build deleted every meme

`npm run build` ended with `node scripts/prune-demo-assets.mjs`, whose
`targets` array was `[resolve(root, 'dist/memes'), …]`. Verified on the real
build:

```
pruned dist/memes
pruned dist/manus-routes.json
demo assets removed from dist
=== dist/memes ===  ls: cannot access 'dist/memes': No such file or directory
```

The script was written when all 20 memes were unlicensed web-search material.
It predated the rights purchase and nobody revisited it.

### What changed

| File | Change |
|---|---|
| `scripts/prune-demo-assets.mjs` | Rewritten. Per-file, manifest-driven: keeps rights-cleared media, deletes media the manifest does not vouch for, deletes provenance files (`sources.json`, `README.md`). |
| `package.json` | `predev` runs `build-memes.ts --if-stale`; `build` runs full `content:memes` (which includes the gate) instead of gate-only. |
| `scripts/build-memes.ts` | New `--if-stale`: manifest-driven staleness check, skips the ~21 s sharp re-encode when current. Gate always runs. |
| `src/content/index.ts` | New `memeThumb(meme) → {src, fb}` so every surface resolves the same way. |
| `src/data/seed/memes.ts` | Seed memes carry `fb` (the committed original). |
| `src/main.ts` | One capture-phase `error` listener swaps a failed image to `data-fbk` and drops `srcset`/`sizes` first (otherwise the browser re-resolves from `srcset` and ignores `src`). |
| `src/legacy.ts`, `src/v5/{stories,profile,deck,home,vault}.ts` | Every meme `<img>` now carries `data-fbk`. |
| `tests/unit/meme-assets.test.ts` | **New, 12 tests**: rights state, originals on disk, `memeThumb` fallback, seed `fb` never points at `gen/`, and the prune script run for real against a temp dist (keeps cleared, drops uncleared, drops provenance). |

### Verified

```
npx tsc --noEmit        → 0 errors
npx eslint .            → 0 problems
npx vitest run          → 407 passed / 25 files   (was 391 + 4 skipped / 24)
npm run build           → OK; "dist/memes: 64 rights-cleared file(s) kept,
                                2 provenance file(s) removed"
                          dist/memes media files: 64   (was 0)
build-memes --if-stale  → 0.13 s   (was 21.2 s full re-encode)
touch a source + rerun  → re-encodes; second run skips again
gate regression         → flipping one meme to rightsCleared:false fails the build
GET /memes/gen/meme-01-480.webp → 200 22012 B on the dev server
```

**One perf note found while in there:** `vercel.json` serves
`Cache-Control: public, max-age=31536000, immutable` for `*.webp|avif`, but
`public/memes/gen/meme-01-480.webp` is not content-hashed. If a meme is ever
re-generated in place, returning users keep the stale bytes for a year. Either
hash the variant filenames or scope that header to `/assets/`.

---

## 5. Your nine asks, with the honest constraints

### 5.1 Expand the home feed

**Now:** 4–6 drop cards built from 4 hand-written text memes + a 6-of-20 strip.

**Do this:**
1. **Retire `MEMES`/`memeArt` from the drop deck.** Point `DROPS` at the real
   corpus so the hero deck shows licensed art. This is the single highest-value
   change in the whole list — it makes the app look real on first open.
2. **Infinite-ish feed.** Replace `slice(0,6)` with the seeded per-day ordering
   already written in `src/v5/deck.ts` (`orderDeck()` — category rotation + axis
   affinity, deterministic per day). It exists, is tested, and is dark.
3. **Turn the topic tabs on.** `TOPIC_FOR_CATEGORY` in
   `src/data/seed/memes.ts:44` already maps all 9 display categories onto the 6
   feed tabs. `ACT['mm-tab']` currently toasts "off in this phase".
4. **Add sections**, each honest about being empty: Today's drop · Because you
   laughed at X · From your circles · **Live near you** (§5.4) · **Table for two**
   (§5.5) · Vault picks.
5. **Video memes.** The pipeline already handles `.mp4/.webm`, reads duration
   from the `mvhd` atom (`build-memes.ts:98`), and sets `kind: 'video'` +
   `poster`. Nothing renders it yet. Muted autoplay, one at a time,
   IntersectionObserver-driven.

**Risk:** 20 memes is thin for an infinite feed. The honest answer is a
`seen`-aware rotation (already in the store: `StoreState.seen`) plus a "you've
seen everything today, here's your rewind" terminal state — not fake volume.

### 5.2 Meme images — **done**, §4

### 5.3 Share sheet: story / match / Instagram / Snapchat / more

Real constraints, in order of how much they'll bite:

- **"Add to story" (in-app)** — fully doable. `V5.putStory()` already exists and
  the rail re-renders on store change. One function call. **Do this first.**
- **"Send to a match"** — already exists (`ACT['mm-send']`). Keep it, restyle it.
- **Instagram Story** — there is **no web API to post to an Instagram Story**.
  Instagram's Graph API story publishing requires a Business/Creator account
  and a review process; it cannot post an arbitrary user's image from a web app.
  What *is* possible:
  - `navigator.share({ files: [File] })` — **Web Share Target Level 2**. On
    Android Chrome this opens the OS sheet with Instagram and Snapchat as real
    targets, and Instagram opens with the image pre-loaded in the story camera.
    This is the correct, honest implementation. Gate on
    `navigator.canShare({files})`.
  - `instagram://` / `snapchat://` custom schemes — unreliable, and on iOS they
    open the app with **nothing attached**. Do not promise a pre-filled story.
- **Snapchat Story** — Snap Kit's Creative Kit SDK can post to Snapchat, but it
  is a native mobile SDK (iOS/Android), not web, and needs a Snap developer app.
  Not available in this Vite web app.
- **The honest fallback:** render the share card to a PNG (the repo already has
  `sharp` and a rasterising endpoint at `api/og.ts`), then offer **Download**,
  **Copy image**, and **Share…** (Web Share with the file). Never label a button
  "Post to Instagram Story" — that is exactly the class of button
  `legacy.ts:913` removed.

**Design:** one `openShareSheet(item)` in `src/lib/share.ts` with a
capability-detected row: `Your story` · `Send to a match` · `Save image` ·
`Copy link` · `More…`. Every tile is present only if its capability resolves.
Plus the **placard card** from brief §6 — one clean template in 9:16 / 1:1 /
link-preview, reusing `renderOgCard()` (`src/lib/og.ts`) which already draws
branded SVG and is already tested.

### 5.4 Rewind → **Concerts in your area**

This is the biggest item. Honest API landscape, checked today:

| Provider | Status |
|---|---|
| **BookMyShow** | **No public developer API.** Third-party scrapers only (Apify, parse.bot). No affiliate programme for indie apps. |
| **Insider.in** (BookMyShow-owned) | Some partner access, invitation only. |
| **Ticketmaster Discovery API** | **Real, free, self-serve key**, ~5,000 calls/day, well documented, global concert coverage. |
| **Bandsintown** | Real API but `app_id` is for artists/partners; city queries are not public. |
| **Songkick** | Application-based approval, slow. |

**Recommendation:** build a `LiveEventsProvider` adapter with three
implementations — `ticketmaster` (live), `seeded` (a curated JSON pack, so the
screen is never empty in dev), and `bookmyshow` (a stub that returns a **deep
link**, not data). Booking then becomes "we hand you to the ticketing page with
the right event pre-selected", which is legal, works today, and is what
aggregators actually do. If you get a BookMyShow affiliate agreement later, only
the adapter changes.

Do **not** render prices, seat maps or "3 tickets left" from a scrape. That is
fabricated data of exactly the kind `no-fake-people.test.ts` exists to prevent.

**UI/UX — the redesign:**
- **Hero:** full-bleed event artwork with a slow ken-burns push (the app already
  does this on `.tm-bg`, `legacy.ts:519`), artist wordmark in Bricolage, date as
  a big numeral, a live "doors 8pm" chip.
- **Lineup ladder** — billing-ordered artist rows, tap to expand a 30 s preview
  (`api/preview.ts` already proxies previews so no cross-origin stream hits
  WebAudio).
- **Video strip** — one muted, looped teaser per event, one at a time, driven by
  IntersectionObserver. The `mediaLayer()` helper and `--media-url` pattern
  already exist.
- **Going meter** — "4 people from cultured are going" only when real; otherwise
  a **Be-first** state. This is the honest version of social proof and it is the
  actual dating hook: **a concert is a date idea with a time and a place already
  attached.**
- **The killer interaction:** `Resonate on a show`. Long-press any event →
  reaction tray → "Send to a match". A shared "going" becomes a mutual intent,
  which is a far stronger opener than a message. This is the one feature here
  that competitors can't copy without your fingerprint data.
- **Micro-interactions:** ticket-stub perforation that tears on scroll, a
  contour ring that fills as the date approaches, price chips that spring on
  tap, a countdown that flips.
- **Empty state:** "Your city is still quiet — 37/100 people unlocks it", wired
  to the City Meter already specced in brief §9.4.

**Data model:** new `supabase/migrations/0008_live_events.sql` — `events`,
`venues`, `event_interest(user, event, state)`, RLS in the existing style, an
RPC for "going with a match".

### 5.5 Tomorrow → **Dine-in**

Same honesty problem, worse:

| Provider | Status |
|---|---|
| **Zomato** | The public `developers.zomato.com/api/v2.1` is **discontinued**. Current access is a POS/partner programme, onboarding required. |
| **Swiggy** | **No public API.** Partner-only. |
| **Google Places** | Self-serve, real, gives name/rating/photos/opening hours. No table booking. |
| **Dineout / EazyDiner / Reserve** | Reservation partners, invitation only. |

**Recommendation:** `DineInProvider` with `googlePlaces` (live discovery) +
`seeded` (curated pack) + a **deep-link out** to Zomato/Swiggy for the actual
reservation. Do not render a Zomato rating you cannot fetch.

**UI/UX:**
- **Tonight / Tomorrow / Weekend** segmented control.
- **Cuisine mood, not cuisine list** — "loud and cheap", "quiet enough to talk",
  "impress a first date". Maps onto the humor axes you already compute.
- **The dating angle:** propose a **table for two**. Pick a place → send it to a
  match as a card with two times → they tap one → it lands in both calendars as
  a story with a countdown sticker. That is the whole product thesis in one flow.
- Photo-first cards, a distance chip, a "quiet enough to talk" badge, price
  as ₹/₹₹/₹₹₹.

### 5.6 Stories → Instagram-quality layout

**The stretch bug is real and specific.** `.v5-story-stage img` has no
`object-fit`. The stage is a flex/grid box; the `<img>` is a replaced element
with intrinsic dimensions, so it renders at natural size and overflows or
squashes depending on the container. Fix:

```css
.v5-story-stage { position: relative; aspect-ratio: 9/16; max-height: 100%;
                  overflow: hidden; border-radius: …; background: #0b0b0a; }
.v5-story-stage img { position: absolute; inset: 0; width: 100%; height: 100%;
                      object-fit: cover; object-position: center; }
```

`cover` is what Instagram does; `contain` letterboxes and looks broken. Add a
blurred `contain` underlay (`filter: blur(28px) scale(1.2)`) for the letterbox
case, which is the other half of the IG look.

**What's missing to actually feel like Instagram:**
1. **Multi-slice stories** — `Story` is one item with layers; it needs to be an
   array of slices, each with its own duration.
2. **Real playback** — a 5 s auto-advance timer per slice, tap-right/tap-left to
   move, hold to pause, swipe down to close. None of it exists; the current
   progress bar shows *expiry*, which is a different thing and reads as a bug.
3. **Segmented progress bars** at the top (one per slice), not one bar.
4. **Draggable stickers** — pointer-drag, pinch-scale, rotate. Currently a
   sticker is a `<span>` in a fixed position.
5. **Reactions and reply bar** at the bottom — the tray already exists and is
   already wired for chat bubbles; reuse it.
6. **Blurhash placeholders** — the pipeline already computes and stores a
   blurhash for every meme (`build-memes.ts:207`) and **nothing uses it**.
   Decoding it as an inline SVG background makes stories feel instant.
7. **Aspect handling per source** — memes are 700×368 (landscape!), album art is
   square. A 9:16 stage needs a layout decision per aspect, not one rule.

### 5.7 Profile customization

**Blocker first:** there is no profile in the v5 store
(`src/store/types.ts` `StoreState`). Customization can't survive a screen that
isn't legacy until `ProfileTheme` is a persisted, typed shape. Add it to
`StoreState` + the migration in `src/store/migrate.ts`.

Then, from brief §6, none of which shipped:
- **Wall theme** — Gallery / Corkboard / Zine / Record Crate / Arcade / Bus
  Window. The v5 wall exists; it has exactly one look.
- **Accent palette + aura style + frame style + font pair + sticker pack.**
- **Drag-to-reorder blocks** — `shelfWire()` already implements drag-reorder for
  the pin shelf (`legacy.ts:1232`); generalise it.
- **"How matches see me" preview** — a read-only render of the wall as a match
  sees it. Cheap, high perceived value.
- **Anthem** — a pinned song that plays on profile open. The pin kind
  `'anthem'` already exists in `PinSlotKind` and is unused.

### 5.8 Strong, efficient, optimized

Measured this session:

```
dist/assets/index-*.js      79.6 kB │ gzip 15.0 kB
dist/assets/index-*.js      82.7 kB │ gzip 29.3 kB
dist/assets/legacy-*.js    179.7 kB │ gzip 61.2 kB   ← the whole app, @ts-nocheck
dist/assets/supabaseRepo   239.7 kB │ gzip 63.0 kB   ← lazy, correct
public/memes/gen           1.7 MB across 44 files
```

Real problems, in priority order:

1. **`legacy.ts` is 2,385 lines of `@ts-nocheck`.** It is the app. No type
   safety, no tree-shaking, one 61 kB gz chunk on the critical path. `main.ts`
   `await import('./legacy')` before any content renders — documented as such in
   `docs/v5/PERF_REPORT.md`. *This is the single largest structural risk in the
   repo.* Incremental extraction, one screen at a time, is the only safe path.
2. **No image `srcset` on the legacy path.** `memeArt` in `src/v5/deck.ts:212`
   builds a proper AVIF/WebP `srcset` with `sizes`; `mmVisual` in legacy emits a
   bare `<img src>` at the 480 px variant, upscaled into a 61 %-height card.
   Port `memeArt`.
3. **`backdrop-filter` history.** `STATUS.md` records that dozens of live blur
   layers were the root cause of the lag and were removed. Worth an audit pass —
   `#nav`, `.sheet`, `#mini-player` still each carry one.
4. **Blurhash computed and never used** — free perceived-perf win, see §5.6.
5. **`fitMeme()`** (`legacy.ts:668`) runs a synchronous
   `scrollHeight`/`getComputedStyle` loop in a `while` with up to 6 iterations,
   per text node, on every render and every deck swap. Forced reflow in a hot
   path.
6. **`renderYou()` is called from `ACT['mm-like']` and `ACT['mm-save']`**
   (`legacy.ts:2163`, `2169`) — a full profile re-render on every like/save on
   the feed, even when the You tab is not mounted. It should be a store
   subscription.
7. **The `immutable` cache header on non-hashed meme URLs** (§4).
8. **Nothing is measured in a real browser.** Playwright's browser CDN is
   unreachable here, so LCP/INP/CLS have never been run. `tests/visual/` has
   committed baselines and specs that have never executed. This is worth fixing
   in CI before adding more animation.

### 5.9 Better like/save animations

Save is currently a toast. Ideas, cheapest first:

- **Save → the bookmark fills with liquid** (a `scaleY` clip-path fill from the
  bottom), then the card gets a subtle 3 D "tuck" as if slotted into a shelf,
  and a small ghost of the artwork flies to the Vault tab icon and is absorbed.
  `flyTo()` already exists in `micro.ts:145` and is used for pinning.
- **Like → the heart doesn't just pop, it *lands*.** A spring with a slight
  overshoot, a ring that expands and fades from the button, and 3 emoji already
  float. Add a 60 ms haptic double-tick and a `#ff5d7a` glow that decays.
- **Combo escalation** (brief §7) — tap the same item fast and the FX escalates
  ×2, ×3, ×5 "UNWELL". Cosmetic, so it never burns the 15/day laugh budget. The
  budget logic in `src/store` already separates `laughSpend` from the count, so
  this is safe.
- **Double-tap the artwork** — a big centered heart that scales 0 → 1.25 → 1
  with a shockwave ring. `bigHeart()` (`legacy.ts:698`) exists for the drop deck
  and is not wired to meme cards.
- **Undo as animation** — unsaving should play the fill in reverse and offer a
  4 s Undo, which `src/v5/vault.ts` already implements for the Vault.
- **Never regress Calm Mode.** `tests/e2e/motion.spec.ts` asserts every core
  interaction still lands its state with animation suppressed. Any new effect
  must route through `shouldAnimate()`.

---

## 6. Ideas beyond the list

Ranked by (impact ÷ effort), and all compatible with the no-fake-data rule:

1. **`Resonate on a show`** (§5.4). The concert screen's real product value is
   not tickets — it is that it converts a match into a plan with a date and a
   place. Nobody else can do this without your fingerprint data.
2. **Shared plan cards.** A concert or a table becomes a two-sided card: you
   propose, they accept, it appears in both stories with a countdown sticker.
   This is the "Direct to Date" move Hinge is testing, but earned through humor
   rather than a button.
3. **Blurhash everywhere.** Already computed, unused. Instant perceived perf on
   the feed, stories, Vault and profile wall.
4. **Retire the placeholder drop art** (§5.1.1). Highest visual payoff per line
   of code in the entire repo.
5. **Humor archetype as an identity flex.** 15 archetypes from the top two axes
   (brief §9.2). Computed from real reaction data, so no invented rarity
   percentages. Massive share loop; the OG card renderer already exists.
6. **Crew Fingerprint.** 2–4 friends, one link, a group fingerprint and
   superlatives. Non-dating, so people share it without stigma. Reuses the Duel
   link machinery in `src/duel/` almost entirely.
7. **Reaction receipts.** "You both 💀'd the same meme at 2am." A cheap, real
   opener generated from data you already store.
8. **Weekly recap as story slides.** Cultured Weekly, Spotify-Wrapped style,
   from `StoreState.reactions` — all real, all yours.
9. **Extract `legacy.ts`.** Not a feature, but every feature above gets slower
   and riskier the longer the 2,385-line `@ts-nocheck` seam owns the app.

---

## 7. Suggested build order

| # | Item | Effort | Depends on |
|---|---|---|---|
| 0 | ~~Meme images~~ | — | **done** |
| 1 | ~~Drop deck uses the real corpus; feed pagination + topic tabs on~~ | S | **done** — `src/screens/feed.ts`, plus three crashes fixed on the save path |
| 2 | ~~Save animation + like polish + combos~~ | S | **done** — combo moved to the card double-tap; a toggle can never escalate |
| 3 | ~~Share sheet: story / match / Web-Share file / placard card~~ | M | **done** — `src/lib/share.ts`, capability-probed; no button promises an Instagram Story |
| 4 | Stories: ~~`object-fit` fix~~, multi-slice, playback, drag stickers, blurhash | L | **partly done** — the crop is fixed. Note: the recorded diagnosis was wrong, `object-fit: cover` was already there; the real cause was `flex: 1` plus a composer at a third ratio |
| 5 | ~~Profile: prompt bank + humor cap + pronouns + lead photo + completeness~~ | M | **done** — `src/screens/profile.ts`. Not done: `ProfileTheme` in the store |
| 6 | ~~Concerts sub-page: adapter + Ticketmaster + seeded pack + UI~~ | L | **done** — `src/screens/live.ts`. No DB migration; Ticketmaster is a documented stub, booking is a deep link |
| 7 | ~~Dine-in sub-page: adapter + seeded pack + UI~~ | L | **done** — `src/screens/dining.ts`. Google Places replaced by Zomato/Swiggy deep links; neither has a public API |
| 8 | `legacy.ts` extraction, one screen at a time | XL | **in progress** — feed, Live, Dine-in, share, profile rules and combos are all out of it |
| 9 | ~~Perf: `fitMeme` layout thrash, `immutable` on un-hashed memes~~ | S | **done** |

S = a session, M = a day or two, L = several days, XL = the rest of the quarter.

**Done this session:** all of 0–7 and 9, plus the feed extraction from
`legacy.ts`. Test count went 407 → 576 across 25 → 32 files.
Also fixed along the way: `v5Resolve` out of scope (saving anything killed the
You tab), the Saved-culture grid reading resolved entries as ids, and
`burst()`'s unguarded `Element.animate` on the like path.

2–3 are self-contained and land visible wins without a backend. 4 and 5 are
self-contained but large. 6 and 7 need a Supabase project and real API keys
before they can be more than a seeded demo. 8 is the thing that makes all of it
cheaper.
