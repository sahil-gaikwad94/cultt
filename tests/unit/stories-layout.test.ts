/**
 * Story layout: the artwork is fitted, never cropped or stretched.
 *
 * The bug this pins is a CSS one. The stage was `flex: 1`, so its box was
 * whatever vertical space the header and footer left behind — never 9:16 — and
 * `object-fit: cover` on top of that cropped the punchline off every meme. The
 * first meme in the corpus is 700×368, so a tall box with `cover` throws away
 * most of its width. The composer was worse: it previewed at 9/14 with `cover`,
 * a different crop from the viewer, so what you composed was not what you got.
 *
 * Half of this reads the stylesheet, because the geometry lives there and a
 * jsdom mount cannot tell you what `object-fit` resolved to.
 */

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountStories } from '../../src/v5/stories';
import { createStore, setStoreForTests } from '../../src/store';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');
const MEME_ID = 'meme-1be6203cfa22';

// `import.meta.url` is not a file URL under vitest's jsdom environment, so
// resolve against the project root instead.
const css = () => readFileSync(`${process.cwd()}/src/v5/styles.css`, 'utf8');

/** Pulls the declarations of the first rule whose selector list matches. */
const ruleFor = (source: string, selector: string): string => {
  const at = source.indexOf(selector);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  const open = source.indexOf('{', at);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
};

let raf: number[] = [];

beforeEach(async () => {
  localStorage.clear();
  const created = createStore({ storage: null, legacy: null, now: () => T0 });
  /* The store hydrates from persistence in a microtask and commits whatever it
     loads, which is empty here. Writing before that resolves is silently
     overwritten, so the story has to go in after `ready`. */
  await created.ready;
  created.putStory({
    id: 'story-layout',
    ownerId: 'me',
    /* `src/v5/stories.ts` filters on `Date.now()` rather than the store's
       injected clock (lines 145, 282, 366), so a T0-relative expiry reads as
       long expired and the rail renders its empty state. Noted in STATUS.md;
       this test is about layout, so it uses the real clock. */
    createdAt: Date.now() - 60_000,
    expiresAt: Date.now() + 60 * 60_000,
    layers: [{ type: 'meme', id: MEME_ID }],
    audience: 'everyone',
    hideFrom: [],
    replyRule: 'react',
  });
  setStoreForTests(created);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
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

describe('the story stage geometry', () => {
  it('gives the viewer and the composer one shared aspect ratio', () => {
    const shared = ruleFor(css(), '.v5-story-stage,\n.v5-compose-preview');
    expect(shared).toContain('aspect-ratio: 9 / 16');
    // `flex: 1` is what made the box an arbitrary height in the first place.
    expect(shared).not.toContain('flex: 1');
  });

  it('fits the artwork with contain', () => {
    expect(ruleFor(css(), '.v5-story-fit')).toContain('object-fit: contain');
  });

  it('fills the letterbox with a blurred copy rather than dead space', () => {
    const under = ruleFor(css(), '.v5-story-under');
    expect(under).toContain('object-fit: cover');
    expect(under).toContain('blur(');
  });

  it('never re-applies cover to the fitted image', () => {
    /* The composer block sits later in the file and could reintroduce the crop.
       Every rule that mentions .v5-story-fit must either set contain or be the
       underlay. */
    const offending = css()
      .split('}')
      .filter((chunk) => chunk.includes('.v5-story-fit') && chunk.includes('object-fit: cover'));
    expect(offending).toEqual([]);
  });

  it('no longer previews the composer at a different ratio than the viewer', () => {
    expect(css()).not.toContain('aspect-ratio: 9 / 14');
  });
});

describe('the story viewer markup', () => {
  const open = () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const handle = mountStories(host, { ownerId: 'me' });
    const ring = host.querySelector<HTMLElement>('[data-view]');

    ring?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { host, handle };
  };

  it('renders a blurred underlay and a fitted image, same source', () => {
    const { host, handle } = open();
    const under = host.querySelector<HTMLImageElement>('.v5-story-under');
    const fit = host.querySelector<HTMLImageElement>('.v5-story-fit');
    expect(under).toBeTruthy();
    expect(fit).toBeTruthy();
    expect(fit?.getAttribute('src')).toBe(under?.getAttribute('src'));
    expect(fit?.getAttribute('src')).toMatch(/\.webp$/);
    handle.destroy();
  });

  it('keeps the alt text on the fitted image and hides the underlay', () => {
    const { host, handle } = open();
    const under = host.querySelector<HTMLImageElement>('.v5-story-under');
    const fit = host.querySelector<HTMLImageElement>('.v5-story-fit');
    expect(under?.getAttribute('aria-hidden')).toBe('true');
    expect(under?.getAttribute('alt')).toBe('');
    expect(fit?.getAttribute('alt')?.length).toBeGreaterThan(0);
    handle.destroy();
  });

  it('carries the fallback hook on both, so a dead asset degrades the same way', () => {
    const { host, handle } = open();
    for (const img of host.querySelectorAll<HTMLImageElement>('.v5-story-under, .v5-story-fit')) {
      expect(img.getAttribute('data-fbk')).toMatch(/\.webp$/);
    }
    handle.destroy();
  });

  it('tears down without leaving the stage behind', () => {
    const { host, handle } = open();
    expect(host.querySelector('.v5-story-stage')).toBeTruthy();
    handle.destroy();
    expect(host.querySelector('.v5-story-stage')).toBeNull();
  });
});
