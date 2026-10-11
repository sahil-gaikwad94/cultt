/**
 * The Dine-in screen — the Tomorrow tab's slot.
 *
 * Same shape as the Live screen: pure planning, markup out, no provider calls.
 * Booking is a deep link into Zomato or Swiggy with the name copied to the
 * clipboard; neither has a public API to reserve through. See
 * `src/lib/places/providers.ts`.
 */

import { buildDining, diningCuisines } from '../data/seed/dining';
import type { DateVibe, DiningSpot } from '../lib/places/types';
import { DATE_VIBES, SOURCE_LABEL } from '../lib/places/types';
import { bookingLink } from '../lib/places/providers';
import {
  chipRowHTML,
  esc,
  inr,
  posterSVG,
  sortRowHTML,
  sourceBadgeHTML,
  timeLabel,
  type SortId,
} from './places';

export interface DiningIcons {
  readonly place: string;
  readonly clock: string;
  readonly star: string;
  readonly send: string;
  readonly table: string;
}

export interface DiningFilters {
  readonly cuisine: string | null;
  readonly vibe: DateVibe | null;
  readonly sort: SortId;
}

export const DINING_SORTS: readonly { id: SortId; label: string }[] = [
  { id: 'rating', label: 'Top rated' },
  { id: 'cheap', label: 'Cheapest' },
  { id: 'near', label: 'Nearest' },
];

export interface DiningPlan {
  readonly shown: readonly DiningSpot[];
  readonly total: number;
  readonly cuisines: readonly { id: string; label: string }[];
  readonly vibes: readonly { id: string; label: string }[];
  readonly filters: DiningFilters;
  readonly emptyReason: 'none' | 'filter';
}

/**
 * Ordering within a sort. Open beats closed before price or name ever get a
 * say: at 23:40 a 4.6 that is shut is worse than a 4.4 that is not.
 */
const tiebreak = (a: DiningSpot, b: DiningSpot, now: number): number =>
  openRank(a, now) - openRank(b, now) ||
  b.rating - a.rating ||
  a.priceForTwo - b.priceForTwo ||
  a.name.localeCompare(b.name);

const openRank = (spot: DiningSpot, now: number): number => {
  const state = openState(spot, now);
  return state === 'open' ? 0 : state === 'closing-soon' ? 1 : 2;
};

export const planDining = (
  spots: readonly DiningSpot[],
  filters: DiningFilters,
  now: number,
): DiningPlan => {
  const cuisines = diningCuisines(spots).map((cuisine) => ({ id: cuisine, label: cuisine }));
  const vibes = DATE_VIBES.map((vibe) => ({ id: vibe.id, label: vibe.label }));

  const filtered = spots.filter((spot) => {
    if (filters.cuisine && !spot.cuisines.includes(filters.cuisine)) return false;
    if (filters.vibe && !spot.goodFor.includes(filters.vibe)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'cheap':
        return a.priceForTwo - b.priceForTwo || tiebreak(a, b, now);
      case 'near':
        return a.distanceKm - b.distanceKm || tiebreak(a, b, now);
      case 'rating':
      default:
        return tiebreak(a, b, now);
    }
  });

  return {
    shown: filtered,
    total: spots.length,
    cuisines,
    vibes,
    filters,
    emptyReason: spots.length === 0 ? 'none' : 'filter',
  };
};

const MINUTES = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
};

/**
 * Is it open right now? Handles the two cases that break naive comparisons:
 * a close time after midnight (`17:00`–`01:00`) and a render at 00:20, where
 * "now" belongs to yesterday's session rather than today's.
 */
export const openState = (
  spot: DiningSpot,
  now: number,
): 'open' | 'closing-soon' | 'closed' => {
  const open = MINUTES(spot.opensAt);
  let close = MINUTES(spot.closesAt);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return 'closed';
  if (close <= open) close += 1440;

  const d = new Date(now);
  let current = d.getHours() * 60 + d.getMinutes();
  if (current < open) current += 1440;

  if (current < open) return 'closed';
  if (current >= close) return 'closed';
  return close - current <= 45 ? 'closing-soon' : 'open';
};

export const OPEN_LABEL = {
  open: 'Open now',
  'closing-soon': 'Closing soon',
  closed: 'Closed now',
} as const;

