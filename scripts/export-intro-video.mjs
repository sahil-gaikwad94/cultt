/**
 * Exports public/assets/intro.mp4 from the Cold Open timeline.
 *
 *   CULTURED_BASE_URL=http://127.0.0.1:4176 node scripts/export-intro-video.mjs
 *
 * Records the timeline in capture mode (`?introCapture=1`, which renders the
 * visual beats with no words in frame) and transcodes it to a muted, 9:16,
 * H.264 +faststart MP4 under 1 MB. The result is the video-slot content, the
 * low-end-device fallback for the code timeline, and the marketing cut.
 *
 * The requirements this satisfies are the ones the slot declares: muted,
 * playsinline, 9:16, H.264 with faststart, at most 1 MB, no text in frame, and
 * the final frame written alongside as the poster.
 *
 * Requires: a running server, Playwright chromium, and ffmpeg on PATH.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.CULTURED_BASE_URL ?? 'http://127.0.0.1:4173';
const staging = resolve(root, 'node_modules/.cache/intro-recording');
const outDir = resolve(root, 'public/assets');

/** 9:16 at a size that upscales cleanly to a 390x844 device at 2x. */
const WIDTH = 540;
const HEIGHT = 960;
const MAX_BYTES = 1024 * 1024;

/** Must match COLD_OPEN_DURATION in src/motion/timeline.ts. */
const TIMELINE_MS = 11_400;
/** How long the settled frame is held after the timeline, before the take ends. */
const TAIL_MS = 1_000;
/** Kept to TIMELINE_MS so the clip and the code timeline are the same length. */
const KEEP_SECONDS = (TIMELINE_MS / 1000).toFixed(3);

const run = (file, args) =>
  execFileSync(file, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

console.log(`recording ${base}/?introCapture=1 at ${WIDTH}x${HEIGHT}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  // Playwright records the page to WebM; the video is transcoded below.
  recordVideo: { dir: staging, size: { width: WIDTH, height: HEIGHT } },
});
const page = await context.newPage();

await page.goto(`${base}/?introCapture=1`, { waitUntil: 'domcontentloaded' });
await page.locator('#onboard .co').waitFor({ state: 'visible', timeout: 20_000 });
await page.locator('.co-capture').waitFor({ state: 'attached', timeout: 10_000 });

// Give the timeline its full run, then a tail so the last frame is the settled
// state rather than a mid-transition one.
await page.waitForTimeout(TIMELINE_MS + TAIL_MS);

const video = page.video();
if (!video) throw new Error('Playwright did not record a video');
const recorded = await video.path();
await context.close();
await browser.close();

if (!existsSync(recorded)) throw new Error(`no recording at ${recorded}`);

/**
 * Where the intro starts inside the take.
 *
 * Playwright begins recording when the context is created, not when the intro
 * begins, so the take opens with however long the app took to boot (measured:
 * about 3s, plus a 1s tail held after the timeline). Shipping that would put
 * dead air in front of the first beat.
 *
 * This is computed rather than detected. A luma scan cannot find the boundary
 * reliably — the splash and the intro are both dark, so the brightness floor is
 * the same on both sides of it. But the intro's length and the tail are both
 * known by construction, so the intro is simply the last
 * (TIMELINE_MS + TAIL_MS) of the take. Deterministic, and it cannot drift.
 */
const takeDuration = Number(
  /duration=([0-9.]+)/.exec(
    run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1', recorded]),
  )?.[1] ?? '0',
);

const leadingTrim = Math.max(0, takeDuration - (TIMELINE_MS + TAIL_MS) / 1000);
console.log(
  `  take is ${takeDuration.toFixed(2)}s; intro occupies the last ` +
    `${((TIMELINE_MS + TAIL_MS) / 1000).toFixed(2)}s, trimming ${leadingTrim.toFixed(2)}s of boot`,
);

/** Transcodes, escalating CRF until the result fits the slot's 1 MB budget. */
const transcode = (crf) => {
  const target = resolve(outDir, 'intro.mp4');
  rmSync(target, { force: true });
  run('ffmpeg', [
    '-y',
    ...(leadingTrim > 0.05 ? ['-ss', leadingTrim.toFixed(3)] : []),
    '-i', recorded,
    '-t', KEEP_SECONDS,
    '-an',                                   // muted
    '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,fps=30`,
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-crf', String(crf),
    '-preset', 'slow',
    '-movflags', '+faststart',
    target,
  ]);
  return { target, bytes: statSync(target).size };
};

let crf = 30;
let result = transcode(crf);
while (result.bytes > MAX_BYTES && crf < 40) {
  crf += 2;
  console.log(`  ${(result.bytes / 1024 / 1024).toFixed(2)} MB over budget, retrying at crf ${crf}`);
  result = transcode(crf);
}

// Poster: the final frame, so the slot has an image before the video decodes.
run('ffmpeg', [
  '-y',
  '-sseof', '-0.1',
  '-i', result.target,
  '-frames:v', '1',
  '-q:v', '3',
  resolve(outDir, 'intro-poster.jpg'),
]);

// Also keep a WebM: it is smaller, and it is what the browser already knows.
run('ffmpeg', [
  '-y',
  ...(leadingTrim > 0.05 ? ['-ss', leadingTrim.toFixed(3)] : []),
  '-i', recorded,
  '-t', KEEP_SECONDS,
  '-an',
  '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,fps=30`,
  '-c:v', 'libvpx-vp9',
  '-crf', '38',
  '-b:v', '0',
  resolve(outDir, 'intro.webm'),
]);

const webm = statSync(resolve(outDir, 'intro.webm')).size;
const poster = statSync(resolve(outDir, 'intro-poster.jpg')).size;

/** Reads the moov atom position to prove faststart actually applied. */
const probe = run('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,duration',
  '-of', 'default=noprint_wrappers=1',
  result.target,
]).trim();

console.log('\nwrote public/assets/intro.mp4');
console.log(probe.split('\n').map((l) => `  ${l}`).join('\n'));
console.log(`  size      ${(result.bytes / 1024).toFixed(0)} KB ${result.bytes <= MAX_BYTES ? '(within 1 MB)' : '(OVER BUDGET)'}`);
console.log(`  webm      ${(webm / 1024).toFixed(0)} KB`);
console.log(`  poster    ${(poster / 1024).toFixed(0)} KB`);
console.log(`  clips     ${readdirSync(staging).length} raw recording(s) in staging`);

if (result.bytes > MAX_BYTES) {
  console.error('\nintro.mp4 exceeds the 1 MB slot budget');
  process.exitCode = 1;
}
