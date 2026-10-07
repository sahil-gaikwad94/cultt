/**
 * The v5 flag gate — the seam every v5 screen hangs off.
 *
 * v5 *is* the app, so the shell is on by default. The flags survive only as a
 * kill-switch: `?v5=0` drops the whole thing back to the legacy shell, and an
 * explicit per-screen value overrides either way. The two failures this guards
 * against are mirror images:
 *
 *   - a screen silently defaulting off ships the legacy app to everyone, which
 *     is the regression the v5 work exists to prevent;
 *   - the kill-switch failing to resolve means a bad surface cannot be turned
 *     off without a redeploy.
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

  it('defaults every screen on, because v5 is the app', () => {
    const { v5 } = readV5Config();
    for (const key of V5_KEYS) expect(v5[key], `${key} should default on`).toBe(true);
  });

  it('matches DEFAULT_CONFIG, so the literal and the resolver cannot drift', () => {
    const { v5 } = readV5Config();
    expect(v5).toEqual(DEFAULT_CONFIG.v5);
    // If a screen is added to one and not the other, this is what fails.
    expect(Object.keys(v5).sort()).toEqual([...V5_KEYS].sort());
  });

  it('stays on under ?v5=1 (the explicit form of the default)', () => {
    setUrl('?v5=1');
    const { v5 } = readV5Config();
    for (const key of V5_KEYS) expect(v5[key], `${key} should be on under ?v5=1`).toBe(true);
  });

  it('drops the whole shell back to legacy under ?v5=0', () => {
    setUrl('?v5=0');
    const { v5 } = readV5Config();
    for (const key of V5_KEYS) expect(v5[key], `${key} should be off under ?v5=0`).toBe(false);
  });

  it('treats any other ?v5 value as the default (on)', () => {
    for (const search of ['?v5=true', '?v5', '?v5=', '?v5=maybe']) {
      setUrl(search);
      const { v5 } = readV5Config();
      for (const key of V5_KEYS) expect(v5[key], `${key} should stay on for ${search}`).toBe(true);
    }
  });

  it('lets one explicit key turn a single screen off on its own', () => {
    setConfig({ home: false });
    const { v5 } = readV5Config();
    expect(v5.home).toBe(false);
    expect(v5.matrix).toBe(true);
    expect(v5.arena).toBe(true);
  });

  it('lets one explicit key turn a single screen back on under ?v5=0', () => {
    setUrl('?v5=0');
    setConfig({ home: true });
    const { v5 } = readV5Config();
    // The escape hatch in reverse: kill the shell, keep one surface.
    expect(v5.home).toBe(true);
    expect(v5.matrix).toBe(false);
    expect(v5.people).toBe(false);
  });

  it('survives a missing window.location without throwing', () => {
    // getParam wraps URLSearchParams in try/catch for non-browser contexts.
    expect(() => readV5Config(null)).not.toThrow();
    expect(readV5Config(null).v5.home).toBe(true);
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
    // The shell being on must not smuggle in fake people.
    const config = readV5Config();
    expect(config.v5.home).toBe(true);
    expect(config.demo).toBe(false);
  });
});
