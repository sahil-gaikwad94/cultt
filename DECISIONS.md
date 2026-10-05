# Decisions

## 2026-10-05 — preserve the seam, add a typed boundary

**Options:** rewrite into a framework; split all screens immediately; isolate the current seam behind Vite and migrate incrementally.

**Pick:** isolate and migrate incrementally. The seam is the visual contract; a rewrite would create avoidable pixel and interaction regressions. Vanilla TypeScript keeps the bundle small and honors the brief.

## 2026-10-05 — offline-first repo selection

**Options:** hard-code localStorage; block the app until Supabase exists; expose a `Repo` interface with mock and Supabase adapters.

**Pick:** the adapter interface. It lets the product be tested offline while making backend ownership explicit. No secrets or provider-specific data are exposed to screens.

## 2026-10-05 — procedural art remains default

**Options:** download or generate image assets; redraw the art; keep the existing deterministic generators and add a manifest override.

**Pick:** keep procedural art. It matches the brand, is free to host, avoids copyright risk, and preserves the visual baseline.

## 2026-10-05 — safety/legal UI before provider wiring

The Phase 1 screens can be designed and exercised against the mock adapter now. Legal copy is marked for lawyer review; destructive deletion is modeled as a 14-day cooling-off request, not an irreversible client-side wipe.

## 2026-10-06 — architecture-aligned experience pass

- v3 remains the visual reference, not a frozen product boundary. The front-end now adds an architecture-aligned 9-step onboarding funnel, a persistent preview player, stronger Daily Drop hierarchy, tactile ripples, pointer-aware card glare, and generated-media slot layers.
- Onboarding provider actions are adapter-ready: email/Apple/Google auth, photo check, Last.fm/Apple Music/Spotify selection, audio calibration, permissions, and server-side age enforcement are represented in UI state but must be connected to Supabase/native providers before release.
- “Photo checked” is used instead of “verified identity”, following the brief’s liveness caveat.
- Motion stays code-driven and low-cost. Generated raster media remains scenery behind the interface; reduced-motion and Calm Mode disable background drift and animated calibration treatments.
- The free-plan video generation attempt was not shipped because the selected model required more credits than available. Matrix retains its poster/fallback slot and can accept a future video asset without a screen redesign.

## 2026-10-06 — signature loop surfaces

- The mutual-match moment is code-driven: a live pair fingerprint, staged coral/yellow particles, haptic success pattern, and a clear “Say hi” decision. No video or baked text is required.
- Chat now exposes Icebreaker Roulette as an optional opener generator. It uses a shared artist or cultural prompt and sends only after an explicit user action.
- Fingerprint sharing now previews a live-data Taste Card with the current fingerprint, humor signals, artists, saved meme tiles, and watermark/CTA language. Server-side SVG/PNG rendering remains the production adapter responsibility.
