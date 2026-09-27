# Cultured — Culture-Based Dating App — Coding Agent Build Prompt

## PROJECT
"Cultured" — culture-based dating app, web prototype

## CONTEXT
A dating app that matches people on humor style and music taste before
showing a photo. Core loop: Culture Feed (browse memes/tracks, purely
passive, no evaluation UI) feeds a "humor vector" and "music vector" per
user, which the Match Matrix (the actual swiping/evaluating screen) reads
from. Every match card shows a "Taste Twins" compatibility score before a
decision is made — the score is the hook, not the photo.

## STACK
- Framework: Next.js 15 (App Router), TypeScript, most interactive
  screens `'use client'`
- Styling: Tailwind CSS v4, design tokens as CSS variables
- Components: shadcn/ui (Radix primitives) as the base layer — restyled
  to the tokens below, don't ship the default shadcn look
- Animation: `motion` (the Framer Motion successor package) for gestures,
  layout animations, and `AnimatePresence` route/tab transitions
- Scroll & sequence animation: GSAP + ScrollTrigger for onboarding
  parallax and Feed reveal choreography
- Smooth scroll: Lenis, wrapping the Culture Feed and any long list
- Micro-interactions: lottie-react for the match-celebration burst and
  like/Resonate pop effects
- One signature 3D moment: React Three Fiber + drei — a slowly rotating
  vinyl record or floating meme-card cluster behind the onboarding
  welcome headline. This is the ONLY 3D surface in the app — don't spread
  WebGL across multiple screens, it should read as one deliberate flourish
- State: Zustand for onboarding progress, match queue, feed cursor
- Fonts: `next/font/google` for Fraunces (display) + Inter (UI), no FOUT
- Icons: lucide-react, outline only, never filled
- Deploy target: Vercel
- No backend: a single `src/lib/mockData.ts`, shapes defined below

## PACKAGES
```
next react react-dom typescript tailwindcss motion gsap lenis
lottie-react three @react-three/fiber @react-three/drei zustand
lucide-react shadcn (via CLI, not npm install)
```

## DESIGN TOKENS

**Colors:**
```
--bg: #14120E        (app background, warm near-black)
--surface: #1D1A15   (cards)
--surface-2: #26221B (nested surfaces, chips)
--border: rgba(245,241,234,0.09)
--text: #F5F1EA
--text-dim: #A39C8E
--text-faint: #6D675B
--accent: #FF6B4A    (single accent color — CTAs, active states,
                       the Taste Twins fill, used sparingly)
```

**Typography:**
- Display/headings: Fraunces, weight 500 — names, screen titles, the
  humor-summary line
- UI/body: Inter, weight 400/500 — everything else

**Radius:** 12px small elements, 20-26px cards, 999px pills
**Spacing scale:** 4/8/12/16/20/24/32px

## GLOBAL SHELL
Bottom tab bar, 4 tabs: Feed, Matrix, Chat, Profile (icon + label). No
hamburger menu. Safe-area padding at top/bottom; skip real device chrome.
Tab switches crossfade via `AnimatePresence`.

## SCREENS

### 1. Onboarding (one step per screen, progress dots at top)
a. **Welcome carousel** (3 slides) — "match on your humor, not your
   headshot" — muted looping ambient video behind the headline on each
   slide (`autoPlay muted loop playsInline`, poster fallback), GSAP
   parallax shifting video slower than text on swipe; the R3F
   rotating-vinyl/meme-cluster scene sits behind/around this text
b. **Auth** — phone/email + 18+ age gate (client-side format check only)
c. **Photo verification** — stub: camera icon, "liveness check" copy,
   fake 2s delay into a "Verified" success state
d. **Spotify connect** — OAuth button (stub), skip option with manual
   genre-tag multi-select fallback
e. **Meme calibration** — swipeable stack, 6-8 mock cards (flat
   gradient placeholders, not real images), like/skip via drag or
   buttons, progress bar fills as they go
f. **Music calibration** — 6 short track cards, same swipe pattern as (e)
g. **Photos & bio** — 2-6 photo upload slots (placeholder squares),
   name/age/location, Dating vs Friends toggle
h. **Permission asks** (notifications, location) — last, after value is
   shown, simple allow/skip modals

### 2. Culture Feed (default landing tab)
Lenis-smoothed infinite vertical scroll, three interleaved card types:
- **Daily Drop** (pinned once/day): meme + track tile side by side,
  accent border with a slow idle glow pulse (opacity 0.4→0.8, 3s loop)
- **Meme card**: avatar, name, location, timestamp, gradient placeholder
  "image," caption, reaction row (like, laugh-react as a DISTINCT icon
  from like, comment count, share, save)
- **Track card**: album-art placeholder, title/artist, play button that
  toggles a canvas/SVG waveform animation (see Motion System), "N nearby
  vibe with this" link

Cards fade+rise into view on scroll (`whileInView`).

**HARD RULE:** no swipe-to-judge-a-person gesture anywhere here, no "who
liked you" prompt. Browse-only, always.

### 3. Match Matrix
Single-candidate card stack, one card visible with the next peeking
behind it. Card contents:
- Photo area (placeholder gradient), name/age, distance
- Taste Twins score badge, top corner (e.g. "87% taste twins")
- 1-2 shared-signal chips (shared artist, shared meme category)
- Expand affordance into the full Fingerprint before deciding — no
  forced blind swiping; use `layoutId` so the photo morphs directly into
  the expanded view, no hard cut
