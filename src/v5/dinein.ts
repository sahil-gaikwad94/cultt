/**
 * Dine-in (session plan D-40/D-42) — the home feed's book-a-date sub-page.
 *
 * A planner and a catalogue, in that order: party size, occasion, day and time
 * at the top; restaurants below. Every card's call to action follows the plan,
 * so the page reads as one decision rather than eighteen independent buttons.
 *
 * What it never does: invent a rating, a review count, a wait time, or a table.
 * A price is labelled an estimate, and a "Sample listing" chip stands in until
 * `partnersLive()` is true (D-27/D-30, applied to going out). Booking leaves for
 * Zomato or Swiggy through the deep links in `src/lib/partners.ts`; saving writes
 * a real `.ics` and a record in the outings store, so "Your plans" is true.
 */

import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import { getQuality } from './quality.ts';
import { openPartnerLink, partnersLive, tableLinks } from '../lib/partners.ts';
import type { PartnerLink } from '../lib/partners.ts';
import { downloadIcs, eventIcs } from '../lib/calendar.ts';
import { isSaved, listOutings, removeOuting, subscribeOutings, toggleOuting } from '../lib/outings.ts';
import type { Outing } from '../lib/outings.ts';
import { posterDataUri } from '../lib/poster.ts';
import { CITIES, CUISINES, OCCASIONS, RESTAURANTS, restaurantById } from '../data/seed/dining.ts';
import type { Restaurant } from '../data/seed/dining.ts';

export { CITIES, CUISINES, RESTAURANTS } from '../data/seed/dining.ts';

/* ------------------------------------------------------------------- plan - */

export type PartySize = 2 | 4 | 6;
/** Local `YYYY-MM-DD`, or the tokens `today` / `tomorrow`. */
export type DayKey = string;

export interface DinePlan {
  party: PartySize;
  occasion: string;
  slot: string;
  dayKey: DayKey;
}

export const PARTY_SIZES: readonly PartySize[] = [2, 4, 6];

/** 18:30 → 22:30, every 30 minutes. The wheel the planner scrolls. */
export const ALL_SLOTS: readonly string[] = [
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
  '22:30',
];

