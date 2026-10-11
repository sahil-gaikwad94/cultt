/**
 * Dine-in — the planner's pure helpers, the catalogue's shape, and the mount.
 *
 * The pure tests pin the two things a booking screen can get wrong quietly:
 * which slots a day can still offer, and which listings a filter is allowed to
 * return. The mount tests prove the planner actually drives the page and that
 * `destroy()` leaves nothing — including timers — behind.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITIES, CUISINES, OCCASIONS, RESTAURANTS } from '../../src/data/seed/dining';
import {
  ALL_SLOTS,
  defaultPlan,
  filterRestaurants,
  mountDinein,
  planSummary,
  priceForTwoLabel,
  slotLabel,
  slotsFor,
} from '../../src/v5/dinein';

/** Mon 12 Oct 2026, local noon — every slot is still bookable. */
const NOON = new Date(2026, 9, 12, 12, 0, 0).getTime();
/** The same evening at 21:45 — only the last two slots survive. */
const LATE = new Date(2026, 9, 12, 21, 45, 0).getTime();

describe('slotLabel', () => {
  it('writes the wheel in 12-hour time', () => {
    expect(slotLabel('18:30')).toBe('6:30 PM');
    expect(slotLabel('20:30')).toBe('8:30 PM');
    expect(slotLabel('22:30')).toBe('10:30 PM');
  });

  it('handles the noon and midnight edges', () => {
    expect(slotLabel('12:00')).toBe('12:00 PM');
    expect(slotLabel('00:30')).toBe('12:30 AM');
  });
});

describe('slotsFor', () => {
  it('offers the whole wheel for a future day', () => {
    expect(slotsFor('tomorrow', NOON)).toEqual([...ALL_SLOTS]);
    expect(ALL_SLOTS).toHaveLength(9);
  });

  it('offers the whole wheel early today', () => {
    expect(slotsFor('today', NOON)).toEqual([...ALL_SLOTS]);
  });

  it('drops the slots that are already too close to book', () => {
    expect(slotsFor('today', LATE)).toEqual(['22:00', '22:30']);
  });

  it('offers nothing on a day that has passed', () => {
    expect(slotsFor('2020-01-01', NOON)).toEqual([]);
  });
});

describe('filterRestaurants', () => {
  it('filters by city', () => {
    const goa = filterRestaurants({ city: 'Goa' });
    expect(goa.length).toBeGreaterThan(0);
    expect(goa.every((restaurant) => restaurant.city === 'Goa')).toBe(true);
  });

  it('filters by cuisine, including a kitchen\u2019s secondary cuisines', () => {
    const coastal = filterRestaurants({ city: 'Mumbai', cuisine: 'Coastal' });
    expect(coastal.map((restaurant) => restaurant.id)).toContain('r_mum_amber');
    expect(coastal.every((restaurant) => restaurant.cuisines.includes('Coastal'))).toBe(true);
  });

  it('filters by occasion', () => {
    const firstDates = filterRestaurants({ city: 'Goa', occasion: 'First date' });
    expect(firstDates.length).toBeGreaterThan(0);
    expect(firstDates.every((restaurant) => restaurant.occasions.includes('First date'))).toBe(true);
  });

  it('caps the estimate for two', () => {
    const cheap = filterRestaurants({ price: 600 });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((restaurant) => restaurant.priceForTwo <= 600)).toBe(true);
  });

  it('combines city, cuisine, occasion and price', () => {
    const result = filterRestaurants({ city: 'Mumbai', cuisine: 'South Indian', occasion: 'Solo', price: 1000 });
    expect(result.map((restaurant) => restaurant.id)).toEqual(['r_mum_curd']);
  });

  it('treats All and empty values as no constraint', () => {
    expect(filterRestaurants({ city: 'All', cuisine: 'All', occasion: 'All', price: null })).toHaveLength(
      RESTAURANTS.length,
    );
  });
});

describe('priceForTwoLabel', () => {
  it('labels the number as an estimate and never invents a discount', () => {
    for (const restaurant of RESTAURANTS) {
      const label = priceForTwoLabel(restaurant);
      expect(label).toContain('est.');
      expect(label).toContain('₹');
      expect(label).toContain('for two');
      expect(label).not.toMatch(/%|off\b|was\b|save\b|deal|discount|free/i);
    }
  });

  it('uses Indian digit grouping', () => {
    const amber = RESTAURANTS.find((restaurant) => restaurant.id === 'r_mum_amber');
    expect(amber).toBeDefined();
    expect(priceForTwoLabel(amber as (typeof RESTAURANTS)[number])).toBe('est. ₹1,800 for two');
  });
});

