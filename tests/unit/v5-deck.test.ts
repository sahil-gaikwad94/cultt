/**
 * Deck, gestures, contours and the quality tiers — the pure maths underneath
 * the v5 Home. Every function here is deterministic, so these pin behaviour
 * rather than implementation.
 */

import { describe, expect, it } from 'vitest';
import {
  COMMIT_DISTANCE_FRACTION,
  COMMIT_VELOCITY_PX_PER_MS,
  axisAffinity,
  decideGesture,
  dragRotation,
  localDayKey,
  orderDeck,
  rubberBand,
  seededRandom,
} from '../../src/v5/deck';
import type { DeckSource } from '../../src/v5/deck';
import { contourExtent, contourRings } from '../../src/v5/contour';
import { DEFAULT_CONTOUR } from '../../src/v5/contour';
import { CAPS, classify } from '../../src/v5/quality';
import { fisheye, layoutTray, trayFor } from '../../src/v5/reactions';
import { waveformFor } from '../../src/v5/audio';
import { createStore } from '../../src/store';
import { forecastIndex, verdictFor } from '../../src/v5/home';
import { HUMOR_AXES, MEME_CATEGORY_SLUGS } from '../../src/copy/taxonomy';
import type { MemeEntry, SongEntry } from '../../src/content/types';

const meme = (i: number, category: string, axis: (typeof HUMOR_AXES)[number]): MemeEntry => ({
  id: `meme-${i}`,
  kind: 'image',
  src: `/memes/meme-${i}.webp`,
  title: `Meme ${i}`,
  category,
  mood: 'dry',
  axis,
  placard: `Exhibit №${i} · ${category} · Mood: dry`,
  alt: `Meme ${i}`,
  credit: null,
  rightsCleared: true,
  width: 960,
  height: 960,
  bytes: 40000,
  dominant: '#101010',
  blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  durationMs: null,
  poster: null,
  variants: [{ width: 480, avif: `/gen/meme-${i}-480.avif`, webp: `/gen/meme-${i}-480.webp` }],
});

const song = (i: number): SongEntry => ({
  id: `song-${i}`,
  genre: 'pop',
  genreName: 'Pop',
  title: `Track ${i}`,
  artist: `Artist ${i}`,
  vibe: 'warm',
  trackId: `t${i}`,
  provider: 'itunes',
  previewUrl: null,
  artworkUrl: null,
  trackViewUrl: null,
  durationMs: 200000,
  resolved: false,
});

/** 24 memes across 4 categories + 8 songs. */
const source = (): DeckSource => {
  const categories = MEME_CATEGORY_SLUGS.slice(0, 4);
  return {
    memes: Array.from({ length: 24 }, (_, i) => meme(i, categories[i % 4] as string, HUMOR_AXES[i % HUMOR_AXES.length])),
    songs: Array.from({ length: 8 }, (_, i) => song(i)),
  };
};

