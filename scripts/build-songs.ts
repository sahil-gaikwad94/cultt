/**
 * Song content pipeline (build brief §4.4).
 *
 *   node --experimental-strip-types scripts/build-songs.ts             # resolve + write
 *   node --experimental-strip-types scripts/build-songs.ts --offline   # no network
 *
 * Reads `v5Direction/songs_seed.csv` (208 tracks, 31 genres) and resolves each
 * one to a real 30-second preview and real artwork:
 *
 *   1. iTunes Search API  /search?term=…&entity=song&limit=5
 *   2. Deezer public API  /search?q=…            (fallback)
 *
 * Apple documents roughly 20 requests per minute, so this throttles to one
 * request per 3.2 s and backs off on 403/429. Deezer preview URLs expire, so
 * the client never uses them directly — it asks `/api/preview?id=…`, which
 * re-resolves and caches.
 *
 * Nothing is scraped from Spotify: it stopped returning `preview_url` to apps
 * registered after 27 Nov 2024, and its terms bar syncing its content with
 * visuals.
 *
 * Unresolved tracks are printed and written to `unresolved.txt` for manual
 * fixing. A track that cannot be resolved is written with `previewUrl: null`,
 * and the UI shows the copy deck's honest line rather than a dead link.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GENRE_SLUGS, genreName } from '../src/copy/taxonomy.ts';

const ROOT = process.cwd();
const CONTENT_DIR = process.env.CONTENT_DIR ?? join(ROOT, 'v5Direction');
const CSV_PATH = join(CONTENT_DIR, 'songs_seed.csv');
const OUT_DIR = join(ROOT, 'src', 'content');
const MANIFEST_PATH = join(OUT_DIR, 'songs.manifest.json');
const UNRESOLVED_PATH = join(ROOT, 'unresolved.txt');

/** Apple's documented ~20 req/min. 3.2 s leaves room for the Deezer fallback. */
const THROTTLE_MS = 3200;
const MAX_RETRIES = 3;

export interface SeedTrack {
  genre: string;
  title: string;
  artist: string;
  vibe: string;
}

export interface SongEntry extends SeedTrack {
  /** Stable id: genre + normalized title + artist. */
  id: string;
  genreName: string;
  trackId: string | null;
  provider: 'itunes' | 'deezer' | null;
  previewUrl: string | null;
  /** 600x600 artwork. iTunes URLs are upscaled by swapping the size segment. */
  artworkUrl: string | null;
  trackViewUrl: string | null;
  durationMs: number | null;
  resolved: boolean;
}

export interface SongManifest {
  version: number;
  generatedAt: string;
  count: number;
  resolvedCount: number;
  genres: { slug: string; name: string; count: number }[];
  items: SongEntry[];
}

/** Minimal CSV reader — the seed file has no quoted fields or embedded commas. */
export const parseCsv = (raw: string): SeedTrack[] => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim());
  const indexOf = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`songs_seed.csv is missing the "${name}" column`);
    return i;
  };
  const [gi, ti, ai, vi] = [indexOf('genre'), indexOf('title'), indexOf('artist'), indexOf('vibe')];

  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return {
      genre: (cells[gi] ?? '').trim(),
      title: (cells[ti] ?? '').trim(),
      artist: (cells[ai] ?? '').trim(),
      vibe: (cells[vi] ?? '').trim(),
    };
  });
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const trackIdFor = (track: SeedTrack): string =>
  `${track.genre}-${normalize(track.title).replace(/ /g, '-')}-${normalize(track.artist).replace(/ /g, '-')}`;

