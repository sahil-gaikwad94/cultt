/**
 * PreviewProvider — the audio-calibration stub (brief §2.2).
 *
 * Spotify's `preview_url` was removed for new apps, so previews resolve from a
 * free no-auth source at play time (iTunes Search first, Deezer as backup) and
 * are cut to 7 or 15 seconds in the player. Nothing is hosted or re-streamed.
 *
 * This module is the seam: the offline build answers "no URL, but here is the
 * honest status line", and the waveform the user watches is drawn from the same
 * deterministic envelope the clip's cut point would use. When credentials and
 * a provider exist, `fetchPreview` is the one function that changes; every
 * caller only ever sees `PreviewResult`.
 */

export interface PreviewRequest {
  artist: string;
  title: string;
  /** Seconds the player wants; calibration uses 7, the feed cut uses 30. */
  seconds?: number;
}

export interface PreviewResult {
  ok: boolean;
  url: string | null;
  /** Where a resolved URL came from — also what attribution names. */
  source: 'itunes' | 'deezer' | 'cache' | 'none';
  /** Provider attribution, shown whenever a URL exists. Null is honest. */
  attribution: string | null;
  seconds: number;
  /** The status line the calibration row shows instead of a broken player. */
  status: string;
}

const CACHE_KEY = 'cultured2:previews';

const cache = (): Record<string, { url: string; attribution: string | null; at: number }> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<
      string,
      { url: string; attribution: string | null; at: number }
    >;
  } catch {
    return {};
  }
};

const remember = (id: string, url: string, attribution: string | null): void => {
  try {
    const all = cache();
    all[id] = { url, attribution, at: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* quota or private mode: caching is best effort */
  }
};

/** In production this hits iTunes Search (Deezer fallback) and caches the URL. */
export const fetchPreview = async (id: string, request: PreviewRequest): Promise<PreviewResult> => {
  const seconds = request.seconds ?? 7;
  const hit = cache()[id];
  if (hit) {
    return {
      ok: true,
      url: hit.url,
      source: 'cache',
      attribution: hit.attribution,
      seconds,
      status: 'Cached preview ready',
    };
  }
  // No provider is configured in the offline build. Saying so *is* the stub's
  // contract — a silent null is how a broken player hides.
  return {
    ok: false,
    url: null,
    source: 'none',
    attribution: null,
    seconds,
    status: `No audio source connected — the ${seconds}-second shape still shows where the clip lands`,
  };
};

/** Kept exported so the iTunes adapter can cache through the same key. */
export const rememberPreview = remember;