describe('orderDeck', () => {
  it('is deterministic for a seed and changes when the seed changes', () => {
    const a = orderDeck({ source: source(), seen: [], seed: '2026-10-07' });
    const b = orderDeck({ source: source(), seen: [], seed: '2026-10-07' });
    const c = orderDeck({ source: source(), seen: [], seed: '2026-10-08' });
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(a.items.map((i) => i.id)).not.toEqual(c.items.map((i) => i.id));
  });

  it('interleaves a song exactly every fourth slot while both pools last', () => {
    // Ample catalog, so neither pool can run out and shift the rhythm.
    const ample: DeckSource = {
      memes: Array.from({ length: 64 }, (_, i) =>
        meme(i, MEME_CATEGORY_SLUGS[i % 4] as string, HUMOR_AXES[i % HUMOR_AXES.length]),
      ),
      songs: Array.from({ length: 16 }, (_, i) => song(i)),
    };
    const { items } = orderDeck({ source: ample, seen: [], seed: 's', limit: 32 });
    expect(items).toHaveLength(32);
    items.forEach((item, index) => expect(item.kind).toBe((index + 1) % 4 === 0 ? 'song' : 'meme'));
  });

  it('keeps dealing when one pool runs dry instead of stalling the deck', () => {
    // Only 8 songs for 40 slots: the song slots fall back to memes.
    const { items } = orderDeck({ source: source(), seen: [], seed: 's', limit: 40 });
    expect(items.filter((item) => item.kind === 'song')).toHaveLength(8);
    // Every item in the catalog reaches the deck: 24 memes + 8 songs.
    expect(items).toHaveLength(32);
    expect(new Set(items.map((item) => item.id)).size).toBe(32);
  });

  it('never repeats an item and drops anything already seen', () => {
    const first = orderDeck({ source: source(), seen: [], seed: 's', limit: 10 });
    const seen = first.items.map((i) => i.id);
    const second = orderDeck({ source: source(), seen, seed: 's', limit: 10 });
    expect(new Set(first.items.map((i) => i.id)).size).toBe(10);
    expect(second.items.map((i) => i.id).some((id) => seen.includes(id))).toBe(false);
  });

  it('rotates categories instead of clustering them', () => {
    const { items } = orderDeck({ source: source(), seen: [], seed: 's', limit: 12 });
    const categories = items.filter((i) => i.kind === 'meme').map((i) => i.meme?.category);
    // No category should run three times in a row.
    for (let i = 2; i < categories.length; i += 1) {
      const run = categories[i] === categories[i - 1] && categories[i] === categories[i - 2];
      expect(run).toBe(false);
    }
  });

  it('reports the whole catalog in galleryCount and exhausts honestly', () => {
    const deck = source();
    const ordered = orderDeck({ source: deck, seen: [], seed: 's', limit: 40 });
    expect(ordered.galleryCount).toBe(deck.memes.length + deck.songs.length);
    expect(ordered.exhausted).toBe(false);
    expect(orderDeck({ source: deck, seen: [...deck.memes, ...deck.songs].map((i) => i.id), seed: 's' }).exhausted).toBe(true);
  });

  it('lets axis affinity dominate the seeded tie-break', () => {
    const store = createStore({ storage: null, legacy: null, now: () => Date.parse('2026-10-07T12:00:00Z') });
    // Six 🗿 reactions and nothing else — 🗿 is the deadpan axis.
    for (let i = 0; i < 6; i += 1) store.react({ kind: 'meme', itemId: `seed-${i}`, emoji: '🗿' });
    const state = store.getState();
    const affinity = axisAffinity(state);
    expect(affinity.deadpan).toBe(1); // normalised: it is the only axis in play

    const catalog: DeckSource = {
      memes: [
        meme(100, MEME_CATEGORY_SLUGS[0] as string, 'deadpan'),
        meme(101, MEME_CATEGORY_SLUGS[0] as string, 'absurdist'),
        meme(102, MEME_CATEGORY_SLUGS[0] as string, 'dry_wit'),
      ],
      songs: [],
    };
    // Same category for all three, so only the axis differs.
    const { items } = orderDeck({ source: catalog, seen: [], seed: 's', state, limit: 3 });
    expect(items[0]?.id).toBe('meme-100');
  });

  it('keys the default seed off the local day', () => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    expect(localDayKey(now)).toBe('20261007');
    const a = orderDeck({ source: source(), seen: [], now });
    const b = orderDeck({ source: source(), seen: [], now: now + 24 * 3600_000 });
    expect(a.items.map((i) => i.id)).not.toEqual(b.items.map((i) => i.id));
  });

  it('seeds the same day for two users', () => {
    const randA = seededRandom(7);
    const randB = seededRandom(7);
    expect([randA(), randA(), randA()]).toEqual([randB(), randB(), randB()]);
  });
});

