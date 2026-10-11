/**
 * The Live screen — "Concerts in your area", the Rewind tab's slot.
 *
 * Pure planning plus markup, no DOM and no provider calls. The seam
 * (`src/legacy.ts`) supplies the icons, owns state, and turns a booking action
 * into a deep link plus a clipboard copy — see `src/lib/places/providers.ts`
 * for why it is a link and not an API call.
 */

import { buildConcerts, concertGenres } from '../data/seed/concerts';
import type { LiveEvent } from '../lib/places/types';
import { SEAT_LABEL, SOURCE_LABEL } from '../lib/places/types';
import { bookingLink } from '../lib/places/providers';
import {
  chipRowHTML,
  dayLabel,
  esc,
  inr,
  mediaHTML,
  posterSVG,
  sortRowHTML,
  sourceBadgeHTML,
  timeLabel,
  type SortId,
} from './places';

export interface LiveIcons {
  readonly ticket: string;
  readonly place: string;
  readonly clock: string;
  readonly send: string;
}

export interface LiveFilters {
  readonly genre: string | null;
  readonly sort: SortId;
}

export const LIVE_SORTS: readonly { id: SortId; label: string }[] = [
  { id: 'soon', label: 'Soonest' },
  { id: 'cheap', label: 'Cheapest' },
  { id: 'price-high', label: 'Priciest' },
  { id: 'az', label: 'A–Z' },
];

export interface LivePlan {
  readonly shown: readonly LiveEvent[];
  readonly total: number;
  readonly genres: readonly { id: string; label: string }[];
  readonly filters: LiveFilters;
  /**
   * Why the list is empty. Three genuinely different situations, and telling
   * them apart is the difference between advice that helps and advice that
   * cannot: a spent pack is not an empty pack, and neither is a filter.
   */
  readonly emptyReason: 'none' | 'past' | 'filter';
}

/**
 * Filter and order the pack. Pure, and deliberately stable: a tie never
 * reshuffles between renders, because a list that reorders under a scrolling
 * thumb is the fastest way to lose someone's place in it.
 */
/**
 * How long after doors an event stays listed. A 20:30 show is still worth
 * knowing about at 22:00 — people do leave late — but by morning it is history
 * and a "what's on" list that still shows it is lying by omission of time.
 */
export const LIVE_GRACE_MS = 3 * 60 * 60 * 1000;

export const planLive = (
  events: readonly LiveEvent[],
  filters: LiveFilters,
  now: number,
): LivePlan => {
  const genres = concertGenres(events).map((genre) => ({ id: genre, label: genre }));

  const upcoming = events.filter((event) => {
    const at = new Date(event.startsAt).getTime();
    return Number.isFinite(at) ? at + LIVE_GRACE_MS > now : false;
  });
  const filtered = filters.genre
    ? upcoming.filter((event) => event.genres.includes(filters.genre as string))
    : [...upcoming];

  const at = (event: LiveEvent): number => new Date(event.startsAt).getTime() || Number.POSITIVE_INFINITY;
  const tiebreak = (a: LiveEvent, b: LiveEvent): number =>
    at(a) - at(b) || a.priceFrom - b.priceFrom || a.id.localeCompare(b.id);

  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'cheap':
        return a.priceFrom - b.priceFrom || tiebreak(a, b);
      case 'price-high':
        return b.priceFrom - a.priceFrom || tiebreak(a, b);
      case 'az':
        return a.title.localeCompare(b.title) || tiebreak(a, b);
      case 'soon':
      default:
        return tiebreak(a, b);
    }
  });

  return {
    shown: filtered,
    total: events.length,
    genres,
    filters,
    emptyReason:
      events.length === 0 ? 'none' : upcoming.length === 0 ? 'past' : 'filter',
  };
};

const KIND_LABEL: Record<LiveEvent['kind'], string> = {
  concert: 'Concert',
  festival: 'Festival',
  comedy: 'Comedy',
  'open-mic': 'Open mic',
};

