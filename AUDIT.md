# Step 0 audit

## Product surface

The prototype has four persistent screens: **Culture Feed** (`#s-feed`), **Match Matrix** (`#s-match`), **People and chat** (`#s-people`), and **Cultural Fingerprint** (`#s-you`). Overlays include splash, onboarding, sheet, full-page detail/profile/settings, mutual-match moment, comments/share sheets, and 15-minute listening-room/session views.

## State and storage

- `S` is the single prototype state object, persisted through `cultured2:state`.
- `store` also owns the `cultured2:*` namespace and clears only that namespace.
- Major state groups: profile, intent/lens, reactions, comments, decisions/history, threads/messages, listening-room preferences, settings/quiet hours, dismissed activity, meme shelf, onboarding completion.
- `src/data/mockRepo.ts` adds `cultured2:repo-events` as an append-only local adapter trace. Production must replace it with RLS-protected RPCs.

## Fake data → production boundary

| Prototype data | Production replacement |
| --- | --- |
| `TRACKS`, `MEMES` | normalized `tracks`, `memes`/seed pack |
| `PEOPLE` | candidate query + Taste Twins score |
| `DROPS` | `daily_drops` + local-time scheduler |
| `CIRCLE`, `YEST` | circle posts and feed events |
| `S.threads` | match/thread/message tables + realtime |
| `S.prof` | profile, artists, playlists, prompts, photos |
| `S.react` | `rpc/react` + events/vector update |

## Design tokens and visual system

The original v3 variables are preserved in `src/styles/app.css` and documented as a small token entrypoint in `src/styles/tokens.css`: warm ink, bone, coral, yellow, Bricolage Grotesque, large soft cards, glass controls, and transform/opacity-only motion. Procedural posters, fingerprints, palettes, stickers, grain, and ambient tints remain in the seam.

## Dependencies and external calls

The prototype had no runtime dependency beyond Google Fonts. The app now adds Vite, TypeScript, ESLint, Prettier, Vitest, and Playwright as development tooling. No API keys are included. The mock repo is the default.

## Accessibility / motion observations

Focus-visible styles, semantic buttons, labels, `aria-pressed`, reduced-motion CSS, safe-area insets, and 44px-class controls are already present. Follow-up work should audit dynamic focus trapping, keyboard traversal in sheets, and large-text overflow on every full-page state.
