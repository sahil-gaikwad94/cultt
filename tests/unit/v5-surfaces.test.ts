/**
 * The four "marquee" v5 surfaces — intro, Vault, profile wall, Stories —
 * mounted into a real DOM.
 *
 * These are exactly the screens the brief leads with (5.5 s intro, the Vault,
 * profile-as-a-wall, Stories), and until now none of them had a dedicated mount
 * test: the intro was only checked frame-by-frame as a pure function, and the
 * other three were only exercised indirectly. A crash in any of their assembly
 * code would have shipped silently. This mounts each one and asserts it puts
 * something real on screen and tears down cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountIntro } from '../../src/v5/intro';
import { mountVault } from '../../src/v5/vault';
import { mountProfile } from '../../src/v5/profile';
import { mountStories } from '../../src/v5/stories';
import { createStore, setStoreForTests } from '../../src/store';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');

let raf: number[] = [];

beforeEach(() => {
  localStorage.clear();
  const store = createStore({ storage: null, legacy: null, now: () => T0 });
  setStoreForTests(store);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  // jsdom has no rAF loop; give the mounts one we can flush deterministically.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    raf.push(0);
    const id = raf.length;
    queueMicrotask(() => cb(performance.now()));
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  raf = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('the intro mounts and paints', () => {
  it('creates a stage and paints the first frame', async () => {
    // Match the seam in mount.ts, which builds and passes its own host.
    const host = document.createElement('div');
    document.body.appendChild(host);
    let resolveReady: (() => void) | undefined;
    const done = new Promise<void>((r) => (resolveReady = r));
    const memes = Array.from({ length: 5 }, (_, i) => ({
      src: `/memes/meme-0${i + 1}.webp`,
      alt: `meme ${i + 1}`,
    }));
    const handle = mountIntro({ host, memes, onDone: () => resolveReady?.() });
    await Promise.resolve();
    expect(host.querySelector('.v5-intro, [class*="intro"]')).not.toBeNull();
    // The seam in mount.ts feeds the intro `servableMemes(true)`; with an empty
    // pool the cold open rendered with zero cards (the bug this guards).
    expect(host.querySelectorAll('.v5-intro-card')).toHaveLength(5);
    handle.skip();
    await done.catch(() => {});
  });
});

describe('the Vault mounts', () => {
  it('renders the shelf and an empty-state hint', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountVault(host);
    expect(host.textContent).toMatch(/pin|shelf|save/i);
    handle.destroy();
    expect(document.body.contains(host.firstElementChild)).toBe(false);
  });
});

describe('the profile wall mounts', () => {
  it('renders the wall and the Fingerprint', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountProfile(host);
    expect(host.querySelector('.v5-profile')).not.toBeNull();
    expect(host.querySelector('.v5-fingerprint, .v5-fp-canvas')).not.toBeNull();
    handle.destroy();
  });

  it('is a modal with a close button as a layer', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountProfile(host);
    const root = host.querySelector('.v5-profile');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-modal')).toBe('true');
    expect(host.querySelector('[data-close]')).not.toBeNull();
    handle.destroy();
  });

  it('drops the dialog chrome when embedded as the You tab', () => {
    // main.ts mounts the wall into #s-you with { embedded: true }; there is
    // nothing to close back to, so no dialog role and no close button.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountProfile(host, { embedded: true });
    const root = host.querySelector('.v5-profile');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-modal')).toBeNull();
    expect(host.querySelector('[data-close]')).toBeNull();
    expect(host.querySelector('[data-edit]')).not.toBeNull();
    handle.destroy();
  });
});

describe('Stories mounts', () => {
  it('renders the Stories layer shell', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountStories(host);
    expect(host.textContent).not.toBe('');
    handle.destroy();
  });
});
