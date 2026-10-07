/**
 * The v5 flag gate.
 *
 * The original cultt screens are the app. The v5 screens are an alternative
 * behind `?v5=1`, kept for comparison rather than shipped as the default — the
 * v5 layout replaced too much of a design that already worked. The one v5 piece
 * that is on by default is the intro: its cold-open animation improved on the
 * original, and the legacy cold open is skipped when it runs.
 *
 * Every key is asserted, not sampled: adding a screen and forgetting to wire its
 * resolution is exactly the mistake this catches.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, readV5Config } from '../../src/store/config';

const V5_KEYS = ['intro', 'home', 'vault', 'profile', 'stories', 'matrix', 'people', 'arena'] as const;
const SCREENS = ['home', 'vault', 'profile', 'stories', 'matrix', 'people', 'arena'] as const;

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

  it('defaults the original screens on and the v5 screens off', () => {
    const { v5 } = readV5Config();
    for (const key of SCREENS) expect(v5[key], `${key} should default off (original screen shows)`).toBe(false);
  });

  it('keeps the v5 intro on by default', () => {
    expect(readV5Config().v5.intro).toBe(true);
  });

  it('matches DEFAULT_CONFIG, so the literal and the resolver cannot drift', () => {
    const { v5 } = readV5Config();
    expect(v5).toEqual(DEFAULT_CONFIG.v5);
    expect(Object.keys(v5).sort()).toEqual([...V5_KEYS].sort());
  });

  it('turns the v5 screens on with ?v5=1', () => {
    setUrl('?v5=1');
    const { v5 } = readV5Config();
    for (const key of SCREENS) expect(v5[key], `${key} should be on under ?v5=1`).toBe(true);
    expect(v5.intro).toBe(true);
  });

  it('ignores ?v5=0 and any other value (screens stay off)', () => {
    for (const search of ['?v5=0', '?v5=true', '?v5', '?v5=']) {
      setUrl(search);
      const { v5 } = readV5Config();
      for (const key of SCREENS) expect(v5[key], `${key} should stay off for ${search}`).toBe(false);
    }
  });

  it('lets one explicit key turn a single v5 screen on', () => {
    setConfig({ home: true });
    const { v5 } = readV5Config();
    expect(v5.home).toBe(true);
    expect(v5.matrix).toBe(false);
  });

  it('lets one explicit key turn the intro off', () => {
    setConfig({ intro: false });
    expect(readV5Config().v5.intro).toBe(false);
  });

  it('survives a missing window.location without throwing', () => {
    expect(() => readV5Config(null)).not.toThrow();
    expect(readV5Config(null).v5.home).toBe(false);
    expect(readV5Config(null).v5.intro).toBe(true);
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

  it('is independent of the v5 screen flag', () => {
    setUrl('?v5=1');
    const config = readV5Config();
    expect(config.v5.home).toBe(true);
    expect(config.demo).toBe(false);
  });
});
