/**
 * The NHIE screen (brief §8.2), driven through jsdom.
 *
 * The rules worth pinning are the ones a user can feel: twelve cards, two
 * answers and nothing else, every answer reaching the store, and the round
 * never dealing a card the user has already answered.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountNhie } from '../../src/v5/nhie-screen';
import { nhie } from '../../src/content';
import { ROUND_SIZE, cardText, pickRound } from '../../src/content/nhie';
import { createStore, setStoreForTests } from '../../src/store';
import { copy } from '../../src/copy';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');

const mount = (options: { seed?: number; asked?: string[] } = {}) => {
  const store = createStore({ storage: null, legacy: null, now: () => T0 });
  if (options.asked?.length) store.markNhieAsked(options.asked);
  setStoreForTests(store);

  const host = document.createElement('div');
  document.body.appendChild(host);
  const handle = mountNhie(host, { seed: options.seed ?? 7 });
  const root = host.querySelector<HTMLElement>('.v5-nhie')!;

  return {
    store,
    root,
    askedNow: () => store.getState().progress.nhieAsked,
    click: (selector: string) => {
      const node = root.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`nothing matches ${selector}`);
      node.click();
    },
    cardText: () => root.querySelector('.v5-nhie-text')?.textContent ?? '',
    counter: () => root.querySelector('.v5-nhie-count')?.textContent ?? '',
    teardown: () => {
      handle.destroy();
      host.remove();
    },
  };
};

describe('the NHIE screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setStoreForTests(null);
    document.body.innerHTML = '';
  });

  it('deals a full round and counts up to twelve', () => {
    const screen = mount();
    expect(screen.counter()).toBe(`1/${ROUND_SIZE}`);
    expect(screen.cardText()).toBe(cardText(pickRound(nhie, { seed: 7 }).questions[0]!));
    screen.teardown();
  });

  it('only ever offers Guilty or Clean — no free text anywhere', () => {
    const screen = mount();
    const buttons = [...screen.root.querySelectorAll<HTMLElement>('[data-answer]')];
    expect(buttons.map((b) => b.dataset.answer).sort()).toEqual(['clean', 'guilty']);
    expect(buttons.map((b) => b.textContent)).toEqual([copy.arena.nhie.clean, copy.arena.nhie.guilty]);
    expect(screen.root.querySelector('input, textarea')).toBe(null);
    screen.teardown();
  });

  it('records every answer in the store as it is given', async () => {
    const screen = mount();
    const expected = pickRound(nhie, { seed: 7 }).questions;

    screen.click('[data-answer="guilty"]');
    vi.advanceTimersByTime(300);
    expect(screen.askedNow()).toEqual([expected[0]!.id]);

    screen.click('[data-answer="clean"]');
    vi.advanceTimersByTime(300);
    expect(screen.askedNow()).toEqual([expected[0]!.id, expected[1]!.id]);
    expect(screen.counter()).toBe(`3/${ROUND_SIZE}`);
    screen.teardown();
  });

  it('walks all twelve and then shows the rank', () => {
    const screen = mount();
    for (let i = 0; i < ROUND_SIZE; i += 1) {
      screen.click(i % 3 === 0 ? '[data-answer="guilty"]' : '[data-answer="clean"]');
      vi.advanceTimersByTime(300);
    }
    expect(screen.askedNow()).toHaveLength(ROUND_SIZE);
    expect(screen.root.querySelector('.v5-nhie-rank')?.textContent).toBeTruthy();
    // Four of twelve were guilty, which is the "Mostly innocent" band.
    expect(screen.root.querySelector('.v5-nhie-rank')?.textContent).toBe('Mostly innocent');
    screen.teardown();
  });

  it('never deals a card the user has already answered', () => {
    const first = pickRound(nhie, { seed: 7 }).questions.map((q) => q.id);
    const screen = mount({ seed: 11, asked: first });
    const dealt = pickRound(nhie, { seed: 11, asked: first }).questions.map((q) => q.id);
    expect(dealt.some((id) => first.includes(id))).toBe(false);
    expect(screen.cardText()).toBe(cardText(nhie.questions.find((q) => q.id === dealt[0])!));
    screen.teardown();
  });

  it('deals the same twelve for the same seed, so friend mode matches', () => {
    const a = mount({ seed: 4242 });
    const firstA = a.cardText();
    a.teardown();

    const b = mount({ seed: 4242 });
    expect(b.cardText()).toBe(firstA);
    b.teardown();

    const c = mount({ seed: 99 });
    expect(c.cardText()).not.toBe(firstA);
    c.teardown();
  });

  it('says so when the bank runs out instead of repeating silently', () => {
    // Leave fewer than a full round unasked, so pickRound has to restart the
    // pool. Exactly twelve left is not exhaustion — that is a normal round.
    const almostAll = nhie.questions.slice(0, nhie.questions.length - (ROUND_SIZE - 1)).map((q) => q.id);
    expect(pickRound(nhie, { seed: 7, asked: almostAll }).bankExhausted).toBe(true);

    const screen = mount({ seed: 7, asked: almostAll });
    for (let i = 0; i < ROUND_SIZE; i += 1) {
      screen.click('[data-answer="clean"]');
      vi.advanceTimersByTime(300);
    }
    const note = screen.root.querySelector('.v5-nhie-note');
    expect(note?.textContent).toContain('last of the bank');
    screen.teardown();
  });

  it('does not cry exhaustion when exactly one round is left', () => {
    const allButARound = nhie.questions.slice(0, nhie.questions.length - ROUND_SIZE).map((q) => q.id);
    expect(pickRound(nhie, { seed: 7, asked: allButARound }).bankExhausted).toBe(false);
  });

  it('starts a fresh round without repeating the one just played', () => {
    const screen = mount();
    const firstRound = pickRound(nhie, { seed: 7 }).questions.map((q) => q.id);
    for (let i = 0; i < ROUND_SIZE; i += 1) {
      screen.click('[data-answer="clean"]');
      vi.advanceTimersByTime(300);
    }
    screen.click('[data-again]');
    expect(screen.counter()).toBe(`1/${ROUND_SIZE}`);
    expect(firstRound).not.toContain(
      nhie.questions.find((q) => cardText(q) === screen.cardText())!.id,
    );
    screen.teardown();
  });

  it('closes on demand and leaves nothing behind', () => {
    const screen = mount();
    screen.click('[data-close]');
    expect(document.querySelector('.v5-nhie')).toBe(null);
  });
});