/** How far ahead a table has to be booked to still be plausible today. */
export const LEAD_MINUTES = 30;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const pad2 = (n: number): string => String(n).padStart(2, '0');

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** `20:30` → `8:30 PM`. Pure. */
export const slotLabel = (slot: string): string => {
  const [hRaw, mRaw] = slot.split(':');
  const hours = Number(hRaw);
  const minutes = Number(mRaw ?? '0');
  if (!Number.isFinite(hours)) return slot;
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad2(Number.isFinite(minutes) ? minutes : 0)} ${suffix}`;
};

/** Local calendar day of a timestamp, as `YYYY-MM-DD`. */
export const localDayKey = (now: number): string => {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const shiftDay = (dayKey: string, days: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return localDayKey(dt.getTime());
};

/** Resolves `today` / `tomorrow` / a date to a concrete local `YYYY-MM-DD`. */
export const resolveDayKey = (dayKey: DayKey, now: number): string => {
  if (dayKey === 'today') return localDayKey(now);
  if (dayKey === 'tomorrow') return shiftDay(localDayKey(now), 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : localDayKey(now);
};

const slotTime = (slot: string, day: string): number => {
  const [h, m] = slot.split(':').map(Number);
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0).getTime();
};

/**
 * The slots a day can actually offer. Today loses the times that are already
 * too close to book; a past day offers nothing at all. Never an empty-looking
 * lie — an empty array is the honest answer, and the UI disables Today then.
 */
export const slotsFor = (dayKey: DayKey, now: number = Date.now()): string[] => {
  const day = resolveDayKey(dayKey, now);
  const today = localDayKey(now);
  if (day < today) return [];
  if (day > today) return [...ALL_SLOTS];
  const cutoff = now + LEAD_MINUTES * 60_000;
  return ALL_SLOTS.filter((slot) => slotTime(slot, day) >= cutoff);
};

/** `today` → `today`, a date → `on Sat 12 Oct`. Pure. */
export const dayLabel = (dayKey: DayKey): string => {
  if (dayKey === 'today') return 'today';
  if (dayKey === 'tomorrow') return 'tomorrow';
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return 'that day';
  const dt = new Date(y, m - 1, d);
  return `on ${WEEKDAYS[dt.getDay()] ?? '?'} ${dt.getDate()} ${MONTHS[dt.getMonth()] ?? ''}`.trim();
};

export const defaultPlan = (): DinePlan => ({ party: 2, occasion: 'First date', slot: '19:30', dayKey: 'today' });

/** The planner's one-line summary of the plan itself. */
export const planLine = (plan: DinePlan): string =>
  `Table for ${plan.party} · ${plan.occasion} · ${slotLabel(plan.slot)} ${dayLabel(plan.dayKey)}`;

/** The same plan, tied to one restaurant. Stable and readable. */
export const planSummary = (restaurant: Restaurant, plan: DinePlan): string =>
  `${restaurant.name} — ${slotLabel(plan.slot)} ${dayLabel(plan.dayKey)} · table for ${plan.party} · ${plan.occasion}`;

/** An estimate, labelled as one. Never a struck-through price or a discount. */
export const priceForTwoLabel = (restaurant: Restaurant): string =>
  `est. ₹${restaurant.priceForTwo.toLocaleString('en-IN')} for two`;

/** Diet chips a card can show. Only what the data actually asserts. */
export const dietLabels = (restaurant: Restaurant): string[] => {
  const labels: string[] = [];
  if (restaurant.pureVeg) labels.push('Pure veg');
  if (restaurant.vegan) labels.push('Vegan');
  if (restaurant.jain) labels.push('Jain');
  if (restaurant.hasBar) labels.push('Bar');
  return labels;
};

export interface DineFilters {
  city?: string;
  cuisine?: string;
  occasion?: string;
  /** A ceiling on the estimate for two; `null` or `0` means no ceiling. */
  price?: number | null;
}

/** Pure. `All` and empty values are treated as "no constraint". */
export const filterRestaurants = (
  filters: DineFilters,
  list: readonly Restaurant[] = RESTAURANTS,
): Restaurant[] => {
  const { city, cuisine, occasion, price } = filters;
  return list.filter((restaurant) => {
    if (city && city !== 'All' && restaurant.city !== city) return false;
    if (cuisine && cuisine !== 'All' && restaurant.cuisine !== cuisine && !restaurant.cuisines.includes(cuisine)) {
      return false;
    }
    if (occasion && occasion !== 'All' && !restaurant.occasions.includes(occasion)) return false;
    if (price && price > 0 && restaurant.priceForTwo > price) return false;
    return true;
  });
};


export interface DineinOptions {
  /** Inserts a plan into the match thread. */
  onSendPlan?: (restaurant: Restaurant, plan: DinePlan) => void;
  onAddToStory?: (restaurant: Restaurant, plan: DinePlan) => void;
  onShare?: (restaurant: Restaurant) => void;
  onToast?: (message: string) => void;
}

export interface DineinHandle {
  destroy(): void;
}

export const CITY_KEY = 'cultured2:dinein-city';
export const DEFAULT_CITY = 'Mumbai';

const PRICE_CAPS: readonly { label: string; cap: number | null }[] = [
  { label: 'Any budget', cap: null },
  { label: 'Under ₹800', cap: 800 },
  { label: 'Under ₹1,500', cap: 1500 },
  { label: 'Under ₹2,500', cap: 2500 },
];

const COPY = {
  title: 'Dine-in dates',
  sub: 'Pick the table, then send it. Zomato and Swiggy hold the booking.',
  sample: 'Sample listing',
  party: 'Table for',
  occasion: 'Occasion',
  day: 'Day',
  time: 'Time',
  today: 'Today',
  tomorrow: 'Tomorrow',
  pickDay: 'Pick a day',
  cuisine: 'Cuisine',
  budget: 'Budget',
  all: 'All',
  clear: 'Clear filters',
  finding: 'Finding tables…',
  book: 'Book on Zomato',
  order: 'Order on Swiggy',
  send: 'Send as a plan',
  story: 'Add to story',
  save: 'Save',
  saved: 'Saved',
  plans: 'Your plans',
  plansEmpty: 'Nothing saved yet. A plan you save keeps its slot and lands in your calendar.',
  empty: 'No tables match that. Try another cuisine, or lift the budget.',
  sheetNote: 'cultured does not hold live availability. The partner opens the real listing.',
};

interface DineinState {
  city: string;
  plan: DinePlan;
  cuisine: string;
  price: number | null;
  phase: 'finding' | 'ready';
  sheet: Restaurant | null;
}

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export const mountDinein = (host: HTMLElement, options: DineinOptions = {}): DineinHandle => {
  const root = document.createElement('div');
  root.className = 'v5-dinein';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', COPY.title);

  const readCity = (): string => {
    try {
      const stored = localStorage.getItem(CITY_KEY);
      if (stored && (CITIES as readonly string[]).includes(stored)) return stored;
    } catch {
      /* Private mode: fall through to the default. */
    }
    return DEFAULT_CITY;
  };

  const state: DineinState = {
    city: readCity(),
    plan: defaultPlan(),
    cuisine: 'All',
    price: null,
    phase: 'finding',
    sheet: null,
  };

  // Never open on a day with no bookable slot: late at night, today rolls to tomorrow.
  if (slotsFor(state.plan.dayKey).length === 0) {
    state.plan = { ...state.plan, dayKey: 'tomorrow', slot: ALL_SLOTS[0] ?? state.plan.slot };
  }

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const clearTimers = (): void => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };

  // Heavy work (steam, staggered entrances) is skipped on tier C and on reduced motion.
  const heavy = getQuality().tier !== 'C' && !reducedMotion();

  const results = (): Restaurant[] =>
    filterRestaurants({ city: state.city, cuisine: state.cuisine, occasion: state.plan.occasion, price: state.price });

  const linksFor = (restaurant: Restaurant): PartnerLink[] =>
    tableLinks({ city: restaurant.city, name: restaurant.searchName, cuisine: restaurant.searchCuisine });

  const openPartner = (restaurant: Restaurant, id: string): void => {
    const link = linksFor(restaurant).find((candidate) => candidate.id === id);
    if (!link) return;
    openPartnerLink(link);
    options.onToast?.(`Opening ${link.id === 'zomato' ? 'Zomato' : 'Swiggy'} for ${restaurant.name}.`);
  };


  /* ---------------------------------------------------------------- markup */

  const isCustomDay = (): boolean => state.plan.dayKey !== 'today' && state.plan.dayKey !== 'tomorrow';

  const customDateValue = (): string =>
    isCustomDay() ? state.plan.dayKey : localDayKey(Date.now() + 24 * 3600 * 1000);

  const steamHTML = (): string =>
    heavy
      ? '<div class="dn-steam" aria-hidden="true"><span class="dn-wisp"></span><span class="dn-wisp"></span><span class="dn-wisp"></span></div>'
      : '';

  const headerHTML = (): string => `
    <header class="dn-head">
      <div class="dn-head-row">
        <h2 class="dn-title">${esc(COPY.title)}</h2>
        ${partnersLive() ? '' : `<span class="dn-sample">${esc(COPY.sample)}</span>`}
      </div>
      <p class="dn-sub">${esc(COPY.sub)}</p>
      <div class="dn-cities" role="group" aria-label="City">
        ${(CITIES as readonly string[])
          .map(
            (city) =>
              `<button type="button" class="dn-city${city === state.city ? ' is-on' : ''}" data-city="${esc(city)}" aria-pressed="${city === state.city}">${esc(city)}</button>`,
          )
          .join('')}
      </div>
    </header>`;

  const plannerInner = (): string => {
    const slots = slotsFor(state.plan.dayKey);
    const todayDisabled = slotsFor('today').length === 0;
    return `
      ${steamHTML()}
      <div class="dn-planner-row">
        <div class="dn-field">
          <span class="dn-label">${esc(COPY.party)}</span>
          <div class="dn-stepper">
            <button type="button" class="dn-step" data-party="-1" aria-label="Fewer people">−</button>
            <output class="dn-party" aria-live="polite">${state.plan.party}</output>
            <button type="button" class="dn-step" data-party="1" aria-label="More people">+</button>
          </div>
        </div>
        <div class="dn-field dn-field-occasion">
          <span class="dn-label">${esc(COPY.occasion)}</span>
          <div class="dn-chips" role="group" aria-label="${esc(COPY.occasion)}">
            ${OCCASIONS.map(
              (occasion) =>
                `<button type="button" class="dn-chip" data-occasion="${esc(occasion)}" aria-pressed="${occasion === state.plan.occasion}">${esc(occasion)}</button>`,
            ).join('')}
          </div>
        </div>
      </div>
      <div class="dn-field">
        <span class="dn-label">${esc(COPY.day)}</span>
        <div class="dn-chips" role="group" aria-label="${esc(COPY.day)}">
          <button type="button" class="dn-chip" data-day="today" aria-pressed="false"${todayDisabled ? ' disabled aria-disabled="true"' : ''}>${esc(COPY.today)}</button>
          <button type="button" class="dn-chip" data-day="tomorrow" aria-pressed="false">${esc(COPY.tomorrow)}</button>
          <button type="button" class="dn-chip" data-day="custom" aria-pressed="false">${esc(COPY.pickDay)}</button>
        </div>
        <input type="date" class="dn-date" data-date min="${esc(localDayKey(Date.now()))}" value="${esc(customDateValue())}"${isCustomDay() ? '' : ' hidden'}>
      </div>
      <div class="dn-field">
        <span class="dn-label">${esc(COPY.time)}</span>
        ${
          slots.length
            ? `<div class="dn-slots" role="group" aria-label="${esc(COPY.time)}">
                 <span class="dn-slot-pill" aria-hidden="true"></span>
                 ${slots
                   .map(
                     (slot) =>
                       `<button type="button" class="dn-slot" data-slot="${esc(slot)}" aria-pressed="${slot === state.plan.slot}">${esc(slotLabel(slot))}</button>`,
                   )
                   .join('')}
               </div>`
            : `<p class="dn-slots-empty">No tables left ${esc(dayLabel(state.plan.dayKey))}. Try tomorrow.</p>`
        }
      </div>
      <p class="dn-summary" aria-live="polite">${esc(planLine(state.plan))}</p>`;
  };

  const filtersInner = (): string => `
    <div class="dn-filter-row">
      <span class="dn-label">${esc(COPY.cuisine)}</span>
      <div class="dn-chips dn-chips-scroll" role="group" aria-label="${esc(COPY.cuisine)}">
        <button type="button" class="dn-chip" data-cuisine="All" aria-pressed="${state.cuisine === 'All'}">${esc(COPY.all)}</button>
        ${(CUISINES as readonly string[])
          .map(
            (cuisine) =>
              `<button type="button" class="dn-chip" data-cuisine="${esc(cuisine)}" aria-pressed="${state.cuisine === cuisine}">${esc(cuisine)}</button>`,
          )
          .join('')}
      </div>
    </div>
    <div class="dn-filter-row">
      <span class="dn-label">${esc(COPY.budget)}</span>
      <div class="dn-chips" role="group" aria-label="${esc(COPY.budget)}">
        ${PRICE_CAPS.map(
          (option) =>
            `<button type="button" class="dn-chip" data-price="${option.cap ?? ''}" aria-pressed="${state.price === option.cap}">${esc(option.label)}</button>`,
        ).join('')}
      </div>
      <button type="button" class="dn-clear" data-clear>${esc(COPY.clear)}</button>
    </div>`;


  const cardPlanLine = (): string =>
    state.plan.slot
      ? `For ${state.plan.party} · ${slotLabel(state.plan.slot)} ${dayLabel(state.plan.dayKey)}`
      : `For ${state.plan.party} · no time left ${dayLabel(state.plan.dayKey)}`;

  const cardHTML = (restaurant: Restaurant): string => {
    const saved = isSaved('dine', restaurant.id);
    const diets = dietLabels(restaurant);
    const art = posterDataUri(restaurant.posterSeed, { width: 480, height: 320, detail: 0.8 });
    return `
      <article class="dn-card" data-id="${esc(restaurant.id)}">
        <div class="dn-card-art" style="background-image:url('${art}')">
          <button type="button" class="dn-share" data-share aria-label="Share ${esc(restaurant.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 15v4h14v-4"/></svg>
          </button>
          ${partnersLive() ? '' : `<span class="dn-sample dn-sample-card">${esc(COPY.sample)}</span>`}
        </div>
        <div class="dn-card-body">
          <div class="dn-card-top">
            <h3 class="dn-card-name">${esc(restaurant.name)}</h3>
            <span class="dn-card-price">${esc(priceForTwoLabel(restaurant))}</span>
          </div>
          <p class="dn-card-meta">${esc(restaurant.cuisine)} · ${esc(restaurant.area)}, ${esc(restaurant.city)}</p>
          <ul class="dn-vibes">${restaurant.vibes.map((vibe) => `<li>${esc(vibe)}</li>`).join('')}</ul>
          <p class="dn-why">${esc(restaurant.why)}</p>
          <ul class="dn-menu">${restaurant.menuHighlights.map((dish) => `<li>${esc(dish)}</li>`).join('')}</ul>
          ${diets.length ? `<p class="dn-diet">${diets.map((diet) => `<span>${esc(diet)}</span>`).join('')}</p>` : ''}
          <p class="dn-card-plan">${esc(cardPlanLine())}</p>
          <div class="dn-actions">
            <button type="button" class="dn-btn dn-btn-primary" data-book>${esc(COPY.book)}</button>
            <button type="button" class="dn-btn" data-order>${esc(COPY.order)}</button>
            <button type="button" class="dn-btn dn-btn-ghost" data-send>${esc(COPY.send)}</button>
            <button type="button" class="dn-btn dn-btn-ghost" data-story>${esc(COPY.story)}</button>
            <button type="button" class="dn-btn dn-btn-save${saved ? ' is-on' : ''}" data-save aria-pressed="${saved}">${esc(saved ? COPY.saved : COPY.save)}</button>
          </div>
        </div>
      </article>`;
  };

  const resultsHTML = (): string => {
    const list = results();
    if (!list.length) {
      return `<div class="dn-empty">
        <p>${esc(COPY.empty)}</p>
        <button type="button" class="dn-btn" data-clear>${esc(COPY.clear)}</button>
      </div>`;
    }
    return `<div class="dn-grid">${list.map(cardHTML).join('')}</div>`;
  };

  const findingHTML = (): string => `
    <div class="dn-finding" role="status">
      <span class="dn-plate" aria-hidden="true"></span>
      <p>${esc(COPY.finding)}</p>
    </div>`;

  const outingDayLabel = (date: string): string => {
    const today = localDayKey(Date.now());
    if (date === today) return 'Today';
    if (date === shiftDay(today, 1)) return 'Tomorrow';
    return dayLabel(date).replace(/^on /, '');
  };

  const planRowHTML = (outing: Outing): string => {
    const when = outing.time
      ? `${slotLabel(outing.time)}${outing.date ? ` · ${outingDayLabel(outing.date)}` : ''}`
      : outing.date
        ? outingDayLabel(outing.date)
        : 'Someday';
    return `<li class="dn-plan" data-plan-id="${esc(outing.id)}">
      <span class="dn-plan-when">${esc(when)}</span>
      <span class="dn-plan-name">${esc(outing.title)}</span>
      <button type="button" class="dn-btn dn-btn-ghost dn-plan-open" data-open="${esc(outing.id)}">Open in Zomato</button>
      <button type="button" class="dn-icon-btn dn-plan-remove" data-remove="${esc(outing.id)}" aria-label="Remove ${esc(outing.title)}">Remove</button>
    </li>`;
  };

  const shelfInner = (): string => {
    const plans = listOutings().filter((outing) => outing.kind === 'dine');
    return `
      <h3 class="dn-shelf-title">${esc(COPY.plans)}</h3>
      ${
        plans.length
          ? `<ul class="dn-plan-list">${plans.map(planRowHTML).join('')}</ul>`
          : `<p class="dn-shelf-empty">${esc(COPY.plansEmpty)}</p>`
      }`;
  };

  const sheetHTML = (restaurant: Restaurant): string => `
    <div class="dn-sheet" data-sheet>
      <div class="dn-sheet-scrim" data-sheet-close></div>
      <div class="dn-sheet-card" role="dialog" aria-modal="true" aria-label="Book ${esc(restaurant.name)}">
        <div class="dn-sheet-art" aria-hidden="true" style="background-image:url('${posterDataUri(restaurant.posterSeed, { width: 480, height: 200, detail: 0.7 })}')"></div>
        <h3 class="dn-sheet-title">${esc(restaurant.name)}</h3>
        <p class="dn-sheet-plan">${esc(planSummary(restaurant, state.plan))}</p>
        <div class="dn-sheet-links">
          ${linksFor(restaurant)
            .map(
              (link) =>
                `<button type="button" class="dn-btn${link.id === 'zomato' ? ' dn-btn-primary' : ''}" data-partner="${esc(link.id)}">${esc(link.label)}</button>`,
            )
            .join('')}
        </div>
        <p class="dn-sheet-note">${esc(COPY.sheetNote)}</p>
        <button type="button" class="dn-btn dn-btn-ghost" data-sheet-close>Close</button>
      </div>
    </div>`;


  /* ------------------------------------------------------------ render/sync */

  const positionPill = (): void => {
    const pill = root.querySelector<HTMLElement>('.dn-slot-pill');
    const active = root.querySelector<HTMLElement>('[data-slot].is-on');
    if (!pill || !active) return;
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
  };

  const syncSaveStates = (): void => {
    root.querySelectorAll<HTMLElement>('.dn-card').forEach((card) => {
      const button = card.querySelector<HTMLButtonElement>('[data-save]');
      if (!button) return;
      const saved = isSaved('dine', card.dataset.id ?? '');
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? COPY.saved : COPY.save;
      button.classList.toggle('is-on', saved);
      button.disabled = state.plan.slot === '';
    });
  };

  const syncFilters = (): void => {
    root.querySelectorAll<HTMLElement>('[data-cuisine]').forEach((button) => {
      const on = (button.dataset.cuisine ?? 'All') === state.cuisine;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
    });
    root.querySelectorAll<HTMLElement>('[data-price]').forEach((button) => {
      const cap = button.dataset.price ? Number(button.dataset.price) : null;
      const on = cap === state.price;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
    });
  };

  const syncPlan = (): void => {
    const summary = root.querySelector('.dn-summary');
    if (summary) summary.textContent = planLine(state.plan);
    const party = root.querySelector('.dn-party');
    if (party) party.textContent = String(state.plan.party);

    root.querySelectorAll<HTMLElement>('[data-occasion]').forEach((button) => {
      const on = button.dataset.occasion === state.plan.occasion;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
    });
    root.querySelectorAll<HTMLElement>('[data-day]').forEach((button) => {
      const key = button.dataset.day ?? '';
      const pressed =
        key === 'custom'
          ? isCustomDay()
          : key === state.plan.dayKey;
      button.setAttribute('aria-pressed', String(pressed));
      button.classList.toggle('is-on', pressed);
    });
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((button) => {
      const on = button.dataset.slot === state.plan.slot;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
    });
    positionPill();

    root.querySelectorAll<HTMLElement>('.dn-card-plan').forEach((node) => {
      node.textContent = cardPlanLine();
    });
    syncSaveStates();
    syncFilters();
  };

  const entrance = (): void => {
    if (!heavy) return;
    root.querySelectorAll<HTMLElement>('.dn-card').forEach((card, index) => {
      animate(
        card,
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 320, delay: index * 32, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
      );
    });
  };

  const renderSheet = (): void => {
    root.querySelector('[data-sheet]')?.remove();
    if (state.sheet) root.insertAdjacentHTML('beforeend', sheetHTML(state.sheet));
  };

  const renderResults = (): void => {
    const node = root.querySelector('.dn-results');
    if (!node) return;
    node.innerHTML = resultsHTML();
    syncSaveStates();
    entrance();
  };

  const renderShelf = (): void => {
    const node = root.querySelector('.dn-shelf');
    if (node) node.innerHTML = shelfInner();
  };

  const paint = (): void => {
    root.innerHTML = `
      ${headerHTML()}
      <section class="dn-planner" aria-label="Your plan">${plannerInner()}</section>
      <section class="dn-filters" aria-label="Filters">${filtersInner()}</section>
      <section class="dn-results" aria-live="polite">${state.phase === 'finding' ? findingHTML() : resultsHTML()}</section>
      <section class="dn-shelf" aria-label="${esc(COPY.plans)}">${shelfInner()}</section>`;
    syncPlan();
    renderSheet();
    if (state.phase === 'ready') entrance();
  };

  const paintPlanner = (): void => {
    const node = root.querySelector('.dn-planner');
    if (node) node.innerHTML = plannerInner();
  };

  const scheduleResults = (): void => {
    later(() => {
      state.phase = 'ready';
      renderResults();
    }, 600);
  };

  const reload = (full: boolean): void => {
    clearTimers();
    state.phase = 'finding';
    if (full) {
      paint();
    } else {
      syncFilters();
      const node = root.querySelector('.dn-results');
      if (node) node.innerHTML = findingHTML();
    }
    scheduleResults();
  };

  const openSheetFor = (restaurant: Restaurant): void => {
    state.sheet = restaurant;
    renderSheet();
    haptics.play('light');
  };

  const closeSheet = (): void => {
    state.sheet = null;
    root.querySelector('[data-sheet]')?.remove();
  };


  /* --------------------------------------------------------------- actions */

  const savePlan = (restaurant: Restaurant, button: HTMLButtonElement): void => {
    if (!state.plan.slot) {
      options.onToast?.('Pick a time first.');
      return;
    }
    const now = Date.now();
    const day = resolveDayKey(state.plan.dayKey, now);
    const result = toggleOuting({
      kind: 'dine',
      refId: restaurant.id,
      title: restaurant.name,
      subtitle: `Table for ${state.plan.party} · ${state.plan.occasion}`,
      date: day,
      time: state.plan.slot,
      partner: 'zomato',
      city: restaurant.city,
    });

    haptics.play('tick');
    animate(
      button,
      [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
      { duration: 240, easing: 'cubic-bezier(.34,1.3,.5,1)' },
    );

    if (result.saved) {
      const zomato = linksFor(restaurant).find((link) => link.id === 'zomato');
      const ics = eventIcs({
        uid: `dine:${restaurant.id}:${day}`,
        title: `Dinner at ${restaurant.name}`,
        description: `${planSummary(restaurant, state.plan)}. ${priceForTwoLabel(restaurant)}.`,
        location: `${restaurant.name}, ${restaurant.area}, ${restaurant.city}`,
        start: `${day}T${state.plan.slot}:00`,
        durationMinutes: 120,
        url: zomato?.url,
      });
      const name = downloadIcs(`cultured-${restaurant.id}-${day}`, ics);
      options.onToast?.(`Saved. ${name} has the slot.`);
    } else {
      options.onToast?.(`Removed ${restaurant.name} from your plans.`);
    }

    renderShelf();
    syncSaveStates();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-sheet-close]')) {
      closeSheet();
      return;
    }

    const partner = target.closest<HTMLElement>('[data-partner]');
    if (partner?.dataset.partner && state.sheet) {
      const restaurant = state.sheet;
      openPartner(restaurant, partner.dataset.partner);
      closeSheet();
      return;
    }

    const city = target.closest<HTMLElement>('[data-city]');
    if (city?.dataset.city) {
      state.city = city.dataset.city;
      try {
        localStorage.setItem(CITY_KEY, state.city);
      } catch {
        /* Private mode: the choice still holds for this session. */
      }
      haptics.play('tick');
      reload(true);
      return;
    }

    const party = target.closest<HTMLElement>('[data-party]');
    if (party?.dataset.party) {
      const dir = Number(party.dataset.party) > 0 ? 1 : -1;
      const index = PARTY_SIZES.indexOf(state.plan.party);
      const next = PARTY_SIZES[Math.min(PARTY_SIZES.length - 1, Math.max(0, index + dir))];
      if (next && next !== state.plan.party) {
        state.plan = { ...state.plan, party: next };
        haptics.play('tick');
        syncPlan();
      }
      return;
    }

    const occasion = target.closest<HTMLElement>('[data-occasion]');
    if (occasion?.dataset.occasion) {
      state.plan = { ...state.plan, occasion: occasion.dataset.occasion };
      haptics.play('tick');
      syncPlan();
      reload(false);
      return;
    }

    const day = target.closest<HTMLButtonElement>('[data-day]');
    if (day?.dataset.day && !day.disabled) {
      state.plan = { ...state.plan, dayKey: day.dataset.day === 'custom' ? customDateValue() : day.dataset.day };
      const available = slotsFor(state.plan.dayKey);
      if (available.length && !available.includes(state.plan.slot)) {
        state.plan = { ...state.plan, slot: available[0] ?? '' };
      }
      haptics.play('tick');
      paintPlanner();
      syncPlan();
      if (day.dataset.day === 'custom') root.querySelector<HTMLInputElement>('[data-date]')?.focus();
      return;
    }

    const slot = target.closest<HTMLElement>('[data-slot]');
    if (slot?.dataset.slot) {
      state.plan = { ...state.plan, slot: slot.dataset.slot };
      haptics.play('tick');
      syncPlan();
      return;
    }

    const cuisine = target.closest<HTMLElement>('[data-cuisine]');
    if (cuisine?.dataset.cuisine) {
      state.cuisine = cuisine.dataset.cuisine;
      haptics.play('tick');
      reload(false);
      return;
    }

    const price = target.closest<HTMLElement>('[data-price]');
    if (price) {
      state.price = price.dataset.price ? Number(price.dataset.price) : null;
      haptics.play('tick');
      reload(false);
      return;
    }

    if (target.closest('[data-clear]')) {
      state.cuisine = 'All';
      state.price = null;
      haptics.play('tick');
      reload(false);
      return;
    }

    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove?.dataset.remove) {
      removeOuting(remove.dataset.remove);
      haptics.play('tick');
      renderShelf();
      syncSaveStates();
      return;
    }

    const open = target.closest<HTMLElement>('[data-open]');
    if (open?.dataset.open) {
      const outing = listOutings().find((candidate) => candidate.id === open.dataset.open);
      if (outing) {
        const saved = restaurantById(outing.refId);
        const link = tableLinks({
          city: outing.city,
          name: saved?.searchName ?? outing.title,
          cuisine: saved?.searchCuisine ?? '',
        }).find((candidate) => candidate.id === 'zomato');
        if (link) openPartnerLink(link);
        options.onToast?.(`Opening Zomato for ${outing.title}.`);
      }
      return;
    }

    const card = target.closest<HTMLElement>('.dn-card');
    const restaurant = card?.dataset.id ? restaurantById(card.dataset.id) : undefined;
    if (!restaurant) return;

    if (target.closest('[data-book]')) {
      openSheetFor(restaurant);
      return;
    }
    if (target.closest('[data-order]')) {
      openPartner(restaurant, 'swiggy');
      return;
    }
    if (target.closest('[data-send]')) {
      options.onSendPlan?.(restaurant, { ...state.plan });
      haptics.play('light');
      return;
    }
    if (target.closest('[data-story]')) {
      options.onAddToStory?.(restaurant, { ...state.plan });
      haptics.play('light');
      return;
    }
    if (target.closest('[data-share]')) {
      options.onShare?.(restaurant);
      return;
    }
    const save = target.closest<HTMLButtonElement>('[data-save]');
    if (save) savePlan(restaurant, save);
  });


  root.addEventListener('change', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-date]');
    if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.value)) return;
    state.plan = { ...state.plan, dayKey: input.value };
    const available = slotsFor(state.plan.dayKey);
    if (available.length && !available.includes(state.plan.slot)) {
      state.plan = { ...state.plan, slot: available[0] ?? '' };
    }
    paintPlanner();
    syncPlan();
  });

  host.appendChild(root);
  paint();
  scheduleResults();

  const unsubscribe = subscribeOutings(() => {
    renderShelf();
    syncSaveStates();
  });

  return {
    destroy() {
      clearTimers();
      unsubscribe();
      closeSheet();
      root.remove();
    },
  };
};

