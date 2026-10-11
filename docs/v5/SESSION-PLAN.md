# Session plan — home, social, and going out (Oct 2026)

Branch: `cline/1e0y2b3s`. Everything below is scoped to *this* session, is
implementable inside the existing architecture (Vite + strict TS, no framework,
one `localStorage` store, `Repo` boundary), and keeps the binding non-features
(no swipe-to-judge, no "who liked you" paywall, no guilt notifications, no face
grid, no unmoderated UGC).

## 0. What the owner asked for, restated

1. Expand the home feed.
2. Meme images are not rendering — the rights are purchased, so show them.
3. The meme share sheet must be real: story, send to match, Instagram story,
   Snapchat story, and more.
4. Rewind (home, day −1) becomes **Concerts in your area**, bookable through
   BookMyShow / SortMyScene. Redesign it: real concert energy, media, motion.
5. Tomorrow (home, day +1) becomes **Dine-in** — book a date through
   Zomato / Swiggy.
6. Stories should feel like Instagram: perfect fit, no stretch, real
   environment.
7. Better profile customization.
8. The app must be stronger, faster, and more efficient.
9. Like/save animations must be much better.

## 1. Root-cause notes found by reading the repo (not guessed)

| # | Finding | Evidence |
|---|---|---|
| 1 | **Every meme image 404s into the SPA fallback.** `adapt()` in `src/data/seed/memes.ts:73` prefers `meme.variants.at(-1)?.webp`, i.e. `/memes/gen/meme-01-480.webp`. `public/memes/gen/` is gitignored (`npm run content:memes` writes it) and is not in the tree, so the dev server answers `200 text/html` (index.html) for it and the `<img>` never decodes. Same bug in `src/v5/stories.ts` (×2), `src/v5/profile.ts` and `src/v5/home.ts`. | `curl -D- /memes/gen/meme-01-480.webp` → `200 Content-Type: text/html`; `/memes/meme-01.webp` → `200 image/webp` |
| 2 | All 20 memes are already `rightsCleared: true` in `src/content/memes.meta.json`, but `scripts/prune-demo-assets.mjs` still deletes `dist/memes` and the README/sources still say "unlicensed". | `memes.meta.json`, `prune-demo-assets.mjs`, `public/memes/README.md` |
| 3 | The home sub-pages are string templates in `src/legacy.ts` (`rewindHTML`, `draftHTML`, `tomorrowHTML`) rendered through `homeBodyHTML()` / `FT.day`; the v5 Home has a parallel, flag-gated set (`receipts/verdict/draft/forecast`). | `src/legacy.ts:513–600`, `src/v5/home.ts:845–911` |
| 4 | The share sheet is one `openSheet()` listing threads only (`ACT['mm-share']`); the deck's share is a bare `navigator.share`. | `src/legacy.ts:2189`, `src/v5/home.ts:452` |
| 5 | Stories already live in one reusable module (`src/v5/stories.ts`) used by both shells, but the viewer is a small centred card with `object-fit` unset — the stretch/fit complaint. | `src/v5/stories.ts:146–168` |
| 6 | Profile customization exists (tint, wall style, humor chips, artists, photos) but there is no accent/avatar/banner/status layer and no live preview. | `src/legacy.ts:1696–1720` |
| 7 | Like/save FX are already delegated through `data-fx` (`src/motion/micro.ts:328–429`); the ceiling is that `burst()` is 10 dots and `pin` is one card wobble. | `src/motion/micro.ts` |
| 8 | `renderYou()` re-renders the whole You tab on every like/save, from four handlers, even while the user is on the feed. | `src/legacy.ts:2183–2195`, `PERF_AUDIT.md` #5 |

## 2. Product decisions for this session

- **D-40 Going out is a first-class part of the home feed.** The home pager
  becomes `Concerts · Today · Dine-in`. `Today` keeps the deck; `−1` and `+1`
  are no longer "yesterday/tomorrow" trivia but *things to do with a match*.
- **D-41 Partners are adapters, not screenshots.** One module
  (`src/lib/partners.ts`) builds real, working deep links
  (`in.bookmyshow.com/explore/…`, `sortmyscene.com/search?q=…`,
  `zomato.com/city/restaurants?q=…`, `swiggy.com/search?query=…`) from a
  listing. When a provider key is absent the UI says "sample listing" instead of
  inventing availability, prices or ratings (honesty rule, D-27/D-30).
