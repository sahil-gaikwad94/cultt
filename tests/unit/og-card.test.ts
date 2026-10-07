/**
 * The Open Graph card generator (Phase 4 viral loop).
 *
 * The card is what a shared link looks like before anyone opens the app, so it
 * has to be branded, honest (only the text it is given), and safe — a crafted
 * `?title=` must not be able to inject markup into the SVG. These assert the
 * pure generator; `api/og.ts` only rasterises its output.
 */

import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_WIDTH, renderOgCard } from '../../src/lib/og';

describe('renderOgCard', () => {
  it('is a 1200×630 SVG, the size crawlers expect', () => {
    const svg = renderOgCard();
    expect(svg).toContain(`width="${OG_WIDTH}"`);
    expect(svg).toContain(`height="${OG_HEIGHT}"`);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('draws the brand: ink ground, bone type, the fingerprint contour', () => {
    const svg = renderOgCard();
    expect(svg).toContain('#0A0A09'); // ink ground
    expect(svg).toContain('#EFE9DA'); // bone
    expect(svg).toContain('cultured'); // wordmark
    expect(svg.match(/<circle/g)?.length ?? 0).toBeGreaterThanOrEqual(3); // contour rings
  });

  it('falls back to the branded default copy', () => {
    const svg = renderOgCard();
    expect(svg).toContain('cultured');
    expect(svg).toMatch(/match on your humor/i);
  });

  it('renders a duel card from the values it is given', () => {
    const svg = renderOgCard({ kicker: 'Duel', title: 'Noor vs Lena', subtitle: "Who's funnier?" });
    expect(svg).toContain('DUEL'); // kicker is uppercased
    expect(svg).toContain('Noor vs Lena');
    expect(svg).toContain("Who&#39;s funnier?"); // apostrophe escaped
  });

  it('escapes markup so a crafted title cannot break out of the SVG', () => {
    const svg = renderOgCard({ title: '</svg><script>alert(1)</script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/svg&gt;&lt;script&gt;');
    // The document is still exactly one <svg> root.
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('uses a valid accent and rejects anything else', () => {
    expect(renderOgCard({ accent: '#ffd166' })).toContain('#ffd166');
    // Not a hex colour: ignored, brand coral kept.
    const svg = renderOgCard({ accent: 'red" onload="alert(1)' });
    expect(svg).not.toContain('onload');
    expect(svg).toContain('#ff5d7a');
  });
});
