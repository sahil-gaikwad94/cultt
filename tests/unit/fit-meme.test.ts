/**
 * `fitMeme` — the meme-caption shrinker.
 *
 * jsdom does no layout, so `scrollHeight` and `clientHeight` are both 0 there
 * and the shrinking loop never runs. Every test that renders the feed therefore
 * exercises only the early return, which is exactly how a rewrite of this logic
 * could ship broken and stay green. This defines the geometry by hand so the
 * real code path executes.
 *
 * What it pins is the thing that was actually wrong. The old version reset the
 * font size and read `scrollHeight` inside a per-node loop, up to six times —
 * and in a browser every read that follows a write forces a synchronous layout.
 * A forced layout is not the same thing as a property read, so this counts
 * read-after-write transitions as the proxy jsdom can actually observe.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Trace {
  reads: number;
  /** Reads that followed a write: one forced layout each, in a real browser. */
  reflows: number;
}

/* The seam self-executes `init()` on import and reaches for the whole shell, so
   this has to be the real markup, not a stub. Lifted from feed-screen.test.ts. */
const SHELL = `
<div id="stage"><div id="phone">
  <section class="screen" id="s-feed"></section><section class="screen" id="s-arena"></section>
  <section class="screen" id="s-match"></section><section class="screen" id="s-people"></section>
  <section class="screen" id="s-you"></section>
  <div id="mini-player"></div><nav id="nav"></nav><div id="pages"></div><div id="sheetwrap"></div>
  <div id="overlay"></div><div id="onboard"></div>
  <div id="splash"><div class="sp-in"><div class="sp-fp draw" id="spfp"></div><div class="sp-w" id="spw"></div></div></div>
  <div id="toast" role="status"></div><div id="duel-page" hidden></div>
  <input type="file" id="photoIn" accept="image/*" multiple hidden>
</div></div>`;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
  document.body.innerHTML = SHELL;
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('Animation', class {});
  vi.resetModules();
});

/**
 * Replaces a <p> with one that reports overflow above `fitsBelow`, tracking
 * every scrollHeight read and every fontSize write so the interleaving is
 * visible.
 */
/* `wroteSinceRead` is shared across every instrumented node on purpose. A forced
   layout is a property of the pass, not of the element: in a browser, one
   invalidated layout serves every read that follows it until something writes
   again. Counting per node would report 12 for a batch that really costs 3. */
const instrument = (
  p: HTMLParagraphElement,
  fitsBelow: number,
  trace: Trace,
  flags: { wroteSinceRead: boolean },
) => {
  let size = 20;
  Object.defineProperty(p, 'clientHeight', { get: () => 40, configurable: true });
  Object.defineProperty(p, 'scrollHeight', {
    get: () => {
      trace.reads += 1;
      if (flags.wroteSinceRead) trace.reflows += 1;
      flags.wroteSinceRead = false;
      return size > fitsBelow ? 60 : 40;
    },
    configurable: true,
  });
  Object.defineProperty(p.style, 'fontSize', {
    get: () => (size === 20 ? '' : `${size}px`),
    set: (value: string) => {
      flags.wroteSinceRead = true;
      size = value === '' ? 20 : Number.parseFloat(value) || 20;
    },
    configurable: true,
  });
  return () => size;
};

const freshTrace = () => ({ trace: { reads: 0, reflows: 0 } as Trace, flags: { wroteSinceRead: false } });

const loadFitMeme = async () => {
  const mod = (await import('../../src/legacy')) as unknown as {
    seamInternals: { fitMeme?: (host: HTMLElement) => void };
  };
  expect(mod.seamInternals.fitMeme, 'the seam did not register fitMeme').toBeTruthy();
  return mod.seamInternals.fitMeme as (host: HTMLElement) => void;
};

