/**
 * `/api/preview?id=…` — Vercel function (build brief §4.4).
 *
 * Music previews are fetched through here rather than baked into the manifest
 * for one reason: **Deezer preview URLs expire.** iTunes ones are stable but
 * still move. The client asks this endpoint on every play and keeps a short
 * in-memory cache, so a track that resolved yesterday still plays today.
 *
 * Never cached with auth, never proxied into WebAudio (cross-origin audio
 * returns silence there) — the client draws its waveform procedurally instead.
 */

interface VercelRequest {
  query: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

interface ItunesLookup {
  results?: { trackId?: number; previewUrl?: string; artworkUrl100?: string; trackViewUrl?: string }[];
}

interface DeezerTrack {
  id?: number;
  preview?: string;
  album?: { cover_big?: string; cover_medium?: string };
  link?: string;
}

const upstream = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json();
};

/** Re-resolves a track to a currently-valid preview URL. */
export const resolvePreview = async (
  provider: 'itunes' | 'deezer',
  trackId: string,
): Promise<{ previewUrl: string | null; artworkUrl: string | null; trackViewUrl: string | null }> => {
  if (provider === 'itunes') {
    const body = (await upstream(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&entity=song`,
    )) as ItunesLookup;
    const hit = body.results?.[0];
    return {
      previewUrl: hit?.previewUrl ?? null,
      artworkUrl: hit?.artworkUrl100 ? hit.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.') : null,
      trackViewUrl: hit?.trackViewUrl ?? null,
    };
  }

  const body = (await upstream(`https://api.deezer.com/track/${encodeURIComponent(trackId)}`)) as DeezerTrack;
  return {
    previewUrl: body.preview ?? null,
    artworkUrl: body.album?.cover_big ?? body.album?.cover_medium ?? null,
    trackViewUrl: body.link ?? null,
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const provider = (Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider) ?? 'itunes';

  res.setHeader('cache-control', 's-maxage=1800, stale-while-revalidate=86400');

  if (!id) {
    res.status(400).json({ error: 'missing id' });
    return;
  }
  if (provider !== 'itunes' && provider !== 'deezer') {
    res.status(400).json({ error: 'provider must be itunes or deezer' });
    return;
  }

  try {
    res.status(200).json({ id, provider, ...(await resolvePreview(provider, id)) });
  } catch (error) {
    // Honest failure. The client shows "No preview for this one."
    res.status(502).json({
      id,
      provider,
      previewUrl: null,
      artworkUrl: null,
      trackViewUrl: null,
      error: error instanceof Error ? error.message : 'upstream failure',
    });
  }
}
