/**
 * The Arena (brief §8), driven through jsdom.
 *
 * The Arena is a launcher, so what matters is that each tile reports real state
 * and that nothing claims an action that did not happen — the class of bug D-30
 * removed. In particular a duel that is still waiting must not show a score,
 * because `verdict` is only present once both sides have submitted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { duelCta, duelStateFor, mountArena } from '../../src/v5/arena';

const bridge = (duelState: unknown) => {
  (window as unknown as { Cultured?: unknown }).Cultured = { duelState };
};

let host: HTMLElement | null = null;
let handle: { destroy(): void } | null = null;

const mount = async (options: Parameters<typeof mountArena>[1] = {}) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  handle = mountArena(host, options);
  await Promise.resolve();
  return host;
};

describe('duelStateFor', () => {
  it('is none with no duel', () => {
    expect(duelStateFor(null)).toEqual({ kind: 'none' });
  });

  it('treats a record with no id as none', () => {
    expect(duelStateFor({})).toEqual({ kind: 'none' });
  });

  it('is waiting — with no score — while the other side is missing', () => {
    expect(duelStateFor({ id: 'd1', verdict: null })).toEqual({ kind: 'waiting', id: 'd1' });
  });

  it('is revealed only once a verdict exists', () => {
    expect(
      duelStateFor({ id: 'd1', verdict: { score: 4, of: 5, line: 'same damage' } }),
    ).toEqual({ kind: 'revealed', id: 'd1', score: 4, of: 5, line: 'same damage' });
  });

  it('tolerates a verdict with no line', () => {
    const state = duelStateFor({ id: 'd1', verdict: { score: 2, of: 5 } });
    expect(state.kind).toBe('revealed');
    if (state.kind === 'revealed') expect(state.line).toBe('');
  });
});

describe('duelCta', () => {
  it('never prints a score for a waiting duel', () => {
    const label = duelCta({ kind: 'waiting', id: 'd1' });
    expect(label).toBe('Duel live · waiting');
    expect(label).not.toMatch(/\d/);
  });

  it('prints the score once revealed', () => {
    expect(duelCta({ kind: 'revealed', id: 'd1', score: 4, of: 5, line: '' })).toBe('Revealed · 4/5');
  });

  it('invites when there is no duel', () => {
    expect(duelCta({ kind: 'none' })).toBe('Enter the duel');
  });
});

describe('the Arena screen', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as { Cultured?: unknown }).Cultured;
  });

  afterEach(() => {
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it('offers all three games', async () => {
    const root = await mount();
    const games = [...root.querySelectorAll<HTMLElement>('[data-game]')].map((n) => n.dataset.game);
    expect(games).toEqual(['duel', 'nhie', 'icebreaker']);
  });

  it('invites to the duel when there is none', async () => {
    bridge(() => null);
    const root = await mount();
    expect(root.textContent).toContain('Enter the duel');
    expect(root.querySelector('.v5-arena-waiting')).toBeNull();
  });

  it('says waiting, and shows no score, while the other side is missing', async () => {
    bridge(() => ({ id: 'd1', verdict: null }));
    const root = await mount();
    expect(root.textContent).toContain('Duel live · waiting');
    expect(root.querySelector('.v5-arena-waiting')).not.toBeNull();
    // The point: a partial is never revealed as a score.
    expect(root.textContent).not.toContain('Revealed');
  });

  it('shows the verdict only once both sides are in', async () => {
    bridge(() => ({ id: 'd1', verdict: { score: 4, of: 5, line: 'Four out of five. Same damage.' } }));
    const root = await mount();
    expect(root.textContent).toContain('Revealed · 4/5');
    expect(root.textContent).toContain('Four out of five. Same damage.');
  });

  it('reads the duel state live, not from a snapshot taken at mount', async () => {
    let current: { id: string; verdict: null } | null = { id: 'd1', verdict: null };
    bridge(() => current);
    const root = await mount();
    expect(root.textContent).toContain('Duel live · waiting');

    // A verdict landing later must be visible on the next paint.
    current = null;
    handle?.destroy();
    handle = null;
    host?.remove();
    const second = await mount();
    expect(second.textContent).toContain('Enter the duel');
  });

  it('routes a tapped tile to onOpenGame', async () => {
    const onOpenGame = vi.fn();
    const root = await mount({ onOpenGame });
    root.querySelector<HTMLElement>('[data-game="nhie"]')!.click();
    expect(onOpenGame).toHaveBeenCalledWith('nhie');
  });

  it('offers no refresh control, because there is nothing to fetch', async () => {
    const root = await mount();
    expect(root.querySelector('[data-act="arena-refresh"]')).toBeNull();
    expect(root.textContent).not.toContain('new signals');
  });

  it('tears down cleanly', async () => {
    await mount();
    handle?.destroy();
    handle = null;
    expect(document.querySelector('.v5-arena')).toBeNull();
  });
});
