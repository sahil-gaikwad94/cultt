/**
 * The Match Matrix (brief §6.2), driven through jsdom.
 *
 * The invariant worth pinning is the one D-27 created: with the invented
 * population gated off, `getCandidates()` returns an empty list in production,
 * and the screen must explain the density gate rather than either crashing or
 * inventing faces to fill the space. The empty path is the common case, so it is
 * tested first.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compatLine, matrixStateFor, mountMatrix } from '../../src/v5/matrix';
import type { CandidateCard } from '../../src/lib/types';

const card = (over: Partial<{ id: string; score: number; calibrating: boolean; likesYou: boolean }> = {}): CandidateCard =>
  ({
    id: over.id ?? 'p1',
    profile: {
      displayName: 'Real Person',
      bio: 'A bio written by a person.',
      age: 27,
      city: 'Lisbon',
      distanceKm: 3.4,
      gender: 'woman',
      lookingFor: ['dating'],
    },
    tasteTwins: {
      score: over.score ?? 82,
      calibrating: over.calibrating ?? false,
      sharedArtists: ['Burial'],
      sharedGenres: [],
      sharedCategories: ['deadpan'],
    },
    likesYou: over.likesYou ?? false,
  }) as unknown as CandidateCard;

let host: HTMLElement | null = null;
let handle: { destroy(): void } | null = null;

const withRepo = (cards: CandidateCard[] | 'reject') => {
  const getCandidates = cards === 'reject' ? () => Promise.reject(new Error('offline')) : () => Promise.resolve(cards);
  (window as unknown as { Cultured?: unknown }).Cultured = { repo: { getCandidates } };
};

const mount = async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  handle = mountMatrix(host);
  // Let the repo promise settle.
  await Promise.resolve();
  await Promise.resolve();
  return host;
};

describe('matrixStateFor', () => {
  it('is loading before the fetch resolves', () => {
    expect(matrixStateFor(null)).toEqual({ kind: 'loading' });
  });

  it('is empty — not broken — when nobody is here', () => {
    expect(matrixStateFor([])).toEqual({ kind: 'empty' });
  });

  it('is calibrating when people exist but no score is honest yet', () => {
    const state = matrixStateFor([card({ calibrating: true }), card({ id: 'p2', calibrating: true })]);
    expect(state.kind).toBe('calibrating');
  });

  it('is ready once at least one score is honest', () => {
    const state = matrixStateFor([card({ calibrating: true }), card({ id: 'p2', calibrating: false })]);
    expect(state.kind).toBe('ready');
  });
});

describe('compatLine', () => {
  it('refuses to print a percentage while calibrating', () => {
    expect(compatLine(card({ calibrating: true, score: 91 }))).toBeNull();
  });

  it('labels an honest score', () => {
    expect(compatLine(card({ score: 94 }))).toBe('Taste twin');
    expect(compatLine(card({ score: 80 }))).toBe('Strong overlap');
  });
});

describe('the Matrix screen', () => {
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

  it('explains the density gate when the population is empty', async () => {
    withRepo([]);
    const root = await mount();
    expect(root.querySelector('.v5-matrix-empty')).not.toBeNull();
    expect(root.textContent).toContain('Nobody here yet');
    // The point of the gate: no invented faces fill the space.
    expect(root.querySelectorAll('.v5-matrix-card')).toHaveLength(0);
  });

  it('says calibrating rather than showing a number nobody earned', async () => {
    withRepo([card({ calibrating: true, score: 95 })]);
    const root = await mount();
    expect(root.textContent).toContain('Still calibrating');
    expect(root.textContent).not.toContain('95');
  });

  it('renders a real card, with its compat label and shared chips', async () => {
    withRepo([card({ score: 91 })]);
    const root = await mount();
    const el = root.querySelector('.v5-matrix-card');
    expect(el).not.toBeNull();
    expect(root.textContent).toContain('Real Person');
    expect(root.textContent).toContain('Taste twin');
    expect(root.textContent).toContain('Burial');
    expect(root.querySelector('.v5-matrix-actions')).not.toBeNull();
  });

  it('marks a mutual, which is the only reveal path', async () => {
    withRepo([card({ likesYou: true })]);
    const root = await mount();
    expect(root.textContent).toContain('You resonate.');
  });

  it('advances to the next card on Pass', async () => {
    withRepo([card({ id: 'p1' }), card({ id: 'p2', score: 70 })]);
    const root = await mount();
    expect(root.textContent).toContain('Real Person');
    root.querySelector<HTMLElement>('[data-pass]')!.click();
    expect(root.querySelector('.v5-matrix-card')?.getAttribute('data-id')).toBe('p2');
  });

  it('does not report an error as an empty city', async () => {
    withRepo('reject');
    const root = await mount();
    expect(root.textContent).not.toContain('Nobody here yet');
    expect(root.querySelector('.v5-matrix-empty')).not.toBeNull();
  });

  it('renders the empty state when there is no repo at all', async () => {
    const root = await mount();
    expect(root.textContent).toContain('Nobody here yet');
  });

  it('tears down cleanly', async () => {
    withRepo([card()]);
    await mount();
    handle?.destroy();
    handle = null;
    expect(document.querySelector('.v5-matrix')).toBeNull();
  });
});