- Actions: pass (X), Resonate (super-like, limited daily count,
  accent-filled), rewind (undo last pass)

Dual-mode toggle (Dating/Friends) persistent at top.

**Empty state:** never a dead "no more profiles" screen — point back to
the Feed ("your fingerprint gets stronger the more you're there").

**Drag interaction:** `useMotionValue` + `useTransform` tying x-offset to
rotation (±15deg) and like/pass stamp-overlay opacity; velocity-based
fling-away on release, spring snap-back if released short of threshold.

**Match celebration (THE signature motion moment):** full-screen overlay,
both avatars slide together from opposite edges and orbit the Taste
Twins score as it counts up, Lottie particle burst in accent color,
scale-pulse on "It's a resonance." Spend most of the animation budget
here — everything else stays comparatively restrained.

### 4. Cultural Fingerprint (own profile + read-only view of a match's)
Tabbed: Photos / Fingerprint (default) / Prompts

**Fingerprint tab:**
- Humor style as 4 horizontal bars (Affiliative, Self-enhancing,
  Aggressive, Self-defeating), one-line Fraunces-italic summary below
  (e.g. "leans affiliative and self-enhancing")
- Top 5 artists (horizontal scroll, circular avatars)
- 3 pinned playlists (title + track count)
- "Recently vibed" — 5 small meme thumbnails
- Taste Twins preview — blurred/locked, "unlocks when you match"
  (candidate view only, not on your own profile)

Privacy toggle at top: "show fingerprint to matches only" vs "visible
before matching"

### 5. Chat + Listening Session
Standard message thread. Header has a "Listen together" icon opening a
Listening Session panel: track picker, animated waveform scrubber
(canvas/SVG bars driven by a mock amplitude array on
`requestAnimationFrame`, actually starts/stops on play/pause — NOT a
video), timestamped emoji reactions, a session timer counting up to a
15-minute free-tier cap with an upsell chip after. Auto-attach the
shared meme/track that triggered the match as the first bubble.

### 6. Notifications
One tab, three visually separated sections: Matches & messages / Feed
activity / Fingerprint updates. Fingerprint nudges are light and
dismissible, never re-engagement guilt-trips ("3 people are waiting!").

### 7. Settings
Grouped list: Discovery preferences, Cultural data controls (reconnect
Spotify, edit genre tags, reset fingerprint), Anti-genre filters,
Privacy, Verification, Subscription, Notifications, Account
(deactivate/delete).

## MOCK DATA SHAPES (`src/lib/mockData.ts`)
```ts
candidate    = { id, name, age, distanceKm, tasteScore, sharedArtist,
                 sharedMemeCategory, photoGradient }
feedPost     = { id, type: 'meme'|'track'|'drop', author, location,
                 timeAgo, caption, likeCount, laughCount,
                 commentCount, gradient }
track        = { id, title, artist, gradient }
fingerprint  = { humor: { affiliative, selfEnhancing, aggressive,
                 selfDefeating }, summary, topArtists[], playlists[],
                 recentMemes[] }
```

## MOTION SYSTEM (apply globally)
- Respect `prefers-reduced-motion` everywhere via a `useReducedMotion`
  wrapper hook — zero durations and disable parallax/3D when set, wired
  in from the first component, not bolted on later
- Default spring for interactive elements: `{ type: "spring", stiffness:
  300, damping: 30 }`. Default ease for fades: `easeOut`, 200-300ms
- Route/tab transitions: `AnimatePresence` — tabs crossfade; drill-into-
  detail screens (Fingerprint, candidate detail) slide in from the right
  while the previous screen scales back slightly and dims
- Buttons: `scale(0.96)` on press via Motion `whileTap`, not CSS `:active`
- Loading states: shimmer skeletons (animated gradient sweep), never a
  bare spinner or blank screen

## VIDEO USAGE (specific, not decorative-everywhere)
- Onboarding welcome carousel ONLY gets background video, per screen 1a
- The Listening Session waveform is animated canvas/SVG, never video
- Nowhere else autoplays video — a feed full of background video is a
  performance and battery problem, not a startup flex

## PERFORMANCE GUARDRAILS
- Animate only `transform`/`opacity` — never `width`/`height`/`top`/`left`
  for drag or scroll effects
- Lazy-load the R3F canvas (dynamic import, `ssr: false`) so it never
  blocks first paint
- Feed content below the fold uses `content-visibility: auto`
- Target: interaction-to-next-paint under 200ms on the Match Matrix drag

## PRODUCT CONSTRAINTS (do not violate)
- Never gate seeing likes or sending a first message behind a paywall
- Never mix feed-browsing UI with match-evaluation UI on the same screen
- Never show a blank "no more profiles" dead-end
- No dark-pattern re-engagement copy
- No filled icons, no gradients on UI chrome outside designated photo/
  art placeholder tiles, one accent color only

## BUILD ORDER
1. Next.js app shell + design tokens + fonts + bottom nav + routing
2. Culture Feed (establishes card patterns, Lenis, scroll reveals)
3. Match Matrix (drag interaction, layoutId expansion, celebration moment)
4. Cultural Fingerprint
5. Onboarding flow (video + R3F + GSAP parallax)
6. Chat/Listening Session, Notifications, Settings
