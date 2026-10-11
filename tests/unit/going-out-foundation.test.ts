/**
 * The foundation under Concerts and Dine-in: partner deep links, saved plans,
 * calendar files and the procedural posters.
 *
 * These are the pieces that must be right before any UI is trusted: a booking
 * link that goes nowhere and a reminder at the wrong time are worse than no
 * feature at all.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { citySlug, openPartnerLink, partnerUrl, partnersLive, tableLinks, ticketLinks } from '../../src/lib/partners';
import { eventIcs, addMinutes, icsStamp, downloadIcs } from '../../src/lib/calendar';
import {
  clearOutings,
  isSaved,
  listOutings,
  outingFor,
  outingId,
  removeOuting,
  saveOuting,
  subscribeOutings,
  toggleOuting,
} from '../../src/lib/outings';
import { PALETTES, paletteFor, posterGradient, posterSvg, rng, seedHash, styleFor } from '../../src/lib/poster';

afterEach(() => {
  clearOutings();
  (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG = undefined;
});

describe('partner deep links', () => {
  it('builds a real BookMyShow search URL for a city, title and genre', () => {
    const url = partnerUrl('bookmyshow', ['Neon Monsoon', 'techno', 'Mumbai']);
    expect(url).toBe('https://in.bookmyshow.com/search?q=Neon%20Monsoon%20techno%20Mumbai');
  });

  it('keeps the city in the path for Zomato and the query for Swiggy', () => {
    expect(partnerUrl('zomato', ['Kari House'], 'Delhi NCR')).toBe(
      'https://www.zomato.com/delhi-ncr/restaurants?q=Kari%20House',
    );
    expect(partnerUrl('swiggy', ['biryani'])).toBe('https://www.swiggy.com/search?query=biryani');
  });

  it('slugs cities the way the partner sites do', () => {
    expect(citySlug('Delhi NCR')).toBe('delhi-ncr');
    expect(citySlug('Bengaluru')).toBe('bengaluru');
    expect(citySlug('  Goa  ')).toBe('goa');
  });

  it('offers BookMyShow first for tickets and Zomato first for a table', () => {
    expect(ticketLinks({ city: 'Pune', title: 'Low Tide', genre: 'indie' }).map((l) => l.id)).toEqual([
      'bookmyshow',
      'sortmyscene',
    ]);
    expect(tableLinks({ city: 'Pune', name: 'Kari House', cuisine: 'Konkani' }).map((l) => l.id)).toEqual([
      'zomato',
      'swiggy',
    ]);
  });

  it('is not "live" until an integration is configured', () => {
    expect(partnersLive()).toBe(false);
    (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG = { partners: { live: true } };
    expect(partnersLive()).toBe(true);
  });

  it('opens the web URL on a desktop pointer and reports which URL it used', () => {
    const open = vi.fn();
    const link = ticketLinks({ city: 'Mumbai', title: 'Neon Monsoon' })[0]!;
    const used = openPartnerLink(link, { open });
    expect(used).toBe(link.url);
    expect(open).toHaveBeenCalledWith(link.url);
  });
});

describe('calendar files', () => {
  it('stamps local wall-clock times', () => {
    expect(icsStamp('2026-10-14T20:30:00')).toBe('20261014T203000');
    expect(addMinutes('2026-10-14T23:30:00', 90)).toBe('2026-10-15T01:00:00');
  });

  it('writes a valid two-hour event with a two-hour reminder', () => {
    const ics = eventIcs({
      uid: 'concert:neon-monsoon:2026-10-14',
      title: 'Neon Monsoon',
      description: 'Doors 20:00',
      location: 'The Ballroom, Lower Parel',
      start: '2026-10-14T20:30:00',
      url: 'https://in.bookmyshow.com/search?q=Neon%20Monsoon',
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('DTSTART:20261014T203000');
    expect(ics).toContain('DTEND:20261014T223000');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:The Ballroom\\, Lower Parel');
  });

  it('downloads with the .ics extension and reports the filename', () => {
    const name = downloadIcs('neon-monsoon', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(name).toBe('neon-monsoon.ics');
  });
});

describe('saved plans', () => {
  const plan = {
    kind: 'concert' as const,
    refId: 'neon-monsoon',
    title: 'Neon Monsoon',
    subtitle: 'The Ballroom · Mumbai',
    date: '2026-10-14',
    time: '20:30',
    partner: 'bookmyshow',
    city: 'Mumbai',
  };

  it('saves, reads and removes a plan', () => {
    const saved = saveOuting(plan);
    expect(saved.id).toBe(outingId('concert', 'neon-monsoon', '2026-10-14'));
    expect(isSaved('concert', 'neon-monsoon')).toBe(true);
    expect(listOutings()).toHaveLength(1);
    removeOuting(saved.id);
    expect(isSaved('concert', 'neon-monsoon')).toBe(false);
    expect(outingFor('concert', 'neon-monsoon')).toBeNull();
  });

  it('replaces rather than duplicates the same plan for the same day', () => {
    saveOuting(plan);
    saveOuting({ ...plan, time: '21:00' });
    expect(listOutings()).toHaveLength(1);
    expect(listOutings()[0]!.time).toBe('21:00');
  });

  it('toggles off on the second call', () => {
    expect(toggleOuting(plan).saved).toBe(true);
    expect(toggleOuting(plan).saved).toBe(false);
    expect(listOutings()).toHaveLength(0);
  });

  it('notifies subscribers, and stops when unsubscribed', () => {
    const seen = vi.fn();
    const off = subscribeOutings(seen);
    saveOuting(plan);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    removeOuting(outingId('concert', 'neon-monsoon', '2026-10-14'));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('ignores anything in storage that is not a plan', () => {
    localStorage.setItem('cultured2:outings', JSON.stringify([{ nope: true }, plan]));
    expect(listOutings()).toHaveLength(1);
  });
});

describe('procedural posters', () => {
  it('is deterministic for a seed', () => {
    expect(posterSvg('neon-monsoon')).toBe(posterSvg('neon-monsoon'));
    expect(posterSvg('neon-monsoon')).not.toBe(posterSvg('kari-house'));
    expect(seedHash('neon-monsoon')).toBe(seedHash('neon-monsoon'));
  });

  it('stays inside the brand palettes and never draws text', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      expect(PALETTES).toContain(paletteFor(seed));
      const svg = posterSvg(seed);
      expect(svg).toContain('<svg');
      expect(svg).not.toContain('<text');
      expect(posterGradient(seed)).toContain('linear-gradient');
      expect(['aurora', 'rings', 'beam', 'grid', 'dusk']).toContain(styleFor(seed));
    }
  });

  it('draws the same number twice for the same seed', () => {
    const a = rng('seed');
    const b = rng('seed');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
