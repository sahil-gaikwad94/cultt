/**
 * `/api/og` — Vercel function that serves the Open Graph card as a PNG.
 *
 * Crawlers (Facebook, Twitter, iMessage, WhatsApp) do not render SVG
 * `og:image`, so the SVG from `renderOgCard` is rasterised here with `sharp`
 * (already a dependency — the meme pipeline uses it). Query params customise
 * the card for a specific share, e.g.
 * `/api/og?kicker=Duel&title=Noor%20vs%20Lena&subtitle=Who's%20funnier?`.
 *
 * Every value is escaped by the generator and the accent is validated as a hex
 * colour, so a crafted link cannot inject markup. The output is immutable and
 * cached at the edge for a week.
 */

import sharp from 'sharp';
import { OG_HEIGHT, OG_WIDTH, renderOgCard } from '../src/lib/og';

interface VercelRequest {
  query: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string | Buffer) => void;
}

/** Takes the first value of a query param, capped, or undefined if absent. */
const str = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, 140) : undefined;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const svg = renderOgCard({
    kicker: str(req.query.kicker),
    title: str(req.query.title),
    subtitle: str(req.query.subtitle),
    accent: str(req.query.accent),
  });

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');

  try {
    const png = await sharp(Buffer.from(svg)).resize(OG_WIDTH, OG_HEIGHT).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(png);
  } catch {
    /* No rasteriser in this environment: the SVG still renders on the platforms
       that accept it, which is better than no card at all. */
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.status(200).send(svg);
  }
}
