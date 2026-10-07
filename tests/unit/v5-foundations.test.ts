/**
 * Haptics and copy: small modules, but both are the kind of thing that rots
 * silently. The haptics tests pin the "one module, named patterns, no-op
 * everywhere else" contract; the copy tests pin that the deck's vocabularies
 * are complete and internally consistent.
 */

import { describe, expect, it, vi } from 'vitest';
import { PATTERNS, createHaptics } from '../../src/lib/haptics';
import { animate } from '../../src/lib/waapi';
import { compatLabel, copy, impactLine, nhieRank } from '../../src/copy';
import { ARCHETYPES, GENRES, GENRE_SLUGS, MEME_CATEGORIES, archetypeFor, rarityLine } from '../../src/copy/taxonomy';

describe('haptics', () => {
  const navigatorWith = (vibrate: (p: number | number[]) => boolean) => ({ vibrate });

  it('has a named pattern for every effect the brief lists', () => {
    for (const name of ['tick', 'light', 'medium', 'thud', 'success', 'laugh']) {
      expect(PATTERNS[name as keyof typeof PATTERNS]).toBeDefined();
    }
  });

  it('fires the pattern through navigator.vibrate', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ navigator: navigatorWith(vibrate), reducedMotion: false });
    expect(haptics.play('tick')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(PATTERNS.tick);
  });

  it('is a no-op when the device has no vibration API', () => {
    const haptics = createHaptics({ navigator: null, reducedMotion: false });
    expect(haptics.play('thud')).toBe(false);
  });

  it('respects the Settings toggle', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ navigator: navigatorWith(vibrate), reducedMotion: false, enabled: false });
    expect(haptics.play('laugh')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    haptics.setEnabled(true);
    expect(haptics.play('laugh')).toBe(true);
  });

  it('stays silent under prefers-reduced-motion even when enabled', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ navigator: navigatorWith(vibrate), reducedMotion: true, enabled: true });
    expect(haptics.enabled).toBe(false);
    expect(haptics.play('laugh')).toBe(false);
  });

  it('swallows a throwing vibrate rather than breaking the gesture', () => {
    const haptics = createHaptics({
      navigator: {
        vibrate: () => {
          throw new Error('blocked');
        },
      },
      reducedMotion: false,
    });
    expect(haptics.play('medium')).toBe(false);
  });
});

describe('copy', () => {
  it('has 15 meme categories and 31 genres, matching the deck', () => {
    expect(MEME_CATEGORIES).toHaveLength(15);
    expect(GENRES).toHaveLength(31);
    expect(new Set(GENRE_SLUGS).size).toBe(31);
  });

  it('has 15 archetypes covering every two-axis combination it claims', () => {
    expect(ARCHETYPES).toHaveLength(15);
    expect(new Set(ARCHETYPES.map((a) => a.code)).size).toBe(15);
  });

  it('labels compatibility by the deck thresholds', () => {
    expect(compatLabel(90)).toBe(copy.matrix.compat.tasteTwin);
    expect(compatLabel(89)).toBe(copy.matrix.compat.strong);
    expect(compatLabel(75)).toBe(copy.matrix.compat.strong);
    expect(compatLabel(74)).toBe(copy.matrix.compat.twist);
    expect(compatLabel(55)).toBe(copy.matrix.compat.twist);
    expect(compatLabel(54)).toBe(copy.matrix.compat.opposites);
  });

  it('ranks NHIE by guilty count out of 12', () => {
    expect(nhieRank(0)).toBe('Suspiciously clean');
    expect(nhieRank(1)).toBe('Suspiciously clean');
    expect(nhieRank(2)).toBe('Mostly innocent');
    expect(nhieRank(7)).toBe('A healthy amount of damage');
    expect(nhieRank(10)).toBe('Repeat offender');
    expect(nhieRank(12)).toBe('Public menace');
    expect(nhieRank(99)).toBe('Public menace');
  });

  it('derives an archetype from the top two axes, order-insensitively', () => {
    const a = archetypeFor({ deadpan: 0.9, absurdist: 0.8, wholesome: 0.1 });
    expect(a?.archetype.name).toBe('3 AM Philosopher');
    const b = archetypeFor({ absurdist: 0.9, deadpan: 0.8 });
    expect(b?.archetype.name).toBe('3 AM Philosopher');
  });

  it('returns no archetype rather than inventing one from a single axis', () => {
    expect(archetypeFor({ deadpan: 0.9 })).toBeNull();
    expect(archetypeFor({})).toBeNull();
  });

  it('never invents a rarity percentage before 200 users exist', () => {
    expect(rarityLine(10, 7)).toBe('Among the first 7 to get this one.');
    expect(rarityLine(10, null)).toBeNull();
    expect(rarityLine(500, 7)).toBeNull();
  });

  it('gives a stable impact line per item and covers the whole list over many ids', () => {
    expect(impactLine('meme:x1')).toBe(impactLine('meme:x1'));
    const used = new Set(Array.from({ length: 200 }, (_, i) => impactLine(`id-${i}`)));
    expect(used.size).toBeGreaterThan(5);
    for (const line of used) expect(copy.placard.impactLines).toContain(line);
  });

  it('uses "Fingerprint clarity", never "signal confidence"', () => {
    expect(copy.fingerprintClarity).toBe('Fingerprint clarity');
    expect(JSON.stringify(copy).toLowerCase()).not.toContain('signal confidence');
  });
});

describe('the WAAPI guard', () => {
  it('no-ops on an element with no animate method instead of throwing', async () => {
    const node = document.createElement('div');
    // jsdom has no Element.animate, which is exactly the case being guarded.
    expect(typeof (node as HTMLElement & { animate?: unknown }).animate).toBe('undefined');
    const animation = animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
    await expect(animation.finished).resolves.toBeUndefined();
    expect(() => animation.cancel()).not.toThrow();
  });

  it('no-ops on a null target', async () => {
    await expect(animate(null, [{ opacity: 0 }, { opacity: 1 }]).finished).resolves.toBeUndefined();
    await expect(animate(undefined, [{ opacity: 0 }, { opacity: 1 }]).finished).resolves.toBeUndefined();
  });

  it('delegates to the real API when one exists', () => {
    const animation = { finished: Promise.resolve(), cancel: () => {} };
    const node = { animate: vi.fn(() => animation) } as unknown as Element;
    expect(animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 })).toBe(animation);
    expect(node.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  });
});
