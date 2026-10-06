# intro video prompts

Four shots for an external video model, matching the beats of the Cold Open in
`src/motion/timeline.ts`. Use these to produce a replacement for
`public/assets/intro.mp4` — the file the video slot plays when it exists.

## Slot requirements

Whatever comes back must satisfy all of these, or the slot rejects it:

| Constraint | Value |
|---|---|
| Aspect | 9:16, vertical |
| Resolution | 540 x 960 minimum, 1080 x 1920 preferred |
| Codec | H.264, `yuv420p`, `+faststart` |
| Audio | none — the file is muted |
| Size | **at most 1 MB** |
| Text in frame | **none.** The app overlays its own live text |
| Faces | **none.** This is a claim about the product, not about people |
| Poster | the final frame, exported separately |

Transcode with:

```sh
ffmpeg -i raw.mov -an -vf "scale=540:960:flags=lanczos,fps=30" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 30 -preset slow \
  -movflags +faststart public/assets/intro.mp4
```

The reference export measures 120 KB for 14 seconds at CRF 30, so there is
plenty of headroom under the 1 MB budget and the CRF can be lowered to about 24
if the model's output is noisier than the code timeline.

## Brand style line

Use this as the style suffix on every shot:

> Deep matte black background (#0A0A09). A single warm bone-white line (#EFE9DA).
> Two accents only: coral #ff5d7a and amber #ffd166. Fine film grain across the
> whole frame. Slow, deliberate camera. No text, no logos, no people, no faces,
> no hands. Drawn-line motion-graphics aesthetic, not photographic. Everything
> dark, nothing glossy, nothing purple.

## The four shots

**Shot 1 — the ring draws itself.** 0.0-1.5s. A single bone-white circle
inscribes itself on black, line drawing clockwise from the top, slight
acceleration then ease. Film grain is visible throughout. The frame is 95% empty
black. Camera locked. Loop-safe beginning.

**Shot 2 — the ring becomes a record, the record becomes a fingerprint.** 
1.5-3.5s. The circle thickens and multiplies into seven concentric grooves, two
of them amber, as if a record were resolving out of the line. Then the grooves
ripple inward and their geometry becomes irregular — the contours of a
fingerprint, still drawn as clean vector lines. No literal object, no turntable,
no hand. Camera locked.

**Shot 3 — the split.** 3.5-6.2s. The fingerprint peels into two halves that
separate horizontally, each carrying a blank rectangular card of warm amber and
coral. The cards have no readable text on them — leave the faces clean and
abstract, a suggestion of typographic linework at most. Camera locked, halves
drifting at a slight opposing tilt.

**Shot 4 — the weave and the heart.** 6.2-11.0s. The two halves glide back
toward each other. Two thin ribbons — one coral, one amber — rise from the
seam and intertwine in a slow double helix across the frame, like a sound wave
turning into a braid. As they settle, a small coral heart shape pulses once,
gently, and the whole frame pushes in very slowly, about four percent over three
seconds. Hold on the settled composition for the final second so the poster
frame is stable.

## Notes

- The code timeline remains the source of truth. If a shot here disagrees with
  `BEAT` in `src/motion/timeline.ts`, the code wins and this document is wrong.
- No shot may imply other users. There is no crowd, no grid of faces, no
  counter, no map, no phone showing a notification. The intro makes a claim about
  how the product matches, and claims nothing about how many people are on it.
- Shot 4's settled frame is what becomes `public/assets/intro-poster.jpg`.