describe('planSummary', () => {
  it('is stable and readable', () => {
    const restaurant = RESTAURANTS[0];
    const plan = { ...defaultPlan(), slot: '20:30', dayKey: 'tomorrow', occasion: 'Anniversary' };
    const summary = planSummary(restaurant, plan);
    expect(summary).toBe(planSummary(restaurant, plan));
    expect(summary).toContain(restaurant.name);
    expect(summary).toContain('8:30 PM');
    expect(summary).toContain('tomorrow');
    expect(summary).toContain('table for 2');
    expect(summary).toContain('Anniversary');
  });
});

describe('the dining catalogue', () => {
  it('has unique ids, three menu highlights and a poster seed each', () => {
    const ids = RESTAURANTS.map((restaurant) => restaurant.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const restaurant of RESTAURANTS) {
      expect(restaurant.menuHighlights).toHaveLength(3);
      expect(restaurant.posterSeed.length).toBeGreaterThan(0);
    }
  });

  it('keeps every listing in a known city and cuisine, with a real estimate', () => {
    for (const restaurant of RESTAURANTS) {
      expect(CITIES as readonly string[]).toContain(restaurant.city);
      expect(CUISINES as readonly string[]).toContain(restaurant.cuisine);
      expect(restaurant.priceForTwo).toBeGreaterThan(0);
      expect(restaurant.occasions.length).toBeGreaterThan(0);
      for (const occasion of restaurant.occasions) {
        expect(OCCASIONS as readonly string[]).toContain(occasion);
      }
    }
  });

  it('has something to show in every city', () => {
    for (const city of CITIES) {
      expect(RESTAURANTS.some((restaurant) => restaurant.city === city)).toBe(true);
    }
  });
});

describe('mountDinein', () => {
  let host: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0));
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const summaryText = (): string => host.querySelector('.dn-summary')?.textContent ?? '';

  it('renders the planner and follows the plan in the summary', () => {
    const handle = mountDinein(host);
    expect(host.querySelector('.v5-dinein')).not.toBeNull();
    expect(host.querySelector('.dn-title')?.textContent).toContain('Dine-in');
    expect(summaryText()).toContain('Table for 2');
    expect(summaryText()).toContain('First date');

    host.querySelector<HTMLButtonElement>('[data-party="1"]')?.click();
    expect(summaryText()).toContain('Table for 4');

    host.querySelector<HTMLButtonElement>('[data-slot="21:00"]')?.click();
    expect(summaryText()).toContain('9:00 PM');

    host.querySelector<HTMLButtonElement>('[data-occasion="Friends"]')?.click();
    expect(summaryText()).toContain('Friends');

    host.querySelector<HTMLButtonElement>('[data-day="tomorrow"]')?.click();
    expect(summaryText()).toContain('tomorrow');

    handle.destroy();
  });

  it('shows a real finding state, then results', () => {
    const handle = mountDinein(host);
    expect(host.querySelector('.dn-finding')).not.toBeNull();
    expect(host.querySelectorAll('.dn-card')).toHaveLength(0);

    vi.advanceTimersByTime(600);
    expect(host.querySelector('.dn-finding')).toBeNull();
    expect(host.querySelectorAll('.dn-card').length).toBeGreaterThan(0);

    handle.destroy();
  });

  it('persists the chosen city and shows only that city', () => {
    const handle = mountDinein(host);
    vi.advanceTimersByTime(600);

    host.querySelector<HTMLButtonElement>('[data-city="Goa"]')?.click();
    expect(localStorage.getItem('cultured2:dinein-city')).toBe('Goa');

    vi.advanceTimersByTime(600);
    const metas = Array.from(host.querySelectorAll('.dn-card-meta')).map((node) => node.textContent ?? '');
    expect(metas.length).toBeGreaterThan(0);
    expect(metas.every((meta) => meta.includes('Goa'))).toBe(true);

    handle.destroy();
  });

  it('shows an honest empty state and clears the filters', () => {
    const handle = mountDinein(host);
    vi.advanceTimersByTime(600);

    // Bengaluru has no Parsi kitchen, so this combination is honestly empty.
    host.querySelector<HTMLButtonElement>('[data-city="Bengaluru"]')?.click();
    vi.advanceTimersByTime(600);
    host.querySelector<HTMLButtonElement>('[data-cuisine="Parsi"]')?.click();
    vi.advanceTimersByTime(600);
    expect(host.querySelector('.dn-empty')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('.dn-empty [data-clear]')?.click();
    vi.advanceTimersByTime(600);
    expect(host.querySelector('.dn-empty')).toBeNull();
    expect(host.querySelectorAll('.dn-card').length).toBeGreaterThan(0);

    handle.destroy();
  });

  it('empties the host and clears its timers on destroy', () => {
    const handle = mountDinein(host);
    handle.destroy();
    expect(host.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