/** `100x100bb.jpg` → `600x600bb.jpg`. Returns the input untouched if absent. */
export const upscaleItunesArtwork = (url: string | null, size = 600): string | null =>
  url ? url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`) : null;

/** Title+artist match within a tolerance, so "good 4 u" still finds its track. */
export const isMatch = (
  candidate: { title: string; artist: string },
  wanted: { title: string; artist: string },
): boolean => {
  const a = normalize(candidate.title);
  const b = normalize(wanted.title);
  const ca = normalize(candidate.artist);
  const wa = normalize(wanted.artist);
  const titleOk = a === b || a.includes(b) || b.includes(a);
  const artistOk = ca === wa || ca.includes(wa) || wa.includes(ca) || ca.split(' ')[0] === wa.split(' ')[0];
  return titleOk && artistOk;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

interface FetchLike {
  (url: string, init?: { signal?: AbortSignal }): Promise<FetchResponseLike>;
}

export interface ResolveOptions {
  fetchImpl?: FetchLike;
  throttleMs?: number;
  log?: (line: string) => void;
  signal?: AbortSignal;
}

interface ItunesResponse {
  results?: {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
    trackTimeMillis?: number;
  }[];
}

interface DeezerResponse {
  data?: {
    id?: number;
    title?: string;
    artist?: { name?: string };
    preview?: string;
    album?: { cover_medium?: string; cover_big?: string };
    link?: string;
    duration?: number;
  }[];
}

/**
 * Resolves one track. Returns `null` when neither provider has it — the caller
 * records the miss honestly instead of inventing a URL.
 */
export const resolveTrack = async (track: SeedTrack, options: ResolveOptions = {}): Promise<SongEntry | null> => {
  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((url: string, init?: { signal?: AbortSignal }) => fetch(url, init) as Promise<FetchResponseLike>);
  const throttleMs = options.throttleMs ?? THROTTLE_MS;
  const log = options.log ?? (() => undefined);
  const query = encodeURIComponent(`${track.title} ${track.artist}`);

  const withRetry = async <T>(url: string, parse: (body: unknown) => T | null): Promise<T | null> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetchImpl(url, options.signal ? { signal: options.signal } : undefined);
        if (response.status === 403 || response.status === 429) {
          const backoff = throttleMs * attempt * attempt;
          log(`  ${response.status} — backing off ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        if (!response.ok) return null;
        const parsed = parse(await response.json());
        if (parsed) return parsed;
        return null;
      } catch {
        if (attempt === MAX_RETRIES) return null;
        await sleep(throttleMs * attempt);
      }
    }
    return null;
  };

  // 1. iTunes
  const itunes = await withRetry<NonNullable<ItunesResponse['results']>>(
    `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`,
    (body) => (body as ItunesResponse).results ?? null,
  );
  const itunesHit = itunes?.find((r) =>
    isMatch({ title: r.trackName ?? '', artist: r.artistName ?? '' }, track),
  );
  if (itunesHit?.trackId) {
    await sleep(throttleMs);
    return {
      ...track,
      id: trackIdFor(track),
      genreName: genreName(track.genre),
      trackId: String(itunesHit.trackId),
      provider: 'itunes',
      previewUrl: itunesHit.previewUrl ?? null,
      artworkUrl: upscaleItunesArtwork(itunesHit.artworkUrl100 ?? null),
      trackViewUrl: itunesHit.trackViewUrl ?? null,
      durationMs: itunesHit.trackTimeMillis ?? null,
      resolved: Boolean(itunesHit.previewUrl),
    };
  }

  // 2. Deezer
  const deezer = await withRetry<NonNullable<DeezerResponse['data']>>(
    `https://api.deezer.com/search?q=${query}&limit=5`,
    (body) => (body as DeezerResponse).data ?? null,
  );
  const deezerHit = deezer?.find((r) =>
    isMatch({ title: r.title ?? '', artist: r.artist?.name ?? '' }, track),
  );
  if (deezerHit?.id) {
    await sleep(throttleMs);
    return {
      ...track,
      id: trackIdFor(track),
      genreName: genreName(track.genre),
      trackId: String(deezerHit.id),
      provider: 'deezer',
      // Time-limited. The client re-resolves through /api/preview.
      previewUrl: deezerHit.preview ?? null,
      artworkUrl: deezerHit.album?.cover_big ?? deezerHit.album?.cover_medium ?? null,
      trackViewUrl: deezerHit.link ?? null,
      durationMs: deezerHit.duration ? deezerHit.duration * 1000 : null,
      resolved: Boolean(deezerHit.preview),
    };
  }

  await sleep(throttleMs);
  return null;
};

export interface BuildSongsOptions extends ResolveOptions {
  /** Skip all network calls; every track is written unresolved. */
  offline?: boolean;
}

export const buildSongs = async (options: BuildSongsOptions = {}): Promise<SongManifest> => {
  const log = options.log ?? (() => undefined);
  if (!existsSync(CSV_PATH)) throw new Error(`Missing ${relative(ROOT, CSV_PATH)}`);

  const seed = parseCsv(readFileSync(CSV_PATH, 'utf8'));
  const unknown = [...new Set(seed.map((s) => s.genre).filter((g) => !GENRE_SLUGS.includes(g)))];
  if (unknown.length) {
    throw new Error(`songs_seed.csv has genres missing from the copy deck: ${unknown.join(', ')}`);
  }

  const items: SongEntry[] = [];
  let index = 0;

  for (const track of seed) {
    index += 1;
    const id = trackIdFor(track);
    let entry: SongEntry | null = null;

    if (!options.offline) {
      log(`[${index}/${seed.length}] ${track.artist} — ${track.title}`);
      entry = await resolveTrack(track, options);
    }

    items.push(
      entry ?? {
        ...track,
        id,
        genreName: genreName(track.genre),
        trackId: null,
        provider: null,
        previewUrl: null,
        artworkUrl: null,
        trackViewUrl: null,
        durationMs: null,
        resolved: false,
      },
    );
  }

  const genreCounts = new Map<string, number>();
  for (const item of items) genreCounts.set(item.genre, (genreCounts.get(item.genre) ?? 0) + 1);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: items.length,
    resolvedCount: items.filter((i) => i.resolved).length,
    genres: GENRE_SLUGS.map((slug) => ({ slug, name: genreName(slug), count: genreCounts.get(slug) ?? 0 })),
    items,
  };
};

export const writeSongsManifest = (manifest: SongManifest): void => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const unresolved = manifest.items.filter((i) => !i.resolved);
  writeFileSync(
    UNRESOLVED_PATH,
    unresolved.length
      ? `${unresolved.map((i) => `${i.genre}\t${i.title}\t${i.artist}`).join('\n')}\n`
      : '',
    'utf8',
  );
};

const main = async (): Promise<void> => {
  const offline = process.argv.includes('--offline');
  const manifest = await buildSongs({ offline, log: (line) => process.stdout.write(`${line}\n`) });
  writeSongsManifest(manifest);
  process.stdout.write(
    `wrote ${relative(ROOT, MANIFEST_PATH)} — ${manifest.resolvedCount}/${manifest.count} resolved` +
      `${manifest.count - manifest.resolvedCount ? ` (${relative(ROOT, UNRESOLVED_PATH)})` : ''}\n`,
  );
  if (offline) {
    process.stdout.write(
      '\n--offline: no provider was contacted, so every track is written unresolved.\n' +
        'Run without the flag on a machine with network to resolve artwork and previews.\n',
    );
  }
};

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