- **D-42 No invented social proof.** Concerts/dining catalogues are seeded
  editorial content (like `src/data/seed/tracks.ts`), never attributed to a real
  venue's live inventory, and never carrying fabricated "1.2k going" counts.
- **D-43 Sharing is honest or it is absent.** Each share row either performs the
  action (Web Share with a file, clipboard, `.ics` download, story insert,
  chat insert) or is not shown. Nothing toasts a share it did not do.
- **D-44 Stories are full-bleed 9:16 with `object-fit: contain`** over a blurred
  copy of the same frame, so nothing is ever stretched or cropped.
- **D-45 Feel is a module.** New `src/v5/feel.ts` owns the upgraded like/save
  choreography; `micro.ts` stays the dispatcher so every existing `data-fx`
  surface upgrades at once.


## 3. Better ideas worth building while we are in here

Ranked by (impact ÷ effort), all inside the current architecture:

1. **Ticket-stub reminder.** Saving a concert writes a real `.ics` ("Remind me")
   and a saved-shows shelf, so the page has an outcome, not just a browse.
2. **Date planner.** Dine-in is a *two-person* decision: pick cuisine → slot →
   party size, then either "Book on Zomato" or "Send as a plan" into the match
   thread. That is the loop the app is actually about.
3. **Shared plan state.** A booking/reminder is stored under
   `cultured@outings`, so the You tab can show "Your plans" honestly.
4. **Poster art, procedurally.** Every event gets a deterministic poster from
   the existing Contour/poster vocabulary, so the grid is vivid with zero
   licensed artwork and zero network.
5. **Countdown to doors.** Live `mm:ss` to doors open, plus an "add to
   calendar" affordance — the cheapest way to make a listing feel live.
6. **Story → concert/dine-in cross-post.** "Add to your story" from a listing
   turns a plan into something the user's matches can see, using the existing
   layer composition (no new store shape).
7. **Like choreography v2.** Particle ring + path-drawn heart + counter pop;
   save gets an elastic bookmark + shine sweep + fly-to-Vault. Reduced motion
   still lands the final state instantly.
8. **Feed paint hygiene.** `content-visibility` on feed sections, lazy You-tab
   re-render (dirty flag), IntersectionObserver video pause,
   `contain-intrinsic-size` so CLS stays 0.
9. **Share sheet as a component** (`src/v5/share.ts`) reused by deck, feed
   cards, profile and stories — one place to add a new destination.
10. **Stories environment**: blurred ambient backdrop, per-story progress
    segments, tap/hold, swipe-down dismiss, reply bar, and a compose preview
    that matches the viewer exactly (WYSIWYG).

## 4. File map

New:

```
src/lib/partners.ts        deep-link builders + provider state (BookMyShow, SortMyScene, Zomato, Swiggy)
src/lib/outings.ts         persisted saved events / reminders / bookings (localStorage, isolated)
src/lib/calendar.ts        .ics generation from a listing
src/lib/poster.ts          deterministic procedural poster + gradient art (SVG, offline)
src/data/seed/events.ts    concert catalogue
src/data/seed/dining.ts    restaurant catalogue
src/v5/concerts.ts(+css)   the Concerts sub-page
src/v5/dinein.ts(+css)     the Dine-in sub-page
src/v5/share.ts(+css)      the share sheet
src/v5/feel.ts(+css)       like/save choreography v2
src/v5/stories.css         the Instagram-grade story environment
```

Edited: `src/data/seed/memes.ts`, `src/content/index.ts`, `src/v5/stories.ts`,
`src/v5/profile.ts`, `src/v5/home.ts`, `src/legacy.ts`, `src/motion/micro.ts`,
`src/styles/app.css`, `scripts/prune-demo-assets.mjs`, `src/copy/index.ts`,
`docs/*`.

## 5. Verification contract for this session

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` must all
pass, and `npm run content:gate` must pass now that the memes are licensed. New
unit tests cover the meme URL resolver, the partner deep links, the `.ics`
builder, the outing store, the share-sheet destinations and the catalogue
shapes. Runtime budgets are re-measured and recorded in
`docs/v5/PERF_REPORT.md` (Chromium still cannot be installed in this sandbox —
that limitation is stated, not hidden).
