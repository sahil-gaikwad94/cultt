/**
 * Combos (build brief §7) — the escalation curve, with no clock and no DOM.
 *
 * The one thing this file has to prove beyond the arithmetic is the safety
 * claim in the brief: "It's cosmetic, so it never burns your laugh budget."
 * So the last block asserts that nothing in this module can reach the store.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COMBO_LEVELS,
  COMBO_WINDOW_MS,
  burstCountFor,
  comboLabel,
  createComboTracker,
  hapticFor,
  levelFor,
  pruneWindow,
} from '../../src/motion/combos';

describe('the escalation curve', () => {
  it('is 1 / 2 / 3 / 5 with no 4 — the jump is the joke', () => {
    expect(COMBO_LEVELS).toEqual([1, 2, 3, 5]);
    expect([0, 1].map(levelFor)).toEqual([1, 1]);
    expect([2, 3, 4, 5, 9].map(levelFor)).toEqual([2, 3, 5, 5, 5]);
  });

  it('labels nothing on the first tap, so a like is not noise', () => {
    expect(comboLabel(1)).toBe('');
    expect(comboLabel(2)).toBe('×2');
    expect(comboLabel(3)).toBe('×3');
    expect(comboLabel(5)).toBe('×5 UNWELL');
  });

  it('never exceeds the burst ceiling of 10', () => {
    for (const level of COMBO_LEVELS) expect(burstCountFor(level)).toBeLessThanOrEqual(10);
  });

  it('escalates particles and haptics monotonically', () => {
    const counts = COMBO_LEVELS.map(burstCountFor);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBeLessThan(counts.at(-1) as number);
    for (const level of COMBO_LEVELS) expect(hapticFor(level).length).toBeGreaterThan(0);
  });
});

describe('pruneWindow', () => {
  it('drops taps older than the window and never mutates the input', () => {
    const input = [0, 100, 5000];
    const out = pruneWindow(input, 5100, 1400);
    expect(out).toEqual([5000]);
    expect(input).toEqual([0, 100, 5000]);
  });

  it('rejects timestamps in the future, so a rolled-back clock cannot bank hits', () => {
    expect(pruneWindow([9999], 1000, 1400)).toEqual([]);
  });
});

describe('createComboTracker', () => {
  it('escalates on fast taps and resets once the window passes', () => {
    const tracker = createComboTracker(1000);
    expect(tracker.record('meme:a', 0)).toBe(1);
    expect(tracker.record('meme:a', 200)).toBe(2);
    expect(tracker.record('meme:a', 400)).toBe(3);
    expect(tracker.record('meme:a', 600)).toBe(5);
    expect(tracker.record('meme:a', 800)).toBe(5);
    /* At 1800 the window reaches back to 800, so only the tap at 800 survives
       — the streak decays one step at a time rather than resetting outright,
       which is what makes it feel forgiving rather than binary. */
    expect(tracker.record('meme:a', 1800)).toBe(2);
    expect(tracker.record('meme:a', 5000)).toBe(1);
  });

  it('keeps separate keys separate, so a save is not a like combo', () => {
    const tracker = createComboTracker(1000);
    tracker.record('like:a', 0);
    tracker.record('like:a', 100);
    expect(tracker.hitsFor('like:a')).toBe(2);
    expect(tracker.record('save:a', 150)).toBe(1);
    expect(tracker.hitsFor('save:a')).toBe(1);
  });

  it('clear() restarts an item, so un-liking and re-liking is not a combo', () => {
    const tracker = createComboTracker(1000);
    tracker.record('like:a', 0);
    tracker.record('like:a', 100);
    tracker.clear('like:a');
    expect(tracker.hitsFor('like:a')).toBe(0);
    expect(tracker.record('like:a', 200)).toBe(1);
  });

  it('prune() drops stale keys so a long session cannot grow the map', () => {
    const tracker = createComboTracker(1000);
    tracker.record('like:a', 0);
    tracker.record('like:b', 100);
    tracker.record('like:c', 900);
    tracker.prune(1500);
    expect(tracker.hitsFor('like:a')).toBe(0);
    expect(tracker.hitsFor('like:b')).toBe(0);
    expect(tracker.hitsFor('like:c')).toBe(1);
  });
});

describe('the safety claim', () => {
  const raw = readFileSync(resolve(import.meta.dirname, '../../src/motion/combos.ts'), 'utf8');
  /* Scan the code, not the prose. The module's own docstring explains why it
     must not touch `laughSpend`, and a naive substring check fails on that
     sentence. */
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('never touches the store, limits or the laugh budget', () => {
    // A combo is cosmetic. If this module ever imported the store it could mint
    // or spend one of the day's laughs, which is the one thing §7 forbids.
    for (const forbidden of ['../store', 'laughSpend', 'getStore', 'laughsUsed', 'limits']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('imports nothing at all, which is what keeps it off every critical path', () => {
    expect(code).not.toMatch(/^\s*import\s/m);
  });

  it('has no DOM or clock dependency, which is why it is testable like this', () => {
    /* With the member-access dot: `COMBO_WINDOW_MS` and the `windowMs`
       parameter both contain the bare word. */
    for (const forbidden of ['document.', 'window.', 'Date.now']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('uses the window constant it exports', () => {
    expect(COMBO_WINDOW_MS).toBeGreaterThan(0);
  });
});
