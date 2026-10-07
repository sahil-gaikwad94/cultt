/**
 * Meme content pipeline (build brief §4.3).
 *
 *   node --experimental-strip-types scripts/build-memes.ts            # build
 *   node --experimental-strip-types scripts/build-memes.ts --gate     # rights gate only
 *
 * Scans `public/memes/` for real image and video memes, and for each one
 * produces:
 *
 *   - AVIF + WebP at 480 / 960 / 1440 px, into `public/memes/gen/` (gitignored)
 *   - a poster frame for videos
 *   - dominant colour, blurhash, intrinsic size, video duration
 *   - an entry in `src/content/memes.manifest.json`
 *
 * Per-meme overrides live in `src/content/memes.meta.json` (title, category,
 * mood, axis, placard, credit, rightsCleared).
 *
 * BUILD GATE: the production build fails if any meme has `rightsCleared !== true`.
 * Override with `ALLOW_UNLICENSED=1`. Every meme in the repo today is
 * unlicensed web-search material (see `public/memes/sources.json`), so the gate
 * fires by design — that is the point of it.
 *
 * Run with `--gate` to check rights without touching any file; that is what
 * `npm run build` calls.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { encodeBlurhash } from './lib/blurhash.ts';
import { MEME_CATEGORY_SLUGS, HUMOR_AXES } from '../src/copy/taxonomy.ts';
import { impactLine } from '../src/copy/index.ts';

const ROOT = process.cwd();
const CONTENT_DIR = process.env.CONTENT_DIR ?? join(ROOT, 'v5Direction');
const MEME_DIR = join(ROOT, 'public', 'memes');
const GEN_DIR = join(MEME_DIR, 'gen');
const META_PATH = join(ROOT, 'src', 'content', 'memes.meta.json');
const MANIFEST_PATH = join(ROOT, 'src', 'content', 'memes.manifest.json');

const WIDTHS = [480, 960, 1440] as const;
const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

export interface MemeMeta {
  title?: string;
  category?: string;
  mood?: string;
  axis?: (typeof HUMOR_AXES)[number];
  placard?: string;
  credit?: string;
  rightsCleared?: boolean;
}

/* The manifest shapes live in src/content/types.ts so the app never imports
   from the pipeline. Re-exported here for the script's own callers. */
import type { MemeEntry, MemeManifest } from '../src/content/types.ts';
export type { MemeEntry, MemeManifest, MemeVariant } from '../src/content/types.ts';

const readFile = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf8') : null);

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** `/memes/x.webp` — the browser-facing path for a file under `public/`. */
const publicPath = (absolute: string): string => `/${relative(join(ROOT, 'public'), absolute).split('\\').join('/')}`;

const hashOf = (value: string): string => createHash('sha1').update(value).digest('hex').slice(0, 12);

/** Deterministic mood from the id, so re-running the pipeline never reshuffles. */
const MOODS = ['Existential', 'Feral', 'Unbothered', 'Slightly unhinged', 'Serene', 'Caffeinated', 'Nostalgic'] as const;
const moodFor = (id: string): string => MOODS[parseInt(hashOf(id).slice(0, 4), 16) % MOODS.length];

