/**
 * The legacy shell, rendered for real in jsdom.
 *
 * This is the harness that catches wiring mistakes without a browser: the feed
 * has to come up with its stories rail and its Tonight strip, both going-out
 * days have to mount their module into `#go-mount`, and the share sheet has to
 * open from the meme gallery. Chromium cannot be installed in this sandbox, so
 * this is as close to "run the app" as the unit suite gets — and it is enough to
 * catch a missing mount, a broken import or a null host.
 */

import { beforeAll, describe, expect, it } from 'vitest';

const SHELL = `
<div id="phone">
  <section class="screen" id="s-feed"></section>
  <section class="screen" id="s-arena"></section>
  <section class="screen" id="s-match"></section>
  <section class="screen" id="s-people"></section>
  <section class="screen" id="s-you"></section>
  <nav id="nav"></nav>
  <div id="pages"></div>
  <div id="sheetwrap"></div>
  <div id="overlay"></div>
  <div id="onboard"></div>
  <div id="toast"></div>
  <div id="splash"><div class="sp-in"><div class="sp-fp draw" id="spfp"></div><div class="sp-w" id="spw"></div></div></div>
  <div id="duel-page" hidden></div>
  <input type="file" id="photoIn" hidden>
  <div id="mini-player"></div>
</div>`;

/** Waits for a condition that a dynamic import has to satisfy first. */
const waitFor = async (check: () => boolean, tries = 40): Promise<void> => {
  for (let i = 0; i < tries; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const tap = (selector: string): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

describe('the legacy shell', () => {
  /* The shell is an IIFE that runs once per module load, so the DOM is built and
     the module imported exactly once — the tests then drive the real UI, the way
     a user would. */
  beforeAll(async () => {
    localStorage.clear();
    document.body.innerHTML = SHELL;
    await import('../../src/legacy');
  });

  const showToday = (): void => tap('#s-feed .ft[data-v="0"]');

  it('brings the feed up with its stories rail, tonight strip and deck', () => {
    expect(document.querySelector('#s-feed #stories-rail')).not.toBeNull();
    expect(document.querySelector('#s-feed .tonight')).not.toBeNull();
    expect(document.querySelector('#s-feed .deck')).not.toBeNull();
    expect(document.querySelector('#s-feed .mm')).not.toBeNull();
  });

  it('labels the two going-out days and gives them a host', () => {
    const labels = Array.from(document.querySelectorAll('#s-feed .ft')).map((node) => node.textContent);
    expect(labels).toEqual(['Concerts', 'Today', 'Dine-in']);
    tap('#s-feed .ft[data-v="-1"]');
    expect(document.querySelector('#go-mount')?.getAttribute('data-go')).toBe('concerts');
    tap('#s-feed .ft[data-v="1"]');
    expect(document.querySelector('#go-mount')?.getAttribute('data-go')).toBe('dinein');
  });

  it('mounts the Concerts module into the day −1 host', async () => {
    tap('#s-feed .ft[data-v="-1"]');
    await waitFor(() => Boolean(document.querySelector('#go-mount .v5-concerts')));
    expect(document.querySelector('#go-mount .v5-concerts')).not.toBeNull();
  });

  it('mounts the Dine-in module into the day +1 host', async () => {
    tap('#s-feed .ft[data-v="1"]');
    await waitFor(() => Boolean(document.querySelector('#go-mount .v5-dinein')));
    expect(document.querySelector('#go-mount .v5-dinein')).not.toBeNull();
  });

  it('opens the share sheet from a meme in the gallery', async () => {
    showToday();
    tap('#s-feed .mm-card [data-act="mm-share"]');
    await waitFor(() => Boolean(document.querySelector('.sh-root')));
    expect(document.querySelector('.sh-sheet')).not.toBeNull();
    const rows = Array.from(document.querySelectorAll('.sh-tile b')).map((node) => node.textContent);
    expect(rows).toContain('Your story');
    expect(rows).toContain('Instagram story');
    expect(rows).toContain('Snapchat story');
  });

  it('opens Make it yours and applies an accent to the profile', async () => {
    tap('#nav [data-t="you"]');
    tap('#s-you [data-act="customize"]');
    expect(document.querySelector('.cust')).not.toBeNull();
    tap('#sheetwrap [data-act="prof-accent"][data-k="#35f2ff"]');
    expect(document.querySelector('#s-you')?.getAttribute('style')).toContain('#35f2ff');
  });
});
