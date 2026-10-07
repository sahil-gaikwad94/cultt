/**
 * The `/api/og` handler, exercised with a mock Vercel req/res.
 *
 * This runs the real rasterisation path — `sharp` turning the generated SVG
 * into a PNG — because that is the part that silently produces a blank or
 * broken `og:image` if the SVG or the font handling is wrong.
 */

import { describe, expect, it } from 'vitest';
import handler from '../../api/og';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string | Buffer | null;
  status: (code: number) => MockRes;
  setHeader: (name: string, value: string) => void;
  send: (body: string | Buffer) => void;
}

const mockRes = (): MockRes => {
  const res: MockRes = {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return undefined as never;
    },
    send(body) {
      res.body = body;
      return undefined as never;
    },
  };
  return res;
};

describe('GET /api/og', () => {
  it('returns a PNG card with immutable caching', async () => {
    const res = mockRes();
    await handler({ query: { title: 'Noor vs Lena', kicker: 'Duel' } }, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    // PNG magic bytes.
    expect((res.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
  });

  it('rasterises a card that is not blank — the text actually draws', async () => {
    const res = mockRes();
    await handler({ query: { title: 'cultured' } }, res as never);
    const png = res.body as Buffer;
    // A 1200×630 card with bone type on ink has bright pixels; a blank render
    // (no font) would top out at the ink background's luma (~10).
    const sharp = (await import('sharp')).default;
    const { channels } = await sharp(png).stats();
    expect(channels[0].max).toBeGreaterThan(150);
  });

  it('survives a hostile query without injecting markup', async () => {
    const res = mockRes();
    await handler({ query: { title: '</svg><script>x</script>', accent: 'nope' } }, res as never);
    expect(res.statusCode).toBe(200);
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });
});
