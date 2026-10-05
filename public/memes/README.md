# In-house meme layer

The feed bundles 20 image memes under `/memes/*.webp`, so users see them without leaving the app or depending on remote image URLs. Files are optimized to WebP, max 1080px wide, and lazy-loaded in the Culture Feed and chat picker.

`/memes/sources.json` records the public web source context collected for this build. These assets should be reviewed for redistribution rights before any public launch; the local bundle is intentionally isolated so the source layer can be replaced by a licensed corpus later.
