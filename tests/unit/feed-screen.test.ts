/**
 * The Culture Feed — the typed planner, and the legacy seam that renders it.
 *
 * Two halves on purpose.
 *
 * The first exercises `src/screens/feed.ts` as the pure module it is: the drop
 * order, the gallery pages, the topic mapping, the `<img>` attributes. Those are
 * the rules that used to live inline in a `@ts-nocheck` file and were wrong —
 * the hero deck drew placeholder text cards, the gallery was hard-capped at six
 * of twenty, and the topic tabs were a toast.
 *
 * The second imports `src/legacy.ts` into a real DOM and clicks through the
 * feed. No test in this repo loaded the seam before, which is why a header
 * claiming "12 of 17 shown" over six cards survived review: the planner was
 * never checked against what the user actually saw.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FEED_TOPICS,
  GALLERY_PAGE_SIZE,
  TOPIC_FOR_CATEGORY,
  categoryLabel,
  corpus,
  dropArtHTML,
  gallerySectionHTML,
  imgAttrs,
  localDaySeed,
  memeArt,
  memeById,
  nonEmptyTopics,
  planDrop,
  planGallery,
  topicOf,
} from '../../src/screens/feed';
import { MEME_CATEGORY_SLUGS } from '../../src/copy/taxonomy';
import type { MemeEntry } from '../../src/content/types';

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

const sample = (i: number, category: string, axis: string): MemeEntry => ({
  id: `meme-${i}`,
  kind: 'image',
  src: `/memes/meme-0${i}.webp`,
  title: `Meme ${i}`,
  category,
  mood: 'Feral',
  axis: axis as MemeEntry['axis'],
  placard: 'Fine.',
  alt: `Meme ${i}. Fine.`,
  credit: null,
  rightsCleared: true,
  width: 700,
  height: 400,
  bytes: 1000,
  dominant: '#123456',
  blurhash: 'L00000',
  durationMs: null,
  poster: null,
  variants: [
    { width: 480, avif: `/memes/gen/meme-0${i}-480.avif`, webp: `/memes/gen/meme-0${i}-480.webp` },
    { width: 960, avif: `/memes/gen/meme-0${i}-960.avif`, webp: `/memes/gen/meme-0${i}-960.webp` },
  ],
});

describe('the topic mapping', () => {
  it('covers all six seam topics and defaults an unknown category to life', () => {
    const targets = new Set(Object.values(TOPIC_FOR_CATEGORY));
    expect(targets).toEqual(new Set(['work', 'screen', 'life', 'love']));
    expect(topicOf(sample(1, 'a-category-nobody-mapped', 'deadpan'))).toBe('life');
  });

  it('maps every category the pipeline can emit', () => {
    // build-memes.ts throws on a category outside this list, so an unmapped one
    // would mean a meme silently disappears behind a tab it never appears under.
    for (const slug of MEME_CATEGORY_SLUGS) {
      const topic = topicOf(sample(1, slug, 'deadpan'));
      expect(FEED_TOPICS.map((t) => t.id)).toContain(topic);
    }
  });

  it('never offers a tab with nothing behind it', () => {
    const onlyWork = [sample(1, 'dev-tears', 'deadpan'), sample(2, 'corporate-hostage', 'dry_wit')];
    expect(nonEmptyTopics(onlyWork)).toEqual(['all', 'work']);
    expect(nonEmptyTopics(corpus()).length).toBeGreaterThan(2);
  });
});

describe('memeArt', () => {
  it('emits a responsive srcset and the original as the fallback', () => {
    const art = memeArt(sample(1, 'dev-tears', 'deadpan'));
    expect(art.src).toBe('/memes/gen/meme-01-960.webp');
    expect(art.fb).toBe('/memes/meme-01.webp');
    expect(art.srcset).toContain('/memes/gen/meme-01-480.avif 480w');
    expect(art.srcset).toContain('/memes/gen/meme-01-960.webp 960w');
    expect(art.dominant).toBe('#123456');
  });

  it('falls back to the original when there are no variants', () => {
    const art = memeArt({ ...sample(1, 'dev-tears', 'deadpan'), variants: [] });
    expect(art.src).toBe('/memes/meme-01.webp');
    expect(art.srcset).toBeNull();
  });

  it('puts the fallback and the intrinsic size on the tag itself', () => {
    const attrs = imgAttrs(sample(1, 'dev-tears', 'deadpan'));
    expect(attrs).toContain('data-fbk="/memes/meme-01.webp"');
    expect(attrs).toContain('srcset=');
    expect(attrs).toContain('width="700" height="400"');
    expect(attrs).toContain('loading="lazy"');
  });
});

describe('planGallery', () => {
  const pool = [
    ...Array.from({ length: 5 }, (_, i) => sample(i + 1, 'dev-tears', 'deadpan')),
    ...Array.from({ length: 4 }, (_, i) => sample(i + 6, 'main-character', 'wholesome')),
  ];

  it('counts from the first item, so the header cannot disagree with the cards', () => {
    // Regression: an earlier version sliced [cursor, cursor + pageSize) and
    // labelled the header with the cumulative total, so page two read
    // "12 of 17 shown" over six cards.
    const first = planGallery({ source: pool, limit: 4 });
    expect(first.items.map((m) => m.id)).toEqual(['meme-1', 'meme-2', 'meme-3', 'meme-4']);
    expect(first.shown).toBe(4);
    expect(first.total).toBe(9);
    expect(first.next).toBe(4 + GALLERY_PAGE_SIZE);

    const second = planGallery({ source: pool, limit: first.next ?? 0 });
    expect(second.items.map((m) => m.id)).toEqual(['meme-1', 'meme-2', 'meme-3', 'meme-4', 'meme-5', 'meme-6', 'meme-7', 'meme-8', 'meme-9'].slice(0, 10));
    expect(second.shown).toBe(second.items.length);
  });

  it('reports exhausted and stops offering more', () => {
    const page = planGallery({ source: pool, limit: 99 });
    expect(page.shown).toBe(9);
    expect(page.next).toBeNull();
    expect(page.exhausted).toBe(true);
    expect(page.remaining).toBe(0);
  });

  it('filters by topic and excludes what the drop deck is already showing', () => {
    expect(planGallery({ source: pool, topic: 'work' }).total).toBe(5);
    expect(planGallery({ source: pool, topic: 'life' }).total).toBe(4);
    expect(planGallery({ source: pool, exclude: new Set(['meme-1', 'meme-6']) }).total).toBe(7);
  });

  it('is deterministic for the same inputs', () => {
    const a = planGallery({ source: pool });
    const b = planGallery({ source: pool });
    expect(a.items.map((m) => m.id)).toEqual(b.items.map((m) => m.id));
  });
});

describe('planDrop', () => {
  const pool = [
    ...Array.from({ length: 4 }, (_, i) => sample(i + 1, 'dev-tears', 'deadpan')),
    ...Array.from({ length: 4 }, (_, i) => sample(i + 5, 'main-character', 'wholesome')),
  ];

  it('is stable for a given day and seed', () => {
    const a = planDrop({ source: pool, count: 3, seed: '20261011' });
    const b = planDrop({ source: pool, count: 3, seed: '20261011' });
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('rotates categories instead of serving four of the same thing', () => {
    const picked = planDrop({ source: pool, count: 4, seed: '20261011' });
    expect(new Set(picked.map((m) => m.category)).size).toBeGreaterThan(1);
  });

  it('changes when the day changes', () => {
    const a = planDrop({ source: pool, count: 4, seed: '20261011' });
    const b = planDrop({ source: pool, count: 4, seed: '20261012' });
    expect(a.map((m) => m.id)).not.toEqual(b.map((m) => m.id));
  });

  it('weights toward the axes the user reacts to, within the category rotation', () => {
    /* Four categories, each with one deadpan and one wholesome meme. Rotation
       takes one per category, so affinity decides *which* — every pick should
       be the wholesome half. (In a two-category pool this test would fail, and
       correctly: rotation deliberately refuses four cards from one category.) */
    const mixed = [
      sample(1, 'dev-tears', 'deadpan'), sample(2, 'dev-tears', 'wholesome'),
      sample(3, 'main-character', 'deadpan'), sample(4, 'main-character', 'wholesome'),
      sample(5, 'brain-rot', 'deadpan'), sample(6, 'brain-rot', 'wholesome'),
      sample(7, 'old-internet', 'deadpan'), sample(8, 'old-internet', 'wholesome'),
    ];
    const biased = planDrop({ source: mixed, count: 4, seed: '20261011', affinity: { wholesome: 1 } });
    expect(biased.map((m) => m.axis)).toEqual(['wholesome', 'wholesome', 'wholesome', 'wholesome']);

    const flat = planDrop({ source: mixed, count: 4, seed: '20261011' });
    expect(flat.filter((m) => m.axis === 'wholesome').length).toBeLessThan(4);
  });

  it('falls back to the whole corpus rather than an empty deck when seen eats it', () => {
    const everything = new Set(pool.map((m) => m.id));
    expect(planDrop({ source: pool, count: 2, seen: everything, seed: '20261011' })).toHaveLength(2);
  });

  it('derives its default seed from the local day', () => {
    const t = Date.parse('2026-10-11T12:00:00.000Z');
    expect(localDaySeed(t)).toMatch(/^\d{8}$/);
  });
});