export const liveCardHTML = (event: LiveEvent, now: number, icons: LiveIcons, index: number): string => {
  const link = bookingLink(event);
  return `<article class="pl-card stg" style="--d:${Math.min(index + 1, 8)}" data-id="${esc(event.id)}">
    <div class="pl-art">
      ${mediaHTML(event.clip, event.poster)}
      <div class="pl-date"><b>${esc(dayLabel(event.startsAt, now))}</b><span>${esc(timeLabel(event.startsAt.slice(11, 16)))}</span></div>
      ${sourceBadgeHTML(SOURCE_LABEL[event.source])}
    </div>
    <div class="pl-body">
      <div class="pl-kind">${esc(KIND_LABEL[event.kind])} · ${esc(event.genres.join(' · '))}</div>
      <h3 class="pl-title">${esc(event.title)}</h3>
      <p class="pl-artist">${esc(event.artist)}</p>
      <p class="pl-pitch">${esc(event.pitch)}</p>
      <ul class="pl-meta">
        <li>${icons.place}<span>${esc(event.venue)} · ${esc(event.area)}</span></li>
        <li>${icons.clock}<span>Doors ${esc(timeLabel(event.doors))}${event.ageNote ? ` · ${esc(event.ageNote)}` : ''}</span></li>
      </ul>
      <div class="pl-foot">
        <div class="pl-price"><b>${esc(inr(event.priceFrom, event.currency))}</b><span>${event.priceFrom <= 0 ? 'entry' : 'onwards'}</span></div>
        <span class="pl-seats is-${esc(event.seats)}">${esc(SEAT_LABEL[event.seats])}</span>
      </div>
      <div class="pl-acts">
        <button type="button" class="pl-book" data-act="pl-book" data-id="${esc(event.id)}" data-fx="sharego" title="${esc(link.hint)}">${icons.ticket}<span>Get tickets · ${esc(link.label)}</span></button>
        <button type="button" class="ibtn" data-act="pl-invite" data-id="${esc(event.id)}" data-fx="share" aria-label="Invite a match to ${esc(event.title)}">${icons.send}</button>
      </div>
    </div>
  </article>`;
};

/**
 * The marquee. Rendered twice inside a translated track so the loop is
 * seamless, and paused by CSS under `prefers-reduced-motion`.
 */
const tickerHTML = (events: readonly LiveEvent[], now: number): string => {
  if (!events.length) return '';
  const items = events
    .map((event) => `<span class="pl-tick"><b>${esc(dayLabel(event.startsAt, now))}</b> ${esc(event.artist)}</span>`)
    .join('<i aria-hidden="true">✦</i>');
  return `<div class="pl-ticker" aria-hidden="true"><div class="pl-ticker-track">${items}<i aria-hidden="true">✦</i>${items}</div></div>`;
};

const heroHTML = (plan: LivePlan, now: number, city: string): string => {
  const tonight = plan.shown.filter((event) => dayLabel(event.startsAt, now) === 'Tonight').length;
  return `<header class="pl-hero stg">
    <span class="eyebrow">Live in ${esc(city)}</span>
    <h2>${plan.shown.length === 0 ? 'Nothing matches that yet' : `${plan.shown.length} thing${plan.shown.length === 1 ? '' : 's'} on${tonight ? `, ${tonight} tonight` : ''}`}</h2>
    <p class="hint">Sample listings while there is no live feed — the button opens a real search on the ticketing site, so what is actually on is one tap away.</p>
    ${tickerHTML(plan.shown, now)}
  </header>`;
};

export interface LiveScreenOptions {
  readonly now: number;
  readonly icons: LiveIcons;
  /** Rendered inside a <details> at the bottom so no existing feature is lost. */
  readonly keptHTML?: string;
  readonly keptLabel?: string;
}

export const liveScreenHTML = (events: readonly LiveEvent[], options: LiveScreenOptions): string => {
  const plan = planLive(events, { genre: null, sort: 'soon' }, options.now);
  return liveScreenWithPlanHTML(plan, options);
};

/** Split out so the seam can re-render with filters applied without rebuilding. */
export const liveScreenWithPlanHTML = (plan: LivePlan, options: LiveScreenOptions): string => {
  const { now, icons } = options;
  const city = plan.shown[0]?.city ?? 'your area';
  return `<div class="pl-wrap">
    ${heroHTML(plan, now, city)}
    ${chipRowHTML('pl-genre', plan.genres, plan.filters.genre)}
    ${sortRowHTML('pl-sort', LIVE_SORTS, plan.filters.sort)}
    <div class="pl-list">
      ${
        plan.shown.length
          ? plan.shown.map((event, index) => liveCardHTML(event, now, icons, index)).join('')
          : `<div class="pl-empty"><span aria-hidden="true">🎟️</span><p class="hint">${
              plan.emptyReason === 'filter'
                ? 'Nothing on for that filter. Try another genre, or clear it.'
                : plan.emptyReason === 'past'
                  ? 'Everything in this pack has already played. It refills with the day.'
                  : 'No listings in this pack yet.'
            }</p></div>`
      }
    </div>
    ${
      options.keptHTML
        ? `<details class="pl-keep"><summary>${esc(options.keptLabel ?? 'Yesterday’s rewind')}</summary><div class="pl-keep-body">${options.keptHTML}</div></details>`
        : ''
    }
  </div>`;
};

/** The pack, resolved against a clock. Re-exported so the seam has one import. */
export const livePack = (now: number): LiveEvent[] => buildConcerts(now);

/** Poster markup on its own, for the invite sheet thumbnail. */
export const livePosterHTML = (event: LiveEvent): string => posterSVG(event.poster);