describe('decideGesture', () => {
  const width = 340;
  const threshold = width * COMMIT_DISTANCE_FRACTION;

  it('commits a right swipe past 28% of the card', () => {
    const decision = decideGesture({ dx: threshold + 10, dy: 0, velocity: 0, cardWidth: width, laughsLeft: 5 });
    expect(decision).toMatchObject({ direction: 'right', action: 'laugh', committed: true, blocked: false });
  });

  it('commits on velocity alone', () => {
    const decision = decideGesture({
      dx: 20,
      dy: 0,
      velocity: COMMIT_VELOCITY_PX_PER_MS + 0.1,
      cardWidth: width,
      laughsLeft: 5,
    });
    expect(decision.committed).toBe(true);
  });

  it('blocks a laugh when the budget is gone instead of spending it', () => {
    const decision = decideGesture({ dx: threshold + 40, dy: 0, velocity: 0, cardWidth: width, laughsLeft: 0 });
    expect(decision.committed).toBe(false);
    expect(decision.blocked).toBe(true);
  });

  it('never blocks a pass or a save on budget', () => {
    expect(decideGesture({ dx: -(threshold + 40), dy: 0, velocity: 0, cardWidth: width, laughsLeft: 0 })).toMatchObject({
      action: 'pass',
      committed: true,
      blocked: false,
    });
    expect(decideGesture({ dx: 10, dy: -(threshold + 40), velocity: 0, cardWidth: width, laughsLeft: 0 })).toMatchObject({
      direction: 'up',
      action: 'save',
      committed: true,
      blocked: false,
    });
  });

  it('treats a diagonal drag as a save when the vertical wins', () => {
    expect(decideGesture({ dx: 40, dy: -200, velocity: 0, cardWidth: width, laughsLeft: 5 }).direction).toBe('up');
    expect(decideGesture({ dx: 200, dy: -40, velocity: 0, cardWidth: width, laughsLeft: 5 }).direction).toBe('right');
  });
});

describe('drag maths', () => {
  it('caps rotation at ±18°', () => {
    expect(dragRotation(340, 340)).toBe(18);
    expect(dragRotation(-340, 340)).toBe(-18);
    expect(dragRotation(0, 340)).toBe(0);
  });

  it('rubber-bands to 22% of the drag', () => {
    expect(rubberBand(100)).toBeCloseTo(22, 5);
    expect(rubberBand(-100)).toBeCloseTo(-22, 5);
  });
});

describe('contourRings', () => {
  it('is deterministic per seed and produces the requested ring count', () => {
    const a = contourRings({ ...DEFAULT_CONTOUR, seed: 42, rings: 7, points: 48 });
    const b = contourRings({ ...DEFAULT_CONTOUR, seed: 42, rings: 7, points: 48 });
    expect(a.length).toBe(7);
    expect(a[0]?.length).toBe(48);
    expect(a).toEqual(b);
    expect(contourRings({ ...DEFAULT_CONTOUR, seed: 43, rings: 7, points: 48 })).not.toEqual(a);
  });

  it('opens outward — the outer ring is further from the centre than the inner', () => {
    const rings = contourRings({ ...DEFAULT_CONTOUR, seed: 7, rings: 6, points: 64 });
    const inner = Math.hypot(...rings[0]![0]!);
    const outer = Math.hypot(...rings[5]![0]!);
    expect(outer).toBeGreaterThan(inner);
    expect(contourExtent(rings)).toBeGreaterThan(0);
  });

  it('clamps a degenerate request instead of returning nothing', () => {
    expect(contourRings({ ...DEFAULT_CONTOUR, rings: 0, points: 4 }).length).toBe(1);
    expect(contourRings({ ...DEFAULT_CONTOUR, rings: 3, points: 2 })[0]!.length).toBe(12);
    expect(contourExtent([])).toBe(1);
  });
});