export const diningCardHTML = (
  spot: DiningSpot,
  now: number,
  icons: DiningIcons,
  index: number,
): string => {
  const link = bookingLink(spot);
  const state = openState(spot, now);
  return `<article class="pl-card dine stg" style="--d:${Math.min(index + 1, 8)}" data-id="${esc(spot.id)}">
    <div class="pl-art">
      ${posterSVG(spot.poster)}
      <div class="pl-date"><b>${spot.rating.toFixed(1)}</b><span>${icons.star}</span></div>
      ${sourceBadgeHTML(SOURCE_LABEL[spot.source])}
    </div>
    <div class="pl-body">
      <div class="pl-kind">${esc(spot.cuisines.join(' · '))}</div>
      <h3 class="pl-title">${esc(spot.name)}</h3>
      <p class="pl-pitch">${esc(spot.pitch)}</p>
      <ul class="pl-meta">
        <li>${icons.place}<span>${esc(spot.area)} · ${spot.distanceKm.toFixed(1)} km</span></li>
        <li>${icons.clock}<span>${esc(timeLabel(spot.opensAt))} – ${esc(timeLabel(spot.closesAt))}</span></li>
      </ul>
      <div class="pl-tags">${spot.goodFor
        .map((vibe) => `<span class="pl-tag">${esc(DATE_VIBES.find((v) => v.id === vibe)?.label ?? vibe)}</span>`)
        .join('')}</div>
      <div class="pl-foot">
        <div class="pl-price"><b>${esc(inr(spot.priceForTwo, spot.currency))}</b><span>for two</span></div>
        <span class="pl-open is-${esc(state)}">${esc(OPEN_LABEL[state])}</span>
      </div>
      <div class="pl-acts">
        <button type="button" class="pl-book" data-act="dn-book" data-id="${esc(spot.id)}" data-fx="sharego" title="${esc(link.hint)}">${icons.table}<span>Reserve · ${esc(link.label)}</span></button>
        <button type="button" class="ibtn" data-act="dn-invite" data-id="${esc(spot.id)}" data-fx="share" aria-label="Invite a match to ${esc(spot.name)}">${icons.send}</button>
      </div>
    </div>
  </article>`;
};

const heroHTML = (plan: DiningPlan, now: number, city: string): string => {
  const open = plan.shown.filter((spot) => openState(spot, now) !== 'closed').length;
  return `<header class="pl-hero stg">
    <span class="eyebrow">Dine-in · ${esc(city)}</span>
    <h2>${plan.shown.length === 0 ? 'Nothing matches that yet' : `${plan.shown.length} table${plan.shown.length === 1 ? '' : 's'} worth booking${open ? `, ${open} open now` : ''}`}</h2>
    <p class="hint">Sample listings while there is no live feed — Reserve opens Zomato or Swiggy with the name already copied, so booking takes one paste.</p>
  </header>`;
};

export interface DiningScreenOptions {
  readonly now: number;
  readonly icons: DiningIcons;
  readonly keptHTML?: string;
  readonly keptLabel?: string;
}

export const diningScreenHTML = (
  spots: readonly DiningSpot[],
  options: DiningScreenOptions,
): string => diningScreenWithPlanHTML(planDining(spots, { cuisine: null, vibe: null, sort: 'rating' }, options.now), options);

export const diningScreenWithPlanHTML = (plan: DiningPlan, options: DiningScreenOptions): string => {
  const { now, icons } = options;
  const city = plan.shown[0]?.city ?? 'your area';
  return `<div class="pl-wrap">
    ${heroHTML(plan, now, city)}
    ${chipRowHTML('dn-cuisine', plan.cuisines, plan.filters.cuisine)}
    ${chipRowHTML('dn-vibe', plan.vibes, plan.filters.vibe)}
    ${sortRowHTML('dn-sort', DINING_SORTS, plan.filters.sort)}
    <div class="pl-list">
      ${
        plan.shown.length
          ? plan.shown.map((spot, index) => diningCardHTML(spot, now, icons, index)).join('')
          : `<div class="pl-empty"><span aria-hidden="true">🍽️</span><p class="hint">${
              plan.emptyReason === 'filter'
                ? 'Nothing open for that combination. Drop a filter and try again.'
                : 'No listings in this pack yet.'
            }</p></div>`
      }
    </div>
    ${
      options.keptHTML
        ? `<details class="pl-keep"><summary>${esc(options.keptLabel ?? 'Tomorrow’s draft')}</summary><div class="pl-keep-body">${options.keptHTML}</div></details>`
        : ''
    }
  </div>`;
};

export const diningPack = (): DiningSpot[] => buildDining();
