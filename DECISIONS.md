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