describe('fitMeme', () => {
  it('does nothing on an empty host and does not throw', async () => {
    const fitMeme = await loadFitMeme();
    expect(() => fitMeme(document.querySelector('#s-feed') as HTMLElement)).not.toThrow();
    fitMeme(null as unknown as HTMLElement);
  });

  it('shrinks an overflowing caption until it fits', async () => {
    const fitMeme = await loadFitMeme();
    const host = document.querySelector('#s-feed') as HTMLElement;
    host.innerHTML = '<div class="mm-card"><p>a caption that is too long</p></div>';
    const { trace, flags } = freshTrace();
    const size = instrument(host.querySelector('p') as HTMLParagraphElement, 16, trace, flags);

    fitMeme(host);

    expect(size()).toBeLessThanOrEqual(16);
    expect(size()).toBeGreaterThanOrEqual(10);
  });

  it('leaves a caption that already fits alone', async () => {
    const fitMeme = await loadFitMeme();
    const host = document.querySelector('#s-feed') as HTMLElement;
    host.innerHTML = '<div class="mm-card"><p>short</p></div>';
    const { trace, flags } = freshTrace();
    const size = instrument(host.querySelector('p') as HTMLParagraphElement, 40, trace, flags);

    fitMeme(host);

    expect(size()).toBe(20);
    /* One, not zero: resetting the inline font size is a write, and measuring
       after it is a layout. That one is unavoidable — it is the baseline every
       node has to be measured against. */
    expect(trace.reflows).toBe(1);
  });

  it('never shrinks below the old floor of 10px', async () => {
    const fitMeme = await loadFitMeme();
    const host = document.querySelector('#s-feed') as HTMLElement;
    host.innerHTML = '<div class="mm-card"><p>never fits</p></div>';
    const { trace, flags } = freshTrace();
    // fitsBelow of 0 means it overflows forever; only the floor stops it.
    const size = instrument(host.querySelector('p') as HTMLParagraphElement, 0, trace, flags);

    fitMeme(host);

    expect(size()).toBe(10);
  });

  it('takes one layout per round for the whole batch, not one per node', async () => {
    const fitMeme = await loadFitMeme();
    const host = document.querySelector('#s-feed') as HTMLElement;
    host.innerHTML =
      '<div class="mm-card"><p>one</p></div><div class="mm-card"><p>two</p></div>' +
      '<div class="mm-card"><p>three</p></div><div class="mm-card"><p>four</p></div>';
    const { trace, flags } = freshTrace();
    for (const p of host.querySelectorAll('p')) instrument(p, 16, trace, flags);

    fitMeme(host);

    for (const p of host.querySelectorAll('p')) {
      expect(Number.parseFloat(p.style.fontSize)).toBeLessThanOrEqual(16);
    }
    /* 20 -> 18 -> 16 is two shrinking rounds, so three read-after-write
       transitions: the reset, then one per round. The old per-node loop cost
       one per node per round — twelve on a six-card feed, every render. */
    expect(trace.reflows).toBeLessThanOrEqual(3);
  });

  it('costs the same number of layouts for 4 captions as for 12', async () => {
    const fitMeme = await loadFitMeme();
    const count = async (nodes: number) => {
      const host = document.querySelector('#s-feed') as HTMLElement;
      host.innerHTML = Array.from({ length: nodes }, (_, i) => `<div class="mm-card"><p>caption ${i}</p></div>`).join('');
      const { trace, flags } = freshTrace();
      for (const p of host.querySelectorAll('p')) instrument(p, 16, trace, flags);
      fitMeme(host);
      return trace.reflows;
    };

    expect(await count(12)).toBe(await count(4));
  });

  it('is idempotent: a second pass changes nothing', async () => {
    const fitMeme = await loadFitMeme();
    const host = document.querySelector('#s-feed') as HTMLElement;
    host.innerHTML = '<div class="mm-card"><p>caption</p></div>';
    const { trace, flags } = freshTrace();
    const size = instrument(host.querySelector('p') as HTMLParagraphElement, 16, trace, flags);

    fitMeme(host);
    const after = size();
    fitMeme(host);
    expect(size()).toBe(after);
  });
});
