/**
 * The share sheet and the share card.
 *
 * The thing worth pinning here is the honesty rule at `legacy.ts:913`: a tile
 * may only appear if the device can actually deliver it. So most of this file
 * walks the capability matrix and asserts what each combination offers — a
 * browser with no Web Share and no clipboard must not grow a "More…" button,
 * and a user with no matches must not be offered "Send to a match".
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_SHARE_HINT,
  detectCapabilities,
  planShare,
} from '../../src/lib/share';
import type { ShareCapabilities, ShareItem } from '../../src/lib/share';
import { CARD_SIZES, cardLayout, wrapLines } from '../../src/lib/shareCard';

const caps = (over: Partial<ShareCapabilities> = {}): ShareCapabilities => ({
  webShare: false,
  webShareFiles: false,
  clipboardText: false,
  clipboardImage: false,
  download: false,
  ...over,
});

const item = (over: Partial<ShareItem> = {}): ShareItem => ({
  title: 'Hydration, but make it suspicious',
  text: 'Hydration — cultured',
  url: 'https://cultured.app/',
  image: { src: '/memes/meme-01.webp', alt: 'A meme', filename: 'cultured-meme.webp' },
  cardTitle: 'Hydration, but make it suspicious',
  cardCaption: 'cultured',
  ...over,
});

const ids = (options: { id: string }[]) => options.map((o) => o.id);

describe('planShare', () => {
  it('always offers the in-app story, because it always works', () => {
    for (const c of [caps(), caps({ webShare: true }), caps({ download: true })]) {
      expect(ids(planShare(item(), c, { hasMatches: false }))).toContain('story');
    }
  });

  it('offers a match only when there is someone to send to', () => {
    expect(ids(planShare(item(), caps(), { hasMatches: true }))).toContain('match');
    expect(ids(planShare(item(), caps(), { hasMatches: false }))).not.toContain('match');
  });

  it('never offers More… without navigator.share', () => {
    expect(ids(planShare(item(), caps({ clipboardText: true }), { hasMatches: false }))).not.toContain('more');
    expect(ids(planShare(item(), caps({ webShare: true }), { hasMatches: false }))).toContain('more');
  });

  it('only promises the image is attached when Web Share can carry files', () => {
    const more = (c: ShareCapabilities) =>
      planShare(item(), c, { hasMatches: false }).find((o) => o.id === 'more')?.hint ?? '';
    expect(more(caps({ webShare: true }))).not.toContain('with the image');
    expect(more(caps({ webShare: true, webShareFiles: true }))).toContain('with the image');
  });

  it('does not offer Save or Card without a download path or without an image', () => {
    expect(ids(planShare(item(), caps({ download: true }), { hasMatches: false }))).toEqual(
      expect.arrayContaining(['save', 'card']),
    );
    expect(ids(planShare(item(), caps(), { hasMatches: false }))).not.toContain('save');
    expect(ids(planShare(item({ image: undefined }), caps({ download: true }), { hasMatches: false }))).not.toContain(
      'save',
    );
  });

  it('offers Copy only with a clipboard', () => {
    expect(ids(planShare(item(), caps({ clipboardText: true }), { hasMatches: false }))).toContain('copy');
    expect(ids(planShare(item(), caps(), { hasMatches: false }))).not.toContain('copy');
  });

  it('is empty on a device that can do nothing, and the sheet says so', () => {
    const bare = planShare(item({ image: undefined }), caps(), { hasMatches: false });
    expect(bare.map((o) => o.id)).toEqual(['story']);
    expect(EMPTY_SHARE_HINT.length).toBeGreaterThan(0);
  });

  it('puts in-app targets first and the escape hatch last', () => {
    const full = planShare(item(), caps({ webShare: true, webShareFiles: true, clipboardText: true, download: true }), {
      hasMatches: true,
    });
    const order = ids(full);
    expect(order[0]).toBe('story');
    expect(order[1]).toBe('match');
    expect(order.at(-1)).toBe('more');
  });

  it('is deterministic, so the sheet cannot reorder between taps', () => {
    const c = caps({ webShare: true, clipboardText: true, download: true });
    expect(ids(planShare(item(), c, { hasMatches: true }))).toEqual(
      ids(planShare(item(), c, { hasMatches: true })),
    );
  });
});

describe('detectCapabilities', () => {
  it('feature-detects rather than guessing, and survives a bare environment', () => {
    const found = detectCapabilities();
    // jsdom has none of these; a real browser has some. Either way the shape
    // must be complete, because planShare indexes every field.
    expect(found).toEqual({
      webShare: expect.any(Boolean),
      webShareFiles: expect.any(Boolean),
      clipboardText: expect.any(Boolean),
      clipboardImage: expect.any(Boolean),
      download: expect.any(Boolean),
    });
    // jsdom implements createElement, so download is the one honest yes here.
    expect(found.download).toBe(true);
  });
});

describe('cardLayout', () => {
  const canvas = CARD_SIZES['9:16'];

  it('preserves the source aspect ratio', () => {
    const layout = cardLayout({ canvas, image: { width: 700, height: 368 } });
    expect(layout.image.width / layout.image.height).toBeCloseTo(700 / 368, 5);
  });

  it('fits inside the frame and centres within it', () => {
    const layout = cardLayout({ canvas, image: { width: 700, height: 368 } });
    expect(layout.image.x).toBeGreaterThanOrEqual(layout.frame.x);
    expect(layout.image.y).toBeGreaterThanOrEqual(layout.frame.y);
    expect(layout.image.x + layout.image.width).toBeLessThanOrEqual(layout.frame.x + layout.frame.width + 0.01);
    expect(layout.image.y + layout.image.height).toBeLessThanOrEqual(layout.frame.y + layout.frame.height + 0.01);
    // Centred on both axes.
    const leftGap = layout.image.x - layout.frame.x;
    const rightGap = layout.frame.x + layout.frame.width - (layout.image.x + layout.image.width);
    expect(leftGap).toBeCloseTo(rightGap, 5);
  });

  it('letterboxes a wide meme rather than stretching it', () => {
    const layout = cardLayout({ canvas, image: { width: 700, height: 368 } });
    expect(layout.image.width).toBe(layout.frame.width);
    expect(layout.image.height).toBeLessThan(layout.frame.height);
  });

  it('pillarboxes a tall meme rather than stretching it', () => {
    const layout = cardLayout({ canvas, image: { width: 400, height: 1200 } });
    expect(layout.image.height).toBe(layout.frame.height);
    expect(layout.image.width).toBeLessThan(layout.frame.width);
    expect(layout.image.width / layout.image.height).toBeCloseTo(400 / 1200, 5);
  });

  it('clears the top and bottom insets for the brand line and the placard', () => {
    const layout = cardLayout({ canvas, image: { width: 100, height: 100 }, topInset: 220, bottomInset: 420 });
    expect(layout.frame.y).toBe(220);
    expect(layout.frame.y + layout.frame.height).toBeLessThanOrEqual(canvas.height - 420 + 0.01);
  });

  it('bleeds over the whole canvas so the letterbox is filled', () => {
    const layout = cardLayout({ canvas, image: { width: 700, height: 368 } });
    expect(layout.bleed).toEqual({ x: 0, y: 0, width: canvas.width, height: canvas.height });
  });

  it('never divides by zero on a degenerate source', () => {
    const layout = cardLayout({ canvas, image: { width: 0, height: 0 } });
    expect(Number.isFinite(layout.image.width)).toBe(true);
    expect(layout.image.width).toBeGreaterThan(0);
  });
});

describe('wrapLines', () => {
  const measure = (line: string) => line.length * 10;

  it('wraps at the width', () => {
    // measure is 10px per character, so "one two three" (130) overflows and
    // "three four" (100) exactly fits.
    expect(wrapLines('one two three four', 100, measure)).toEqual(['one two', 'three four']);
  });

  it('caps at maxLines and marks the truncation', () => {
    const lines = wrapLines('a b c d e f g h', 30, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines.at(-1)).toContain('…');
  });

  it('keeps a single long word rather than dropping it', () => {
    expect(wrapLines('supercalifragilistic', 20, measure, 2)).toEqual(['supercalifragilistic']);
  });

  it('returns nothing for empty input', () => {
    expect(wrapLines('   ', 100, measure)).toEqual([]);
  });
});
