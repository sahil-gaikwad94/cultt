/**
 * The Live and Dine-in screens.
 *
 * Three things are worth pinning:
 *
 *  1. The packs are labelled. Every seeded listing must carry a source the UI
 *     renders as a badge, so nobody mistakes the pack for live inventory.
 *  2. The planners are pure and stable. A list that reshuffles between renders
 *     loses your place in it, so ties resolve on id, not on array order.
 *  3. Booking is a link, never a promise. There is no public API behind these
 *     buttons and the copy must not imply there is one.
 */

import { describe, expect, it } from 'vitest';
import { LIVE_GRACE_MS, liveScreenWithPlanHTML, planLive } from '../../src/screens/live';
import { DINING_SORTS, openState, planDining } from '../../src/screens/dining';
import { buildConcerts } from '../../src/data/seed/concerts';
import { buildDining } from '../../src/data/seed/dining';
import { posterSVG, dayLabel, inr, timeLabel, daysUntil } from '../../src/screens/places';
import { ProviderNotConnected, bookingLink, searchProvider, searchTermFor } from '../../src/lib/places/providers';
import type { LiveFilters } from '../../src/screens/live';
import type { DiningFilters } from '../../src/screens/dining';

const NOON = new Date(2026, 9, 11, 12, 0, 0).getTime();
const liveFilters = (over: Partial<LiveFilters> = {}): LiveFilters => ({ genre: null, sort: 'soon', ...over });
const diningFilters = (over: Partial<DiningFilters> = {}): DiningFilters => ({
  cuisine: null,
  vibe: null,
  sort: 'rating',
  ...over,
});

describe('the seeded packs', () => {
  it('labels every listing as sample data', () => {
    for (const event of buildConcerts(NOON)) expect(event.source).toBe('demo');
    for (const spot of buildDining()) expect(spot.source).toBe('demo');
  });

  it('never puts a gig in the past, however long the repo sits untouched', () => {
    /* Dates are day offsets resolved against the clock, not frozen timestamps.
       A pack that shipped with `2026-03-01` on it would render as "last March"
       for anyone cloning this next year. */
    const events = buildConcerts(NOON);
    for (const event of events) {
      expect(new Date(event.startsAt).getTime()).toBeGreaterThan(NOON);
    }
  });

  it('resolves the same pack for the same clock', () => {
    const a = buildConcerts(NOON).map((e) => e.startsAt);
    const b = buildConcerts(NOON).map((e) => e.startsAt);
    expect(a).toEqual(b);
    /* Local time with an explicit offset, so the pack is unambiguous wherever
       it is read. The offset itself is not asserted — this runs in UTC here and
       in IST on the author's machine, and both are correct. */
    expect(a[0]).toMatch(/^2026-10-11T20:30:00[+-]\d{2}:\d{2}$/);
  });

  it('gives every listing a full four-colour palette and a valid style', () => {
    for (const event of buildConcerts(NOON)) {
      expect(event.poster.palette).toHaveLength(4);
      for (const colour of event.poster.palette) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['dusk', 'moon', 'wave', 'bauhaus', 'bloom']).toContain(event.poster.style);
    }
    for (const spot of buildDining()) expect(spot.poster.palette).toHaveLength(4);
  });

  it('keeps every price a non-negative integer of rupees', () => {
    for (const event of buildConcerts(NOON)) {
      expect(Number.isInteger(event.priceFrom)).toBe(true);
      expect(event.priceFrom).toBeGreaterThanOrEqual(0);
      expect(event.currency).toBe('INR');
    }
  });

  it('ships no clips, so the player never renders footage that is not there', () => {
    for (const event of buildConcerts(NOON)) expect(event.clip).toBeUndefined();
  });
});