describe('the rendered markup', () => {
  const icons = { like: '<svg id="l"/>', save: '<svg id="s"/>', share: '<svg id="h"/>' };

  it('keeps the class names the shipped CSS styles', () => {
    const html = gallerySectionHTML({ source: [sample(1, 'dev-tears', 'deadpan')], icons });
    for (const cls of ['mm stg', 'mm-h', 'mm-row', 'mm-card has-photo', 'mm-visual', 'mm-photo-wrap', 'mm-bar', 'mm-b']) {
      expect(html).toContain(cls);
    }
  });

  it('wires the buttons to the seam actions and passes the icons through', () => {
    const html = gallerySectionHTML({
      source: [sample(1, 'dev-tears', 'deadpan')],
      state: () => ({ liked: true, saved: false }),
      icons,
    });
    expect(html).toContain('data-act="mm-like"');
    expect(html).toContain('data-act="mm-save"');
    expect(html).toContain('data-act="mm-share"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('<svg id="l"/>');
  });

  it('says what is left instead of a bare "Show more"', () => {
    const pool = Array.from({ length: 9 }, (_, i) => sample(i + 1, 'dev-tears', 'deadpan'));
    const html = gallerySectionHTML({ source: pool, limit: 6 });
    expect(html).toContain('3 left');
    expect(html).toContain('data-next="12"');
    expect(gallerySectionHTML({ source: pool, limit: 99 })).not.toContain('data-act="mm-more"');
  });

  it('is honest when a topic is empty', () => {
    const html = gallerySectionHTML({ source: [sample(1, 'dev-tears', 'deadpan')], topic: 'love' });
    expect(html).toContain('Nothing in this corner yet');
    expect(html).not.toContain('mm-card');
  });

  it('uses the category display name, not the raw slug', () => {
    expect(categoryLabel(sample(1, 'dev-tears', 'deadpan'))).not.toBe('dev-tears');
    expect(gallerySectionHTML({ source: [sample(1, 'dev-tears', 'deadpan')] })).not.toContain('>dev-tears<');
  });

  it('renders the Daily Drop art as a real image', () => {
    const html = dropArtHTML(sample(1, 'dev-tears', 'deadpan'));
    expect(html).toContain('drop-photo');
    expect(html).toContain('srcset=');
    expect(html).not.toContain('mtxt'); // the old typographic card
  });

  it('resolves a meme by id for the affinity lookup', () => {
    expect(memeById(corpus()[0].id)?.id).toBe(corpus()[0].id);
    expect(memeById('not-a-meme')).toBeNull();
  });
});

/* ------------------------------------------------ the seam, in a real DOM */

describe('the Culture Feed, rendered by the legacy seam', () => {
  const feed = () => document.getElementById('s-feed') as HTMLElement;
  const cards = () => [...feed().querySelectorAll('.mm-card')];
  const header = () => feed().querySelector('.mm-n')?.textContent ?? '';
  const click = (selector: string) => {
    const el = feed().querySelector(selector);
    if (!el) throw new Error(`no element for ${selector}`);
    (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
    document.body.innerHTML = SHELL;
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    /* jsdom has no Web Animations API. The product code guards for that, and
       one of the assertions below is that the guard holds. */
    vi.stubGlobal('Animation', class {});
    vi.resetModules();
    await import('../../src/legacy');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    /* The shell is left in place rather than cleared. `splashInit` schedules a
       timeout that reaches for `#splash`, and emptying the body here made it
       fire against a null node after teardown. `beforeEach` replaces the whole
       shell anyway, so nothing leaks between tests. */
  });

  it('renders the licensed corpus, with a responsive srcset on every image', () => {
    const images = [...feed().querySelectorAll('img.mm-photo')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('data-fbk')).toMatch(/^\/memes\/[^/]+\.webp$/);
      expect(img.getAttribute('srcset')).toBeTruthy();
    }
  });

  it('leads the Daily Drop with real art, not the procedural text card', () => {
    expect(feed().querySelector('.dcard .drop-photo')).toBeTruthy();
    expect(feed().querySelector('.dcard .memeart .mtxt')).toBeNull();
  });

  it('does not repeat a drop meme in the gallery below it', () => {
    const drop = new Set(
      [...feed().querySelectorAll('.dcard .drop-photo')].map((img) => img.getAttribute('data-fbk')),
    );
    for (const card of cards()) {
      const img = card.querySelector('img.mm-photo');
      expect(drop.has(img?.getAttribute('data-fbk') ?? '')).toBe(false);
    }
  });

  it('offers a tab per topic that has content, and filtering actually filters', () => {
    const tabs = [...feed().querySelectorAll('.ftabs[data-k="mm"] .ft')] as HTMLElement[];
    expect(tabs.length).toBeGreaterThan(2);
    expect(tabs[0].dataset.v).toBe('all');

    const allCount = cards().length;
    click('.ftabs[data-k="mm"] .ft[data-v="work"]');
    const workCards = cards();
    expect(workCards.length).toBeLessThanOrEqual(allCount);
    expect(workCards.length).toBeGreaterThan(0);
    expect(Number.parseInt(header(), 10)).toBe(workCards.length);
  });

  it('keeps the card count and the header in step as pages are added', () => {
    expect(cards()).toHaveLength(GALLERY_PAGE_SIZE);
    expect(Number.parseInt(header(), 10)).toBe(GALLERY_PAGE_SIZE);

    click('[data-act="mm-more"]');
    expect(cards().length).toBeGreaterThan(GALLERY_PAGE_SIZE);
    expect(Number.parseInt(header(), 10)).toBe(cards().length);

    while (feed().querySelector('[data-act="mm-more"]')) click('[data-act="mm-more"]');
    expect(Number.parseInt(header(), 10)).toBe(cards().length);
    expect(header()).toContain('in this corner');
  });

  it('resets the pager when the topic changes', () => {
    click('[data-act="mm-more"]');
    const grown = cards().length;
    click('.ftabs[data-k="mm"] .ft[data-v="work"]');
    expect(cards().length).toBeLessThanOrEqual(grown);
    expect(Number.parseInt(header(), 10)).toBe(cards().length);
  });

  it('survives a trip to Tomorrow and back without duplicating the tab bar', () => {
    click('.ftabs[data-k="day"] .ft[data-v="1"]');
    expect(feed().querySelector('.draft')).toBeTruthy();
    expect(feed().querySelector('#mmhost')).toBeNull();

    click('.ftabs[data-k="day"] .ft[data-v="0"]');
    expect(cards().length).toBe(GALLERY_PAGE_SIZE);
    expect(feed().querySelectorAll('.ftabs[data-k="mm"]')).toHaveLength(1);
    expect(feed().querySelectorAll('.ftabs')).toHaveLength(2); // day tabs + topic tabs
  });

  it('marks a card liked and saved through the same buttons the user taps', () => {
    const card = cards()[0];
    const id = card.getAttribute('data-m') as string;
    (card.querySelector('[data-act="mm-like"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (card.querySelector('[data-act="mm-save"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const again = cards().find((c) => c.getAttribute('data-m') === id) as HTMLElement;
    expect(again.querySelector('[data-act="mm-like"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(again.querySelector('[data-act="mm-save"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  describe('like and save feedback', () => {
    const tap = (el: Element | null) =>
      (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    it('lands a like with a shockwave ring and a decaying halo', () => {
      const btn = cards()[0].querySelector('[data-act="mm-like"]') as HTMLElement;
      tap(btn);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.classList.contains('fx-glow')).toBe(true);
      expect(btn.querySelector('.fx-ring')).toBeTruthy();
    });

    it('fills the bookmark on save instead of only toasting', () => {
      const btn = cards()[0].querySelector('[data-act="mm-save"]') as HTMLElement;
      tap(btn);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.querySelector('.fx-fill')).toBeTruthy();
      // The card is marked, so a later visit still shows what was kept.
      expect(cards()[0].querySelector('.pin-stk')).toBeTruthy();
    });

    it('drains the fill again when a save is undone', () => {
      const btn = cards()[0].querySelector('[data-act="mm-save"]') as HTMLElement;
      tap(btn);
      tap(btn);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(cards()[0].querySelector('.pin-stk')).toBeNull();
    });

    it('escalates a double-tap into a combo, keyed to the card', () => {
      const card = cards()[0];
      const doubleTap = () => card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      doubleTap();
      expect(card.querySelector('.fx-bigheart')).toBeTruthy();
      expect(card.querySelector('.fx-combo')).toBeNull(); // a single tap is not a combo

      doubleTap();
      expect(card.querySelector('.fx-combo')?.textContent).toBe('×2');

      doubleTap();
      expect(card.querySelector('.fx-combo')?.textContent).toBe('×3');

      doubleTap();
      expect(card.querySelector('.fx-combo')?.textContent).toBe('×5 UNWELL');

      // The like is written once. A combo is cosmetic and cannot spend a laugh.
      const like = cards()
        .find((c) => c.getAttribute('data-m') === card.getAttribute('data-m'))
        ?.querySelector('[data-act="mm-like"]');
      expect(like?.getAttribute('aria-pressed')).toBe('true');
    });

    it('still lands every state change with motion off, and adds no decoration', () => {
      document.documentElement.classList.add('calm');
      const card = cards()[0];
      (card.querySelector('[data-act="mm-like"]') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      (card.querySelector('[data-act="mm-save"]') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const again = cards().find((c) => c.getAttribute('data-m') === card.getAttribute('data-m')) as HTMLElement;
      expect(again.querySelector('[data-act="mm-like"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(again.querySelector('[data-act="mm-save"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(feed().querySelectorAll('.fx-glow, .fx-fill, .fx-combo, .fx-ring')).toHaveLength(0);
      document.documentElement.classList.remove('calm');
    });
  });

  describe('the share sheet', () => {
    const tap = (el: Element | null) =>
      (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = () => document.querySelector('#sheetwrap .sheet') as HTMLElement | null;
    // closeSheet clears the markup after a 560 ms slide-out; the class is what
    // drops immediately, so it is the thing a synchronous assertion can see.
    const sheetOpen = () => document.querySelector('#sheetwrap')?.classList.contains('open') === true;
    const untilToast = async (tries = 50) => {
      for (let i = 0; i < tries; i += 1) {
        if (document.querySelector('#toast')?.textContent) return;
        await new Promise((r) => setTimeout(r, 5));
      }
    };
    const tiles = () => [...(sheet()?.querySelectorAll('.sh-tile') ?? [])] as HTMLElement[];

    it('opens with only the targets this device can actually deliver', () => {
      tap(cards()[0].querySelector('[data-act="mm-share"]'));
      expect(sheet()).toBeTruthy();
      const offered = tiles().map((t) => t.dataset.w);
      expect(offered).toContain('story');
      expect(offered).toContain('save');
      expect(offered).toContain('card');
      /* jsdom implements neither navigator.share nor navigator.clipboard, so
         neither tile may appear — an offered button that cannot work is
         exactly the defect this sheet is built to prevent. */
      expect(offered).not.toContain('more');
      expect(offered).not.toContain('copy');
      /* `match` follows the seeded population rather than the device, so it is
         asserted against the DOM rather than against a fixed expectation. */
      expect(offered.includes('match')).toBe(document.querySelectorAll('#sheetwrap').length > 0);
      for (const tile of tiles()) expect(tile.querySelector('span')?.textContent?.length).toBeGreaterThan(0);
    });

    it('adds a real story when the story tile is tapped', async () => {
      /* `beforeEach` calls `vi.resetModules()`, so the store the app is using is
         the freshly imported one — reach for it the same way, or this reads a
         stale singleton and sees nothing. */
      const { getStore: appStore } = await import('../../src/store');
      const ringIds = () =>
        new Set(
          [...document.querySelectorAll<HTMLElement>('#s-feed .sring:not(.add)')].map((r) => r.dataset.id ?? ''),
        );

      const before = ringIds();
      tap(cards()[0].querySelector('[data-act="mm-share"]'));
      tap(tiles().find((t) => t.dataset.w === 'story') as HTMLElement);

      /* The rail is rendered straight off the store, so a ring that was not
         there before is the proof the write landed and the UI followed. */
      const added = [...ringIds()].filter((id) => !before.has(id));
      expect(added).toHaveLength(1);
      expect(added[0]).toMatch(/^story-/);

      const mine = appStore()
        .getState()
        .stories.filter((st) => st.ownerId === 'me');
      expect(mine).toHaveLength(1);
      expect(mine[0]?.id).toBe(added[0]);
      expect(mine[0]?.layers).toEqual([expect.objectContaining({ type: 'meme' })]);
      expect(mine[0]?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('falls back to the raw image when there is no canvas to draw a card on', async () => {
      /* jsdom implements createElement('canvas') but returns null from
         getContext('2d'), which is exactly the "no canvas" branch
         renderShareCard is written for. It must hand back the image, not a
         success toast about a card that was never drawn. */
      tap(cards()[0].querySelector('[data-act="mm-share"]'));
      tap(tiles().find((t) => t.dataset.w === 'card') as HTMLElement);
      /* The canvas module is a dynamic import, so this needs real ticks, not a
         fixed microtask count. */
      await untilToast();
      /* jsdom cannot fetch the image, so the honest outcome is a failure
         message — the point is that it reports one instead of toasting
         success for a card that was never drawn. */
      const msg = document.querySelector('#toast')?.textContent ?? '';
      expect(msg).toBeTruthy();
      expect(msg.toLowerCase()).not.toContain('saved');
      expect(sheetOpen()).toBe(false);
    });

    it('saves the image when the save tile is tapped', async () => {
      tap(cards()[0].querySelector('[data-act="mm-share"]'));
      tap(tiles().find((t) => t.dataset.w === 'save') as HTMLElement);
      await new Promise((r) => setTimeout(r, 10));
      expect(document.querySelector('#toast')?.textContent ?? '').toBeTruthy();
      expect(sheetOpen()).toBe(false);
    });

    it('shows the meme it is about to share', () => {
      tap(cards()[0].querySelector('[data-act="mm-share"]'));
      expect(sheet()?.querySelector('.shp .mm-photo')).toBeTruthy();
    });
  });

  it('does not throw when the like burst runs without a Web Animations API', () => {
    /* jsdom has no Element.animate, which is the same shape as an old Android
       WebView. The state is written by the data-act handler, so the burst
       throwing used to take the rest of the handler down with it — the heart
       filled and the floating emoji, the haptic and the profile sync never ran.
       */
    const card = cards()[0];
    (card.querySelector('[data-act="mm-like"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const again = cards().find((c) => c.getAttribute('data-m') === card.getAttribute('data-m')) as HTMLElement;
    expect(again.querySelector('[data-act="mm-like"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(feed().querySelectorAll('i.bp')).toHaveLength(0);
  });
});