describe('quality tiers', () => {
  const base = { frameMs: null, deviceMemoryGb: null, hardwareConcurrency: null, webgl2: true, reducedMotion: false };

  it('always drops to C for prefers-reduced-motion, whatever the hardware says', () => {
    expect(classify({ ...base, reducedMotion: true }).tier).toBe('C');
  });

  it('lets the measured frame time beat the spec sheet', () => {
    expect(classify({ ...base, frameMs: 12 }).tier).toBe('A');
    expect(classify({ ...base, frameMs: 24 }).tier).toBe('B');
    expect(classify({ ...base, frameMs: 48 }).tier).toBe('C');
    expect(classify({ ...base, frameMs: 12, deviceMemoryGb: 1 }).tier).toBe('A');
  });

  it('falls back to memory and cores when nothing was measured', () => {
    expect(classify({ ...base, deviceMemoryGb: 2 }).tier).toBe('C');
    expect(classify({ ...base, deviceMemoryGb: 4 }).tier).toBe('B');
    expect(classify({ ...base, hardwareConcurrency: 2 }).tier).toBe('C');
    expect(classify({ ...base, hardwareConcurrency: 4 }).tier).toBe('B');
  });

  it('gives every tier a hard particle / DPR / Lottie / video cap', () => {
    for (const tier of ['A', 'B', 'C'] as const) {
      expect(CAPS[tier].particles).toBeGreaterThanOrEqual(0);
      expect(CAPS[tier].particles).toBeLessThanOrEqual(300);
      expect(CAPS[tier].dpr).toBeLessThanOrEqual(2);
      expect(CAPS[tier].liveLottie).toBeLessThanOrEqual(6);
      expect(CAPS[tier].decodedVideos).toBeLessThanOrEqual(3);
    }
    expect(CAPS.C.particles).toBe(0);
    expect(CAPS.A.particles).toBe(300);
  });
});

describe('reaction tray', () => {
  it('has eight reactions per surface, memes and songs differing', () => {
    expect(trayFor('meme')).toHaveLength(8);
    expect(trayFor('song')).toHaveLength(8);
    expect(trayFor('meme')).not.toEqual(trayFor('song'));
  });

  it('centres the tray on the anchor and clamps it inside the viewport', () => {
    const emojis = trayFor('meme');
    const { items, left, width } = layoutTray(emojis, 'meme', 210, 420);
    expect(items).toHaveLength(8);
    expect(width).toBe(emojis.length * 46 + 36);
    expect(left).toBe(210 - width / 2);
    expect(items[0]!.x).toBeLessThan(items[7]!.x);
    // Clamped at both ends rather than hanging off-screen.
    expect(layoutTray(emojis, 'meme', 5, 420).left).toBe(8);
    expect(layoutTray(emojis, 'meme', 415, 420).left).toBe(420 - width - 8);
  });

  it('names every reaction on its own surface', () => {
    const emojis = trayFor('meme');
    expect(layoutTray(emojis, 'meme', 200, 420).items.every((item) => item.name.length > 0)).toBe(true);
  });

  it('fisheyes the item under the pointer hardest and cancels outside the tray', () => {
    const { items, left } = layoutTray(trayFor('meme'), 'meme', 210, 420);
    const { scales, focus } = fisheye(items, left + items[3]!.x, left);
    expect(focus).toBe(3);
    expect(scales[3]).toBeGreaterThan(scales[0]!);
    expect(scales.every((scale) => scale >= 1 && scale <= 1.75)).toBe(true);

    // Left of the whole tray: no focus at all, so the release cancels.
    expect(fisheye(items, left - 40, left).focus).toBe(null);
    // Past the right edge: same.
    expect(fisheye(items, left + items.length * 46 + 200, left).focus).toBe(null);
  });
});

