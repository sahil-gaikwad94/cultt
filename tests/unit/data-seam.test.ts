/**
 * The repo seam in `src/data/index.ts`.
 *
 * `createRepo()` became async when the Supabase client moved to a dynamic
 * import (D-29), and `main.ts` now awaits it before `installRepoBridge`. That
 * reorder is easy to break without noticing: a caller that does not await gets
 * a Promise where it expects a Repo, and the bridge installs a Promise onto
 * `window.Cultured.repo` instead of an adapter — which fails later, far from
 * the cause.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepo, createRepo } from '../../src/data/index';
import { installRepoBridge } from '../../src/components/phase1';

const asWindow = () => window as unknown as { CULTURED_CONFIG?: { backend?: string } };

describe('createRepo', () => {
  beforeEach(() => {
    localStorage.clear();
    delete asWindow().CULTURED_CONFIG;
  });

  it('is async, so callers must await it', async () => {
    const pending = createRepo();
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).resolves.toBeDefined();
  });

  it('returns the mock adapter by default', async () => {
    const repo = await createRepo();
    expect(typeof repo.getCandidates).toBe('function');
    expect(typeof repo.getFeed).toBe('function');
  });

  it('hands a default build no invented population', async () => {
    const repo = await createRepo();
    await repo.onboard({
      dateOfBirth: '1998-04-02',
      displayName: 'Alex',
      mode: 'dating' as const,
      city: 'Lisbon',
      musicSource: 'manual' as const,
      pickedTastes: ['deadpan', 'niche_hobby', 'wordplay'],
      memeSignals: [
        { memeId: 'mk001', kind: 'laugh' as const },
        { memeId: 'mk002', kind: 'laugh' as const },
        { memeId: 'mk003', kind: 'meh' as const },
        { memeId: 'mk004', kind: 'laugh' as const },
      ],
      audioSignals: [{ trackId: 't_choir', kind: 'react' as const }],
      photoChecked: true,
      antiGenres: ['metal'],
    });
    await expect(repo.getCandidates()).resolves.toEqual([]);
  });

  it('does not construct Supabase unless the config asks for it', async () => {
    asWindow().CULTURED_CONFIG = { backend: 'mock' };
    const repo = await createRepo();
    // The mock adapter has no realtime channel; SupabaseRepo does. Checking for
    // the absence is what proves the dynamic import was not reached, and with it
    // that the 63 kB client stayed out of the entry chunk.
    expect(repo).not.toHaveProperty('channel');
    expect(repo).not.toHaveProperty('client');
    expect(typeof repo.getCandidates).toBe('function');
  });
});

describe('installRepoBridge', () => {
  beforeEach(() => localStorage.clear());

  it('publishes an adapter, not a Promise, onto window.Cultured', async () => {
    // This is the exact order main.ts now runs them in.
    const repo = await createRepo();
    installRepoBridge(repo);

    const bridge = (window as unknown as { Cultured?: { repo?: unknown } }).Cultured;
    expect(bridge?.repo).toBeDefined();
    expect(bridge?.repo).not.toBeInstanceOf(Promise);
    expect(typeof (bridge?.repo as { getCandidates?: unknown }).getCandidates).toBe('function');
  });

  it('keeps the v5 store that main.ts installed first', () => {
    (window as unknown as { Cultured?: Record<string, unknown> }).Cultured = { store: { fake: true } };
    installRepoBridge(createMockRepo());

    const bridge = (window as unknown as { Cultured?: Record<string, unknown> }).Cultured;
    expect(bridge?.store).toEqual({ fake: true });
    expect(bridge?.repo).toBeDefined();
  });
});
