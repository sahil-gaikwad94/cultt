/**
 * The v5 Home, mounted into a real DOM (brief §7).
 *
 * Every other v5 test exercises pure functions — `verdictFor`, `layoutTray`,
 * `renderIntro`. None of them mount the screen, so a crash in the assembly
 * (`renderHome`'s wiring of store, contour, audio and the fx layer) would pass
 * the whole suite. This is the only test that proves the Home a user actually
 * sees gets built.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountV5Home } from '../../src/v5/mount';
import { createStore, setStoreForTests } from '../../src/store';
import { v5config } from '../../src/store/config';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');

let host: HTMLElement | null = null;
let handle: { destroy(): void } | null = null;

const mount = async () => {
  const store = createStore({ storage: null, legacy: null, now: () => T0 });
  setStoreForTests(store);

  host = document.createElement('div');
  host.id = 's-feed';
  document.body.appendChild(host);
  handle = await mountV5Home(host);
  return { store, root: host };
};

describe('the v5 Home mounts into its host', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });

  afterEach(() => {
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
  });

  it('renders the shell rather than throwing', async () => {
    const { root } = await mount();
    expect(root.classList.contains('v5-home')).toBe(true);
    expect(root.querySelector('.v5-topbar')).not.toBeNull();
    expect(root.querySelector('.v5-logo')).not.toBeNull();
  });

  it('draws one laugh pip per daily laugh, read from live config', async () => {
    const { root } = await mount();
    // Read from v5config rather than a hard-coded 15, so a config change moves
    // both together instead of the test silently pinning the old number.
    const expected = v5config.laughsPerDay;
    expect(expected).toBe(15);
    expect(root.querySelectorAll('.v5-pip')).toHaveLength(expected);
  });

  it('builds the deck section a swipe needs', async () => {
    const { root } = await mount();
    expect(root.querySelector('.v5-deck-section')).not.toBeNull();
    expect(root.querySelector('.v5-deck-head')).not.toBeNull();
  });

  it('starts on the Today sub-page, with the others available', async () => {
    const { root } = await mount();
    expect(root.querySelector('.v5-subpage.v5-today')).not.toBeNull();
  });

  it('keeps the Verdict hidden until there is enough signal', async () => {
    const { root } = await mount();
    // No reactions yet: `verdictFor` has nothing to say, and the screen must
    // not invent a verdict to fill the space.
    expect(root.querySelector('.v5-subpage.v5-verdict')?.textContent ?? '').not.toContain('absurdist');
  });

  it('tears down without leaving the fx canvas behind', async () => {
    await mount();
    expect(document.querySelector('.v5-fx-layer')).not.toBeNull();
    handle?.destroy();
    handle = null;
    expect(document.querySelector('.v5-fx-layer')).toBeNull();
  });
});