describe('waveformFor', () => {
  it('is procedural, seeded by track id and inside 0..1', () => {
    const a = waveformFor('pop-espresso', 32);
    const b = waveformFor('pop-espresso', 32);
    const c = waveformFor('indie-cruel-summer', 32);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(32);
    expect(a.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(a.some((v) => v > 0.05)).toBe(true);
  });

  it('never touches a network — no audio element, no fetch', () => {
    // jsdom has neither; if the module reached for one it would throw here.
    expect(() => waveformFor('x', 16)).not.toThrow();
  });
});

describe('the Verdict sub-page', () => {
  const T0 = Date.parse('2026-10-07T12:00:00.000Z');
  /* store.react() stamps `ts` with the store clock, which is T0 — today. The
     verdict reads yesterday, so the fixture backdates each reaction into that
     window rather than pretending the clock did it. */
  const IN_WINDOW = T0 - 26 * 3600_000;
  const OUT_OF_WINDOW = T0 - 5 * 86400000;

  const storeWith = (reactions: { emoji: string; itemId: string; ts?: number }[]) => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    for (const reaction of reactions) {
      store.react({ kind: 'meme', itemId: reaction.itemId, emoji: reaction.emoji });
    }
    const state = store.getState();
    reactions.forEach((reaction, index) => {
      const stored = state.reactions.find((r) => r.itemId === reaction.itemId);
      if (stored) stored.ts = reaction.ts ?? IN_WINDOW;
      void index;
    });
    return store;
  };

  it('reports nothing when yesterday was quiet', () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    const verdict = verdictFor(store.getState(), T0);
    expect(verdict.laughs).toBe(0);
    expect(verdict.saves).toBe(0);
    expect(verdict.archetype).toBe(null);
    expect(verdict.axes).toEqual([]);
    expect(verdict.clarity).toBe(0);
  });

  it('counts only the yesterday window, not the whole history', () => {
    const store = storeWith([
      { emoji: '🗿', itemId: 'a' },
      { emoji: '🗿', itemId: 'b', ts: OUT_OF_WINDOW },
    ]);
    const verdict = verdictFor(store.getState(), T0);
    expect(verdict.laughs).toBe(1);
  });

  it('names an archetype once two axes are in play', () => {
    const store = storeWith([
      { emoji: '🗿', itemId: 'a' }, // deadpan
      { emoji: '🫠', itemId: 'b' }, // dry wit
      { emoji: '🫠', itemId: 'c' },
    ]);
    const verdict = verdictFor(store.getState(), T0);
    expect(verdict.laughs).toBe(3);
    expect(verdict.archetype?.name).toBeTruthy();
    expect(verdict.axes[0]?.axis).toBe('dry_wit');
    expect(verdict.topReaction).toEqual({ emoji: '🫠', count: 2 });
  });

  it('stays honest with a single axis: no archetype, full clarity', () => {
    const store = storeWith([
      { emoji: '🗿', itemId: 'a' },
      { emoji: '🗿', itemId: 'b' },
    ]);
    const verdict = verdictFor(store.getState(), T0);
    expect(verdict.archetype).toBe(null);
    expect(verdict.clarity).toBe(1);
    expect(verdict.axes).toHaveLength(1);
  });

  it('spreads clarity across axes when the day was varied', () => {
    const store = storeWith([
      { emoji: '🗿', itemId: 'a' },
      { emoji: '🫠', itemId: 'b' },
    ]);
    const verdict = verdictFor(store.getState(), T0);
    expect(verdict.clarity).toBeLessThan(1);
    expect(verdict.axes.reduce((sum, axis) => sum + axis.share, 0)).toBeCloseTo(1, 6);
  });

  it('labels axes in words, never in snake_case ids', () => {
    const store = storeWith([{ emoji: '🧠', itemId: 'a' }]);
    const verdict = verdictFor(store.getState(), T0);
    const labels = verdict.axes.map((axis) => axis.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).not.toContain('_');
    expect(labels).toContain('Niche refs');
  });
});

describe('the Forecast sub-page', () => {
  it('picks a stable forecast per day and covers the whole range', () => {
    const options = 6;
    expect(forecastIndex('20261007', options)).toBe(forecastIndex('20261007', options));
    const seen = new Set<number>();
    for (let day = 1; day <= 40; day += 1) seen.add(forecastIndex(`202610${String(day).padStart(2, '0')}`, options));
    expect(seen.size).toBeGreaterThan(1);
    for (const index of seen) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(options);
    }
  });

  it('never divides by zero on a degenerate option count', () => {
    expect(forecastIndex('20261007', 0)).toBe(0);
    expect(forecastIndex('20261007', 1)).toBe(0);
  });
});