const toHex = (rgb: { r: number; g: number; b: number }): string =>
  `#${[rgb.r, rgb.g, rgb.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Video duration without pulling in ffprobe: reads the mp4 `mvhd` atom. */
const mp4DurationMs = (file: string): number | null => {
  try {
    const buffer = readFileSync(file);
    const index = buffer.indexOf('mvhd', 0, 'latin1');
    if (index < 0) return null;
    const version = buffer[index + 4];
    let timescale: number;
    let duration: number;
    if (version === 1) {
      timescale = buffer.readUInt32BE(index + 24);
      duration = Number(buffer.readBigUInt64BE(index + 28));
    } else {
      timescale = buffer.readUInt32BE(index + 16);
      duration = buffer.readUInt32BE(index + 20);
    }
    if (!timescale || !duration) return null;
    return Math.round((duration / timescale) * 1000);
  } catch {
    return null;
  }
};

interface SourceRecord {
  file: string;
  source?: string;
  title?: string;
}

const readSources = (): Record<string, SourceRecord> => {
  const raw = parseJson<{ items?: SourceRecord[] }>(readFile(join(MEME_DIR, 'sources.json')), {});
  const out: Record<string, SourceRecord> = {};
  for (const item of raw.items ?? []) out[item.file] = item;
  return out;
};

export interface BuildOptions {
  /** Skip variant generation (used by `--gate` and by tests). */
  variants?: boolean;
  allowUnlicensed?: boolean;
  log?: (line: string) => void;
}

export interface BuildResult {
  manifest: MemeManifest;
  unlicensed: string[];
  wroteManifest: boolean;
}

/**
 * Scans and builds. Pure apart from the file writes, which are skipped when
 * `variants` is false — that is what makes it testable.
 */
export const buildMemes = async (options: BuildOptions = {}): Promise<BuildResult> => {
  const log = options.log ?? (() => undefined);
  const withVariants = options.variants ?? true;
  const allowUnlicensed = options.allowUnlicensed ?? process.env.ALLOW_UNLICENSED === '1';

  if (!existsSync(MEME_DIR)) throw new Error(`No meme folder at ${MEME_DIR}`);

  const meta = parseJson<Record<string, MemeMeta>>(readFile(META_PATH), {});
  const sources = readSources();

  const files = readdirSync(MEME_DIR)
    .filter((name) => {
      const lower = name.toLowerCase();
      const ext = lower.slice(lower.lastIndexOf('.'));
      return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
    })
    .sort();

  if (withVariants) {
    if (existsSync(GEN_DIR)) rmSync(GEN_DIR, { recursive: true, force: true });
    mkdirSync(GEN_DIR, { recursive: true });
  }

  const items: MemeEntry[] = [];

  for (const file of files) {
    const absolute = join(MEME_DIR, file);
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    const isVideo = VIDEO_EXT.has(ext);
    const base = file.slice(0, file.lastIndexOf('.'));
    const id = `meme-${hashOf(base)}`;
    const override = meta[file] ?? meta[base] ?? meta[id] ?? {};
    const source = sources[file];

    const entry: MemeEntry = {
      id,
      kind: isVideo ? 'video' : 'image',
      src: publicPath(absolute),
      title: override.title ?? source?.title ?? base.replace(/[-_]+/g, ' '),
      category: override.category ?? 'main-character',
      mood: override.mood ?? moodFor(id),
      axis: override.axis ?? 'absurdist',
      placard: override.placard ?? impactLine(id),
      alt: '',
      credit: override.credit ?? source?.source ?? null,
      rightsCleared: override.rightsCleared === true,
      width: 0,
      height: 0,
      bytes: statSync(absolute).size,
      dominant: null,
      blurhash: null,
      durationMs: null,
      poster: null,
      variants: [],
    };

    if (!MEME_CATEGORY_SLUGS.includes(entry.category)) {
      throw new Error(`${file}: category "${entry.category}" is not one of the 15 display categories`);
    }
    if (!HUMOR_AXES.includes(entry.axis)) {
      throw new Error(`${file}: axis "${entry.axis}" is not one of the six humor axes`);
    }

    if (isVideo) {
      entry.durationMs = mp4DurationMs(absolute);
    } else {
      const image = sharp(absolute);
      const metadata = await image.metadata();
      entry.width = metadata.width ?? 0;
      entry.height = metadata.height ?? 0;

      /* Dominant colour + blurhash from one small decode. `ensureAlpha()` is
         load-bearing: the blurhash encoder reads an RGBA stride of 4, and
         `removeAlpha()` would hand it a 3-byte stride — every pixel then reads
         past its own row and the hash comes out as "undefined" repeated. */
      const { data, info } = await image
        .resize({ width: 32, height: 24, fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (info.channels !== 4) throw new Error(`${file}: expected 4 channels, got ${info.channels}`);
      entry.blurhash = encodeBlurhash({ width: info.width, height: info.height, data }, 4, 3);

      let r = 0;
      let g = 0;
      let b = 0;
      const pixels = info.width * info.height;
      for (let i = 0; i < pixels; i += 1) {
        r += data[i * 4];
        g += data[i * 4 + 1];
        b += data[i * 4 + 2];
      }
      entry.dominant = toHex({ r: r / pixels, g: g / pixels, b: b / pixels });

      if (withVariants) {
        for (const width of WIDTHS) {
          if (entry.width && width > entry.width) continue;
          const avifName = `${base}-${width}.avif`;
          const webpName = `${base}-${width}.webp`;
          await image
            .resize({ width, withoutEnlargement: true })
            .avif({ quality: 62, effort: 4 })
            .toFile(join(GEN_DIR, avifName));
          await image
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 78, effort: 4 })
            .toFile(join(GEN_DIR, webpName));
          entry.variants.push({ width, avif: publicPath(join(GEN_DIR, avifName)), webp: publicPath(join(GEN_DIR, webpName)) });
        }
      }
    }

    // The placard is the alt text: §11 requires placard text as alt text.
    entry.alt = `${entry.title}. ${entry.placard}`;
    items.push(entry);
  }

  const manifest: MemeManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: items.length,
    categories: [...new Set(items.map((i) => i.category))].sort(),
    items,
  };

  const unlicensed = items.filter((i) => !i.rightsCleared).map((i) => i.src);

  log(`memes: ${items.length} scanned, ${items.filter((i) => i.kind === 'video').length} video`);
  if (withVariants) log(`memes: variants written to ${publicPath(GEN_DIR)}`);

  if (unlicensed.length && !allowUnlicensed) {
    throw new Error(
      [
        `${unlicensed.length} of ${items.length} memes are not rights-cleared:`,
        ...unlicensed.map((src) => `  - ${src}`),
        '',
        'Mark them cleared in src/content/memes.meta.json once you own the rights,',
        'or override for a local build with ALLOW_UNLICENSED=1.',
      ].join('\n'),
    );
  }
  if (unlicensed.length) log(`memes: WARNING ${unlicensed.length} unlicensed items shipped under ALLOW_UNLICENSED=1`);

  return { manifest, unlicensed, wroteManifest: false };
};

/** Writes the manifest. Kept separate so tests can build without writing. */
export const writeManifest = (manifest: MemeManifest): void => {
  mkdirSync(join(ROOT, 'src', 'content'), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

const main = async (): Promise<void> => {
  const gateOnly = process.argv.includes('--gate');
  const result = await buildMemes({ variants: !gateOnly });
  if (!gateOnly) {
    writeManifest(result.manifest);
    process.stdout.write(`wrote ${relative(ROOT, MANIFEST_PATH)} (${result.manifest.items.length} items)\n`);
  }
};

// Referenced so the content dir is part of the pipeline contract even when the
// meme scan does not read from it (the song pipeline does).
void CONTENT_DIR;

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
