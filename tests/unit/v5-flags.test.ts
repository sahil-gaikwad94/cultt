/**
 * The v5 flag gate — the seam every v5 screen hangs off.
 *
 * This is the one piece of config that decides whether a user sees the old app
 * or the new one, and it was entirely untested. The two failures it guards
 * against are mirror images of each other:
 *
 *   - a flag defaulting to `true` ships a half-built screen to everyone, which
 *     is the acceptance criterion "no half-built screens visible";
 *   - a flag failing to resolve from `?v5=1` means the work is invisible and
 *     the preview shows nothing.
 *
 * Every key is asserted, not sampled: adding a sixth screen and forgetting to
 * wire its resolution is exactly the mistake this catches.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, readV5Config } from '../../src/store/config';

const V5_KEYS = ['intro', 'home', 'vault', 'profile', 'stories', 'matrix', 'people', 'arena'] as const;

const setUrl = (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
};

const setConfig = (v5: Record<string, boolean> | undefined) => {
  (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG = { v5 };
};

describe('the v5 flag gate', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('');
    delete (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG;
  });

  afterEach(() => {
    setUrl('');
    delete (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG;
  });

  it('defaults every screen off, so main ships nothing half-built', () => {
    const { v5 } = readV5Config();
    for (const key of V5_KEYS) expect(v5[key], `${key} should default off`).toBe(false);
  });

  it('matches DEFAULT_CONFIG, so the literal and the resolver cannot drift', () => {
    const { v5 } = readV5Config();
    expect(v5).toEqual(DEFAULT_CONFIG.v5);
    // If a screen is added to one and not the other, this is what fails.
    expect(Object.keys(v5).sort()).toEqual([...V5_KEYS].sort());
  });

  it('turns the whole shell on with ?v5=1', () => {
    setUrl('?v5=1');
    const { v5 } = readV5Config();
    for (const key of V5_KEYS) expect(v5[key], `${key} should be on under ?v5=1`).toBe(true);
  });

  it('ignores ?v5=0 and any other value', () => {
    for (const search of ['?v5=0', '?v5=true', '?v5', '?v5=']) {
      setUrl(search);
      const { v5 } = readV5Config();
      for (const key of V5_KEYS) expect(v5[key], `${key} should stay off for ${search}`).toBe(false);
    }
  });

  it('lets one explicit key opt a single screen in on its own', () => {
    setConfig({ home: true });
    const { v5 } = readV5Config();
    expect(v5.home).toBe(true);
    expect(v5.matrix).toBe(false);
    expect(v5.arena).toBe(false);
  });

  it('lets one explicit key opt a single screen back out of ?v5=1', () => {
    setUrl('?v5=1');
    setConfig({ home: false });
    const { v5 } = readV5Config();
    // The documented escape hatch: turn the shell on, take one screen back.
    expect(v5.home).toBe(false);
    expect(v5.matrix).toBe(true);
    expect(v5.people).toBe(true);
  });

  it('survives a missing window.location without throwing', () => {
    // hasParam wraps URLSearchParams in try/catch for non-browser contexts.
    expect(() => readV5Config(null)).not.toThrow();
    expect(readV5Config(null).v5.home).toBe(false);
  });
});

describe('the demo gate', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('');
    delete (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG;
  });

  afterEach(() => {
    setUrl('');
    delete (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG;
  });

  it('is off by default, so production gets no invented population', () => {
    expect(readV5Config().demo).toBe(false);
  });

  it('turns on with ?demo=1', () => {
    setUrl('?demo=1');
    expect(readV5Config().demo).toBe(true);
  });

  it('turns on with an explicit config value', () => {
    expect(readV5Config({ demo: true }).demo).toBe(true);
  });

  it('ignores ?demo=0', () => {
    setUrl('?demo=0');
    expect(readV5Config().demo).toBe(false);
  });

  it('is independent of the v5 shell flag', () => {
    setUrl('?v5=1');
    // ?v5=1 turns the screens on but must not smuggle in fake people.
    const config = readV5Config();
    expect(config.v5.home).toBe(true);
    expect(config.demo).toBe(false);
  });
});