describe('planLive', () => {
  const pack = () => buildConcerts(NOON);

  it('orders soonest first, and never reshuffles a tie', () => {
    const plan = planLive(pack(), liveFilters(), NOON);
    const times = plan.shown.map((e) => new Date(e.startsAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(planLive(pack(), liveFilters(), NOON).shown.map((e) => e.id)).toEqual(
      plan.shown.map((e) => e.id),
    );
  });

  it('sorts by price both ways and by title', () => {
    const cheap = planLive(pack(), liveFilters({ sort: 'cheap' }), NOON).shown.map((e) => e.priceFrom);
    expect(cheap).toEqual([...cheap].sort((a, b) => a - b));
    const dear = planLive(pack(), liveFilters({ sort: 'price-high' }), NOON).shown.map((e) => e.priceFrom);
    expect(dear).toEqual([...dear].sort((a, b) => b - a));
    const az = planLive(pack(), liveFilters({ sort: 'az' }), NOON).shown.map((e) => e.title);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
  });

  it('filters by genre and only offers genres that exist', () => {
    const plan = planLive(pack(), liveFilters({ genre: 'Ambient' }), NOON);
    expect(plan.shown.length).toBeGreaterThan(0);
    for (const event of plan.shown) expect(event.genres).toContain('Ambient');
    expect(plan.genres.map((g) => g.id)).not.toContain('K-Pop');
  });

  it('says the pack is spent rather than blaming the filter', () => {
    /* Well past the last listing plus the grace window. The pack is not empty —
       it is finished — and telling someone to change a filter would be advice
       that cannot possibly help. */
    const farFuture = NOON + 400 * 86_400_000;
    const plan = planLive(pack(), liveFilters(), farFuture);
    expect(plan.shown).toHaveLength(0);
    expect(plan.total).toBeGreaterThan(0);
    expect(plan.emptyReason).toBe('past');
  });

  it('says "try another filter" when the chips are what hid everything', () => {
    const plan = planLive(pack(), liveFilters({ genre: 'Ambient', sort: 'cheap' }), NOON);
    expect(plan.shown.length).toBeGreaterThan(0);
    const narrower = planLive(pack(), liveFilters({ genre: 'Comedy' }), NOON);
    expect(narrower.emptyReason).toBe('filter');
    expect(narrower.shown.length).toBeGreaterThan(0);
    /* An empty pack is a third case again, and must not claim the filter did it. */
    expect(planLive([], liveFilters({ genre: 'Jazz' }), NOON).emptyReason).toBe('none');
  });

  it('drops a gig only after the grace window, not at doors', () => {
    const packNow = pack();
    const first = packNow[0];
    const start = new Date(first.startsAt).getTime();
    expect(planLive(packNow, liveFilters(), start + 1000).shown.map((e) => e.id)).toContain(first.id);
    expect(planLive(packNow, liveFilters(), start + LIVE_GRACE_MS + 1000).shown.map((e) => e.id)).not.toContain(
      first.id,
    );
  });

  it('rejects a listing with an unparseable date rather than sorting it first', () => {
    const bad = [{ ...buildConcerts(NOON)[0], startsAt: 'not a date' }];
    expect(planLive(bad, liveFilters(), NOON).shown).toHaveLength(0);
  });

  it('never mutates the pack it was given', () => {
    const events = pack();
    const before = events.map((e) => e.id).join(',');
    planLive(events, liveFilters({ sort: 'az' }), NOON);
    expect(events.map((e) => e.id).join(',')).toBe(before);
  });
});

describe('planDining', () => {
  const pack = () => buildDining();

  it('ranks open tables above closed ones before it looks at the rating', () => {
    /* 13:00 local. Two rooms are open — the 4.7 Mediterranean and the 4.4
       lunch-only thali — and every evening place is shut. The open 4.7 has to
       lead, and every closed room has to sit below every open one regardless
       of rating. */
    const onePm = new Date(2026, 9, 11, 13, 0, 0).getTime();
    const shown = planDining(pack(), diningFilters(), onePm).shown;
    expect(shown[0]?.id).toBe('dine-04');
    const firstClosed = shown.findIndex((spot) => openState(spot, onePm) === 'closed');
    const lastOpen = shown.map((spot) => openState(spot, onePm)).lastIndexOf('open');
    expect(lastOpen).toBeLessThan(firstClosed);
  });

  it('sorts by price and by distance on request', () => {
    const cheap = planDining(pack(), diningFilters({ sort: 'cheap' }), NOON).shown.map((s) => s.priceForTwo);
    expect(cheap).toEqual([...cheap].sort((a, b) => a - b));
    const near = planDining(pack(), diningFilters({ sort: 'near' }), NOON).shown.map((s) => s.distanceKm);
    expect(near).toEqual([...near].sort((a, b) => a - b));
  });

  it('filters by cuisine and by what the table is good for', () => {
    const vegan = planDining(pack(), diningFilters({ cuisine: 'Thali' }), NOON);
    for (const spot of vegan.shown) expect(spot.cuisines).toContain('Thali');
    const dates = planDining(pack(), diningFilters({ vibe: 'first-date' }), NOON);
    expect(dates.shown.length).toBeGreaterThan(0);
    for (const spot of dates.shown) expect(spot.goodFor).toContain('first-date');
  });

  it('only offers filters that the pack can satisfy', () => {
    const plan = planDining(pack(), diningFilters(), NOON);
    expect(plan.cuisines.map((c) => c.id)).toContain('Maharashtrian');
    expect(plan.cuisines.map((c) => c.id)).not.toContain('Sushi');
    expect(plan.vibes.map((v) => v.id)).toContain('late-night');
  });

  it('offers every declared sort', () => {
    for (const option of DINING_SORTS) {
      expect(planDining(pack(), diningFilters({ sort: option.id }), NOON).shown.length).toBeGreaterThan(0);
    }
  });
});

describe('openState', () => {
  const spot = buildDining().find((s) => s.id === 'dine-03') as never;

  it('handles a close time after midnight', () => {
    const at = (h: number, m: number) => new Date(2026, 9, 11, h, m, 0).getTime();
    // Midnight Kettle runs 17:00 to 03:00.
    expect(openState(spot, at(18, 0))).toBe('open');
    expect(openState(spot, at(2, 45))).toBe('closing-soon');
    expect(openState(spot, at(4, 0))).toBe('closed');
    expect(openState(spot, at(9, 0))).toBe('closed');
  });

  it('treats 00:20 as yesterday’s session, not today’s', () => {
    const at = (h: number, m: number) => new Date(2026, 9, 12, h, m, 0).getTime();
    expect(openState(spot, at(0, 20))).toBe('open');
  });

  it('flags the last 45 minutes before the post-midnight close', () => {
    /* Closing is 03:00, which belongs to the next calendar day, so "45 minutes
       to go" is 02:15 — not 23:45. */
    const at = (h: number, m: number) => new Date(2026, 9, 11, h, m, 0).getTime();
    expect(openState(spot, at(23, 30))).toBe('open');
    expect(openState(spot, at(2, 14))).toBe('open');
    expect(openState(spot, at(2, 16))).toBe('closing-soon');
  });
});

describe('the booking seam', () => {
  it('links out and hands back the search term as well', () => {
    const event = buildConcerts(NOON)[0];
    const link = bookingLink(event as never);
    expect(link.url.startsWith('https://')).toBe(true);
    expect(link.url).toContain(encodeURIComponent(searchTermFor(event as never)));
    expect(link.label).toBe('BookMyShow');
    expect(link.searchUnavailable).toBe(false);
  });

  it('says plainly when a provider can only offer a city page', () => {
    const event = { ...buildConcerts(NOON)[2], provider: 'sortmyscene' as const };
    const link = bookingLink(event as never);
    expect(link.searchUnavailable).toBe(true);
    expect(link.url).toBe('https://www.sortmyscene.com/');
    expect(link.hint).toContain('copied');
    expect(link.term.length).toBeGreaterThan(0);
  });

  it('names the real destination on every listing', () => {
    for (const spot of buildDining()) expect(['Zomato', 'Swiggy']).toContain(bookingLink(spot).label);
  });

  it('refuses to pretend an API exists', async () => {
    await expect(searchProvider('zomato')).rejects.toBeInstanceOf(ProviderNotConnected);
    await expect(searchProvider('ticketmaster')).rejects.toThrow(/no public API|Ticketmaster/);
  });
});

describe('the Live screen markup', () => {
  const icons = { ticket: '<svg/>', place: '<svg/>', clock: '<svg/>', send: '<svg/>' };
  const farFuture = NOON + 400 * 86_400_000;

  it('renders an honest empty state rather than a blank screen', () => {
    const plan = planLive(buildConcerts(NOON), liveFilters(), farFuture);
    const html = liveScreenWithPlanHTML(plan, { now: farFuture, icons });
    expect(html).toContain('pl-empty');
    expect(plan.emptyReason).toBe('past');
    expect(html).toContain('already played');
    expect(html).not.toContain('Nothing on for that filter');
  });

  it('badges every card and names the destination on every button', () => {
    const html = liveScreenWithPlanHTML(planLive(buildConcerts(NOON), liveFilters(), NOON), { now: NOON, icons });
    const cards = (html.match(/class="pl-card/g) ?? []).length;
    expect(cards).toBeGreaterThan(3);
    /* Count the badge element, not the string: the hero copy also says "Sample
       listings", so a bare substring count over-reports by exactly one. */
    expect((html.match(/class="pl-src"/g) ?? []).length).toBe(cards);
    expect((html.match(/>Sample listing</g) ?? []).length).toBe(cards);
    expect((html.match(/Get tickets · /g) ?? []).length).toBe(cards);
  });

  it('escapes pack text into the markup', () => {
    const html = liveScreenWithPlanHTML(planLive(buildConcerts(NOON), liveFilters(), NOON), { now: NOON, icons });
    expect(html).not.toContain('<script');
    expect(html).toContain('aria-label="Invite a match to');
  });

  it('keeps the previous screen behind a labelled disclosure', () => {
    const html = liveScreenWithPlanHTML(planLive(buildConcerts(NOON), liveFilters(), NOON), {
      now: NOON,
      icons,
      keptHTML: '<p>old rewind</p>',
      keptLabel: 'Yesterday’s rewind',
    });
    expect(html).toContain('details class="pl-keep"');
    expect(html).toContain('<p>old rewind</p>');
  });
});

describe('the generated artwork', () => {
  it('is deterministic for a seed', () => {
    const poster = buildConcerts(NOON)[0].poster;
    expect(posterSVG(poster)).toBe(posterSVG(poster));
  });

  it('differs between seeds, and escapes nothing into the markup', () => {
    const a = posterSVG({ ...buildConcerts(NOON)[0].poster, seed: 1 });
    const b = posterSVG({ ...buildConcerts(NOON)[0].poster, seed: 2 });
    expect(a).not.toBe(b);
    for (const art of [a, b]) {
      expect(art).toContain('<svg');
      expect(art).toContain('</svg>');
      expect(art).toContain('role="img"');
      expect(art).not.toContain('undefined');
      expect(art).not.toContain('NaN');
    }
  });

  it('renders all five styles without a NaN coordinate', () => {
    for (const style of ['dusk', 'moon', 'wave', 'bauhaus', 'bloom'] as const) {
      const art = posterSVG({ palette: ['#111111', '#222222', '#333333', '#444444'], style, seed: 7 });
      expect(art).not.toContain('NaN');
    }
  });
});

describe('formatting', () => {
  it('calls zero free rather than showing ₹0', () => {
    expect(inr(0)).toBe('Free');
    expect(inr(799)).toBe('₹799');
    expect(inr(2499)).toBe('₹2,499');
  });

  it('labels tonight, tomorrow and a bare date', () => {
    const iso = (offsetDays: number) =>
      new Date(2026, 9, 11 + offsetDays, 20, 30, 0).toISOString();
    expect(dayLabel(iso(0), NOON)).toBe('Tonight');
    expect(dayLabel(iso(1), NOON)).toBe('Tomorrow');
    expect(dayLabel(iso(5), NOON)).toMatch(/Oct/);
    expect(dayLabel('nonsense', NOON)).toBe('');
    expect(daysUntil(iso(3), NOON)).toBe(3);
  });

  it('survives a 23:59 render without calling tomorrow tonight', () => {
    const late = new Date(2026, 9, 11, 23, 59, 0).getTime();
    const tomorrow = new Date(2026, 9, 12, 20, 30, 0).toISOString();
    expect(dayLabel(tomorrow, late)).toBe('Tomorrow');
  });

  it('renders a 12-hour clock and passes junk through untouched', () => {
    expect(timeLabel('20:30')).toBe('8:30 PM');
    expect(timeLabel('00:00')).toBe('12:00 AM');
    expect(timeLabel('12:05')).toBe('12:05 PM');
    expect(timeLabel('late')).toBe('late');
  });
});
