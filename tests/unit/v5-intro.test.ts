/**
 * The 5.5 s cold open (brief §5.1). `renderIntro(t)` is a pure function of time,
 * so the whole sequence can be asserted without a browser — and without one,
 * since Playwright's Chromium cannot be installed in this sandbox.
 */

import { describe, expect, it } from 'vitest';
import {
  INTRO_CTA_AT,
  INTRO_DURATION,
  WORDMARK,
  renderIntro,
  spring,
  lerp,
  progress,
  easeOut,
  easeInOut,
  mixHex,
} from '../../src/v5/intro';

describe('the easing helpers', () => {
  it('lerps and clamps', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(progress(-1, 0, 2)).toBe(0);
    expect(progress(3, 0, 2)).toBe(1);
    expect(progress(1, 0, 2)).toBe(0.5);
  });

  it('eases out and in-out through the endpoints', () => {
    expect(easeOut(0)).toBeCloseTo(0, 10);
    expect(easeOut(1)).toBeCloseTo(1, 10);
    expect(easeOut(0.5)).toBeGreaterThan(0.5); // front-loaded
    expect(easeInOut(0)).toBeCloseTo(0, 10);
    expect(easeInOut(1)).toBeCloseTo(1, 10);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });

  it('springs from 0 to 1 and settles without diverging', () => {
    expect(spring(0)).toBeCloseTo(0, 6);
    expect(spring(1.5)).toBeCloseTo(1, 1);
    for (let t = 0; t <= 2; t += 0.05) {
      const v = spring(t);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(-0.4);
      expect(v).toBeLessThan(1.5);
    }
  });

  it('mixes two hex colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('renderIntro', () => {
  it('runs for exactly 5.5 s and exposes the CTA at 5.2 s', () => {
    expect(INTRO_DURATION).toBe(5.5);
    expect(INTRO_CTA_AT).toBe(5.2);
  });

  it('is a pure function of t', () => {
    expect(renderIntro(2.3)).toEqual(renderIntro(2.3));
    expect(renderIntro(2.3)).not.toEqual(renderIntro(2.31));
  });

  it('clamps negative time to the opening frame', () => {
    expect(renderIntro(-5)).toEqual(renderIntro(0));
  });

  it('walks the beats in order', () => {
    const phases = [0, 0.8, 1.9, 2.9, 3.7, 4.7, 5.4].map((t) => renderIntro(t).phase);
    expect(phases).toEqual(['ember', 'bloom', 'deal', 'type', 'waveform', 'collapse', 'cta']);
  });

  it('reports progress 0..1 across the timeline', () => {
    expect(renderIntro(0).progress).toBeCloseTo(0, 5);
    expect(renderIntro(INTRO_DURATION).progress).toBeCloseTo(1, 5);
    let previous = -1;
    for (let t = 0; t <= INTRO_DURATION; t += 0.1) {
      const p = renderIntro(t).progress;
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });

  it('deals five cards and finishes dealing inside the 1.2–2.6 s window', () => {
    const before = renderIntro(1.0);
    expect(before.cards.every((card) => card.deal < 1)).toBe(true);
    const after = renderIntro(3.0);
    expect(after.cards).toHaveLength(5);
    // Fully dealt = fully opaque and settled onto the fan, within a few px.
    for (const card of after.cards) {
      expect(card.opacity).toBe(1);
      expect(Math.abs(card.y)).toBeLessThan(20);
      expect(Math.abs(card.scale - 1)).toBeLessThan(0.05);
    }
  });

  it('lands the cards in a fan: the outermost are lowest and most rotated', () => {
    const cards = renderIntro(4).cards;
    const middle = cards[2]!;
    expect(Math.abs(middle.rotate)).toBeLessThan(Math.abs(cards[0]!.rotate));
    expect(middle.y).toBeLessThanOrEqual(cards[0]!.y);
  });

  it('keeps every card on screen (opacity 0..1, finite transforms)', () => {
    for (let t = 0; t <= INTRO_DURATION; t += 0.1) {
      for (const card of renderIntro(t).cards) {
        expect(card.opacity).toBeGreaterThanOrEqual(0);
        expect(card.opacity).toBeLessThanOrEqual(1);
        expect(Number.isFinite(card.x)).toBe(true);
        expect(Number.isFinite(card.y)).toBe(true);
        expect(Number.isFinite(card.scale)).toBe(true);
        expect(Math.abs(card.rotate)).toBeLessThanOrEqual(60);
      }
    }
  });

  it('pixelates the word "headshot" and only that word, mid-sequence', () => {
    expect(renderIntro(2.5).type.headshot).toBe(0);
    expect(renderIntro(3.2).type.headshot).toBeGreaterThan(0);
    expect(renderIntro(3.2).type.headshot).toBeLessThan(1);
  });

  it('types the two lines in order', () => {
    expect(renderIntro(2.2).type.line1).toBe(0);
    expect(renderIntro(3.4).type.line1).toBeGreaterThan(renderIntro(2.6).type.line1);
    expect(renderIntro(3.4).type.line2).toBeGreaterThanOrEqual(renderIntro(2.6).type.line2);
  });

  it('collapses everything into the mark and lights the wordmark', () => {
    const collapsed = renderIntro(5.2);
    expect(collapsed.logo.collapse).toBeGreaterThan(0.9);
    expect(collapsed.logo.letters).toBeGreaterThan(0);
    expect(collapsed.logo.letters).toBeLessThanOrEqual(WORDMARK.length);
    expect(renderIntro(4.4).logo.collapse).toBeLessThan(collapsed.logo.collapse);
  });

  it('hides the CTA until 5.2 s, then shows it', () => {
    expect(renderIntro(5.0).cta.opacity).toBe(0);
    expect(renderIntro(5.4).cta.opacity).toBeGreaterThan(0);
  });

  it('never nudges the camera more than 3 px', () => {
    for (let t = 0; t <= INTRO_DURATION; t += 0.05) {
      const { camera } = renderIntro(t);
      expect(Math.abs(camera.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(camera.y)).toBeLessThanOrEqual(3);
    }
  });

  it('sends a ripple into the contours when a card lands, and lets it decay', () => {
    const landing = renderIntro(1.25).cards.some((card) => card.ripple > 0);
    expect(landing).toBe(true);
    // 600 ms after the last landing nothing is still rippling.
    expect(renderIntro(3.4).cards.every((card) => card.ripple === 0)).toBe(true);
  });

  it('adapts to a small catalog instead of inventing cards', () => {
    expect(renderIntro(3, 2).cards).toHaveLength(2);
    expect(renderIntro(3, 3).cards).toHaveLength(3);
    expect(renderIntro(3, 9).cards).toHaveLength(5);
    // Nothing servable ⇒ nothing dealt. The intro must not fake content.
    expect(renderIntro(3, 0).cards).toHaveLength(0);
  });

  it('keeps every opacity channel inside 0..1', () => {
    for (let t = 0; t <= INTRO_DURATION; t += 0.1) {
      const frame = renderIntro(t);
      const channels = [
        frame.ember.opacity,
        frame.contours.opacity,
        frame.contours.bloom,
        frame.waveform.opacity,
        frame.type.opacity,
        frame.logo.opacity,
        frame.cta.opacity,
      ];
      for (const value of channels) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
