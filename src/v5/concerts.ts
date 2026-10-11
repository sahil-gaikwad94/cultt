/**
 * Concerts — "Live near you" (build brief §6.1, decisions D-40/D-41/D-42).
 *
 * The home feed's day −1 slot. It is a browse-and-commit surface, not a
 * screenshot of someone else's ticket page: the catalogue is editorial sample
 * data (see `src/data/seed/events.ts`), and every "Book" opens the partner's
 * own, real listing through `src/lib/partners.ts`. When no partner integration
 * is configured the page says "Sample listing" rather than pretending.
 *
 * What makes it feel live, with no backend: a procedural poster per event, a
 * doors countdown that ticks every second, a slow ken-burns drift, an optional
 * ambience loop, and a saved-shows shelf that writes a real `.ics`. All of it is
 * decoration over the truth, never a fabricated number.
 *
 * Motion discipline: entrance/loop animation is CSS (transform/opacity only),
 * JS motion goes through `src/lib/waapi.ts`, and every one of them collapses
 * under `prefers-reduced-motion` or a tier-C device.
 */

import { CITIES, EVENTS, GENRES, type ConcertEvent } from '../data/seed/events.ts';
import { openPartnerLink, partnersLive, ticketLinks } from '../lib/partners.ts';
import { downloadIcs, eventIcs } from '../lib/calendar.ts';
import {
  isSaved,
  listOutings,
  removeOuting,
  subscribeOutings,
  toggleOuting,
  type Outing,
} from '../lib/outings.ts';
import { posterDataUri } from '../lib/poster.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import { getQuality } from './quality.ts';

/* The seed is the catalogue; re-exported so callers and tests read it here. */
export { CITIES, EVENTS, GENRES };
export type { ConcertEvent };

/* ------------------------------------------------------------- pure helpers */

const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, '0');

const toMs = (now: number | Date): number => (typeof now === 'number' ? now : now.getTime());

const parseTime = (time: string): { hours: number; minutes: number } => {
  const [h, m] = time.split(':');
  const hours = Number(h);
  const minutes = Number(m);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
};

const startOfLocalDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole-rupee grouping, locale-independent so tests are stable. */
const group = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * When an event's set starts, in ms epoch. `dayOffset` is resolved against the
 * *local* calendar day of `now`, so "tonight at 20:30" means the user's tonight,
 * not UTC's.
 */
export const eventStart = (event: ConcertEvent, now: number | Date = Date.now()): number => {
  const base = new Date(toMs(now));
  const { hours, minutes } = parseTime(event.time);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + event.dayOffset,
    hours,
    minutes,
    0,
    0,
  ).getTime();
};

/** Doors open `doorsLeadMins` before the set time. Countdowns target this. */
export const doorsAt = (event: ConcertEvent, now: number | Date = Date.now()): number =>
  eventStart(event, now) - event.doorsLeadMins * 60000;

/** Every event whose set time has not passed, soonest first. */
export const upcomingEvents = (now: number | Date = Date.now()): ConcertEvent[] => {
  const base = toMs(now);
  return EVENTS.filter((event) => eventStart(event, base) >= base).sort(
    (a, b) => eventStart(a, base) - eventStart(b, base),
  );
};

export type DateWindow = 'all' | 'tonight' | 'tomorrow' | 'weekend' | 'month';
export type SortKey = 'soonest' | 'cheapest';

export interface FilterQuery {
  /** A city from `CITIES`, or `'all'`/null for every city. */
  city?: string | null;
  /** A genre from `GENRES`, or `'all'`/null for every genre. */
  genre?: string | null;
  window?: DateWindow;
  sort?: SortKey;
}

const withinWindow = (event: ConcertEvent, base: number, window: DateWindow): boolean => {
  const start = eventStart(event, base);
  if (window === 'all') return true;

  if (window === 'month') return start >= base && start <= base + 30 * 24 * 3600 * 1000;

  if (window === 'tonight') {
    const tomorrow = new Date(base);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return start >= base && start < startOfLocalDay(tomorrow.getTime());
  }

  if (window === 'tomorrow') {
    const tomorrow = new Date(base);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(base);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return (
      start >= startOfLocalDay(tomorrow.getTime()) && start < startOfLocalDay(dayAfter.getTime())
    );
  }

  // weekend: the set lands on a Saturday or Sunday, and is still to come.
  const weekday = new Date(start).getDay();
  return start >= base && (weekday === 0 || weekday === 6);
};

/**
 * The one filter used by the rail. City, genre, window and sort compose with
 * AND; an absent filter is a no-op, never a hidden default.
 */
export const filterEvents = (
  query: FilterQuery = {},
  now: number | Date = Date.now(),
): ConcertEvent[] => {
  const base = toMs(now);
  const city = query.city && query.city !== 'all' ? query.city : null;
  const genre = query.genre && query.genre !== 'all' ? query.genre : null;
  const window = query.window ?? 'all';
  const sort = query.sort ?? 'soonest';

  const list = upcomingEvents(base).filter((event) => {
    if (city && event.city !== city) return false;
    if (genre && !event.genres.includes(genre) && event.genre !== genre) return false;
    return withinWindow(event, base, window);
  });

  if (sort === 'cheapest') {
    list.sort((a, b) => a.priceFrom - b.priceFrom || eventStart(a, base) - eventStart(b, base));
  } else {
    list.sort((a, b) => eventStart(a, base) - eventStart(b, base));
  }
  return list;
};

/** `from ₹1,299`. A "from" price — never a discount, never a strike-through. */
export const priceLabel = (event: ConcertEvent): string =>
  `from ₹${group(Math.max(0, Math.round(event.priceFrom)))}`;

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Clamped, never negative. */
  totalMs: number;
  /** True once the target has arrived or passed. */
  expired: boolean;
}

/** Splits a duration into parts, clamped at zero — a past target reads 00:00. */
export const countdownParts = (ms: number): CountdownParts => {
  const safe = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safe / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs: safe,
    expired: !Number.isFinite(ms) || ms <= 0,
  };
};

/** `mm:ss` under an hour, `hh:mm:ss` under a day, `Nd hh:mm:ss` beyond. */
export const formatCountdown = (parts: CountdownParts): string => {
  const mmss = `${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
  if (parts.days > 0) return `${parts.days}d ${pad2(parts.hours)}:${mmss}`;
  if (parts.hours > 0) return `${pad2(parts.hours)}:${mmss}`;
  return mmss;
};


/* ---------------------------------------------------------------- mounting */

const CITY_KEY = 'cultured2:concerts-city';
const DEFAULT_CITY = 'Mumbai';
/** A card shows a live doors countdown only when the doors are this close. */
const DOORS_COUNTDOWN_WINDOW_MS = 48 * 3600 * 1000;
const AMBIENCE_SRC = '/assets/feed-loop.mp4';

const WINDOWS: ReadonlyArray<{ key: DateWindow; label: string }> = [
  { key: 'all', label: 'Any date' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'month', label: 'This month' },
];

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'soonest', label: 'Soonest' },
  { key: 'cheapest', label: 'Cheapest' },
];

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const esc = (value: string): string =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const findEvent = (id: string | undefined): ConcertEvent | null =>
  EVENTS.find((event) => event.id === id) ?? null;

const readCity = (): string => {
  try {
    const stored = localStorage.getItem(CITY_KEY);
    return stored && CITIES.includes(stored) ? stored : DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
};

const writeCity = (city: string): void => {
  try {
    localStorage.setItem(CITY_KEY, city);
  } catch {
    /* Private mode: the choice holds for this session only. */
  }
};

const localDate = (event: ConcertEvent, now: number): string => {
  const d = new Date(eventStart(event, now));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const localStamp = (event: ConcertEvent, now: number): string => {
  const d = new Date(eventStart(event, now));
  return `${localDate(event, now)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
};

const monthLabel = (event: ConcertEvent, now: number): string =>
  new Date(eventStart(event, now)).toLocaleDateString('en-GB', { month: 'short' });

const dayNumber = (event: ConcertEvent, now: number): string =>
  String(new Date(eventStart(event, now)).getDate());

const nextUpIn = (city: string, now: number): ConcertEvent | null =>
  upcomingEvents(now).find((event) => event.city === city) ?? null;

const headerHTML = (city: string): string => `
  <header class="cx-head">
    <div class="cx-head-row">
      <div class="cx-head-titles">
        <p class="cx-kicker">Going out</p>
        <h1 class="cx-title">Live near you</h1>
      </div>
      ${partnersLive() ? '' : '<span class="cx-sample-chip" title="Editorial sample listings">Sample listing</span>'}
    </div>
    <div class="cx-cities" role="group" aria-label="City">
      ${CITIES.map(
        (c) =>
          `<button type="button" class="cx-city${c === city ? ' is-on' : ''}" data-city="${esc(
            c,
          )}" aria-pressed="${c === city}">${esc(c)}</button>`,
      ).join('')}
    </div>
  </header>`;

const heroHTML = (event: ConcertEvent, now: number, heavy: boolean): string => {
  const poster = posterDataUri(event.posterSeed, { width: 900, height: 1100, detail: 1 });
  const doors = doorsAt(event, now);
  const parts = countdownParts(doors - now);
  const chips = [event.genre, ...event.genres.filter((g) => g !== event.genre)].slice(0, 3);
  return `
    <section class="cx-hero" aria-label="Next up in ${esc(event.city)}">
      <div class="cx-hero-media" data-parallax>
        ${heavy ? heroVideoHTML() : ''}
        <div class="cx-hero-art" data-art style="background-image:url('${poster}')"></div>
        <div class="cx-hero-scrim" aria-hidden="true"></div>
      </div>
      <div class="cx-hero-body">
        <p class="cx-kicker">Next up in ${esc(event.city)}</p>
        <h2 class="cx-hero-title">${esc(event.title)}</h2>
        <p class="cx-hero-artist">${esc(event.artist)}</p>
        <p class="cx-hero-meta">${esc(event.venue)} · ${esc(event.city)}</p>
        <div class="cx-chips">
          ${chips.map((g) => `<span class="cx-chip">${esc(g)}</span>`).join('')}
          <span class="cx-chip cx-chip-energy" data-energy="${esc(event.energy)}">${esc(event.energy)}</span>
        </div>
        <p class="cx-hero-doors">
          <span class="cx-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="cx-doors-label">Doors in</span>
          <span class="cx-countdown" data-start="${doors}">${formatCountdown(parts)}</span>
        </p>
        <div class="cx-hero-actions">
          <button type="button" class="cx-btn cx-btn-primary" data-book-hero="${esc(event.id)}">Book on BookMyShow</button>
          <button type="button" class="cx-btn cx-btn-ghost" data-remind="${esc(
            event.id,
          )}" aria-pressed="${isSaved('concert', event.id)}">${
            isSaved('concert', event.id) ? 'Reminder set' : 'Remind me'
          }</button>
          <button type="button" class="cx-btn cx-btn-quiet" data-story="${esc(event.id)}">Add to story</button>
        </div>
      </div>
    </section>`;
};

const filtersHTML = (genre: string, windowKey: DateWindow, sort: SortKey): string => `
  <div class="cx-filters">
    <div class="cx-genres" role="group" aria-label="Genre">
      <span class="cx-genre-indicator" data-genre-indicator aria-hidden="true"></span>
      ${['all', ...GENRES]
        .map(
          (g) =>
            `<button type="button" class="cx-pill${g === genre ? ' is-on' : ''}" data-genre="${esc(
              g,
            )}" aria-pressed="${g === genre}">${esc(g === 'all' ? 'All' : g)}</button>`,
        )
        .join('')}
    </div>
    <div class="cx-windows" role="group" aria-label="When">
      ${WINDOWS.map(
        (w) =>
          `<button type="button" class="cx-pill cx-pill-quiet${
            w.key === windowKey ? ' is-on' : ''
          }" data-window="${w.key}" aria-pressed="${w.key === windowKey}">${esc(w.label)}</button>`,
      ).join('')}
    </div>
    <div class="cx-sort" role="group" aria-label="Sort">
      <span class="cx-sort-label">Sort</span>
      ${SORTS.map(
        (s) =>
          `<button type="button" class="cx-pill cx-pill-quiet${
            s.key === sort ? ' is-on' : ''
          }" data-sort="${s.key}" aria-pressed="${s.key === sort}">${esc(s.label)}</button>`,
      ).join('')}
    </div>
  </div>`;


const heroVideoHTML = (): string => `
    <video class="cx-ambience" data-ambience muted playsinline loop preload="metadata" aria-hidden="true">
      <source src="${AMBIENCE_SRC}" type="video/mp4">
    </video>`;


const cardHTML = (event: ConcertEvent, index: number, now: number): string => {
  const poster = posterDataUri(event.posterSeed, { width: 220, height: 260, detail: 0.45 });
  const doors = doorsAt(event, now);
  const saved = isSaved('concert', event.id);
  const soon = doors - now <= DOORS_COUNTDOWN_WINDOW_MS;
  return `
    <li class="cx-card" style="--i:${index}" data-card="${esc(event.id)}">
      <img class="cx-card-art" src="${poster}" alt="" width="220" height="260" loading="lazy" decoding="async">
      <div class="cx-card-body">
        <span class="cx-date-badge"><b>${esc(dayNumber(event, now))}</b><span>${esc(
          monthLabel(event, now),
        )}</span></span>
        <div class="cx-card-main">
          <h3 class="cx-card-artist">${esc(event.artist)}</h3>
          <p class="cx-card-venue">${esc(event.venue)} · ${esc(event.city)}</p>
          <div class="cx-chips">
            <span class="cx-chip">${esc(event.genre)}</span>
            <span class="cx-chip cx-chip-energy" data-energy="${esc(event.energy)}">${esc(
              event.energy,
            )}</span>
            ${
              soon
                ? `<span class="cx-chip cx-chip-count">doors <span class="cx-countdown" data-start="${doors}">${formatCountdown(
                    countdownParts(doors - now),
                  )}</span></span>`
                : ''
            }
          </div>
        </div>
        <span class="cx-price">${esc(priceLabel(event))}</span>
        <div class="cx-card-actions">
          <button type="button" class="cx-btn cx-btn-small" data-book="${esc(event.id)}">Book</button>
          <button type="button" class="cx-btn cx-btn-small cx-btn-ghost${
            saved ? ' is-saved' : ''
          }" data-save="${esc(event.id)}" aria-pressed="${saved}">${saved ? 'Saved' : 'Save'}</button>
          <button type="button" class="cx-btn cx-btn-small cx-btn-quiet" data-share="${esc(
            event.id,
          )}">Share</button>
        </div>
      </div>
    </li>`;
};

const listHTML = (list: ConcertEvent[], city: string, now: number): string => `
  <section class="cx-list" aria-label="Upcoming shows">
    <h2 class="cx-section-title">${list.length} show${
      list.length === 1 ? '' : 's'
    } in ${esc(city)}</h2>
    <ul class="cx-cards">
      ${list.map((event, index) => cardHTML(event, index, now)).join('')}
    </ul>
  </section>`;

const emptyHTML = (): string => `
  <section class="cx-empty">
    <h2>No shows match that</h2>
    <p>We only list what we actually have. Loosen a filter and something will turn up.</p>
    <button type="button" class="cx-btn" data-clear>Clear filters</button>
  </section>`;

const planHTML = (outing: Outing, now: number): string => {
  const event = findEvent(outing.refId);
  const when = event
    ? `doors in <span class="cx-countdown" data-start="${doorsAt(event, now)}">${formatCountdown(
        countdownParts(doorsAt(event, now) - now),
      )}</span>`
    : `${outing.date || 'someday'}${outing.time ? ` · ${outing.time}` : ''}`;
  return `
    <li class="cx-plan" data-plan="${esc(outing.id)}">
      <div class="cx-plan-main">
        <strong>${esc(outing.title)}</strong>
        <span>${esc(outing.subtitle)}</span>
        <span class="cx-plan-when">${when}</span>
      </div>
      <button type="button" class="cx-btn cx-btn-small" data-open="${esc(outing.refId)}">Open</button>
      <button type="button" class="cx-icon-btn" data-remove="${esc(
        outing.id,
      )}" aria-label="Remove ${esc(outing.title)}">✕</button>
    </li>`;
};

const plansInnerHTML = (now: number): string => {
  const plans = listOutings().filter((outing) => outing.kind === 'concert');
  return plans.length
    ? `<ul class="cx-plan-list">${plans.map((outing) => planHTML(outing, now)).join('')}</ul>`
    : `<p class="cx-plans-empty">Nothing saved yet. Tap <b>Remind me</b> on a show and it lands here — and in your calendar.</p>`;
};

const plansHTML = (now: number): string => `
  <section class="cx-plans" data-plans aria-label="Your plans">
    <h2 class="cx-section-title">Your plans</h2>
    ${plansInnerHTML(now)}
  </section>`;

const sheetHTML = (event: ConcertEvent): string => {
  const links = ticketLinks({
    city: event.city,
    title: event.searchTitle,
    genre: event.searchGenre,
  });
  return `
    <div class="cx-sheet-scrim" data-sheet-close></div>
    <div class="cx-sheet" role="dialog" aria-modal="true" aria-label="Book ${esc(event.title)}">
      <header class="cx-sheet-head">
        <div>
          <p class="cx-kicker">${esc(event.city)} · ${esc(event.genre)}</p>
          <h3>${esc(event.title)}</h3>
        </div>
        <button type="button" class="cx-icon-btn" data-sheet-close aria-label="Close">✕</button>
      </header>
      <p class="cx-sheet-note">${
        partnersLive()
          ? 'Opens the partner’s listing for this show.'
          : 'Sample listing — these open the partner’s own search for this show.'
      }</p>
      <ul class="cx-sheet-links">
        ${links
          .map(
            (link) =>
              `<li><button type="button" class="cx-btn cx-btn-primary" data-partner="${esc(
                link.id,
              )}">${esc(link.label)}</button></li>`,
          )
          .join('')}
      </ul>
    </div>`;
};


export interface ConcertsOptions {
  /** Opens the app share sheet. */
  onShare?: (event: ConcertEvent) => void;
  /** Inserts the event into Stories. */
  onAddToStory?: (event: ConcertEvent) => void;
  /** App toast; falls back to an internal one when omitted. */
  onToast?: (message: string) => void;
}

export interface ConcertsHandle {
  destroy(): void;
}

/**
 * Mounts the Concerts sub-page into `host`. Owns its own clock, observers and
 * listeners; `destroy()` removes all of them and empties the host.
 */
export const mountConcerts = (host: HTMLElement, options: ConcertsOptions = {}): ConcertsHandle => {
  const root = el<HTMLDivElement>('div', 'v5-concerts');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Live near you — concerts');

  const stage = el<HTMLDivElement>('div', 'cx-stage');
  root.appendChild(stage);

  const reduced =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const heavy = !reduced && getQuality().tier !== 'C';

  let city = readCity();
  let genre = 'all';
  let windowKey: DateWindow = 'all';
  let sort: SortKey = 'soonest';
  let sheetFor: ConcertEvent | null = null;

  /* Timeouts the module owns, so destroy() can leave no timer behind. */
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /* --------------------------------------------------------------- toast */

  let toastNode: HTMLElement | null = null;
  let toastTimer = 0;
  const internalToast = (message: string): void => {
    if (!toastNode) {
      toastNode = el<HTMLDivElement>('div', 'cx-toast');
      toastNode.setAttribute('role', 'status');
      root.appendChild(toastNode);
    }
    toastNode.textContent = message;
    toastNode.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastNode?.classList.remove('is-on'), 2400);
  };
  const toast = (message: string): void => {
    if (options.onToast) options.onToast(message);
    else internalToast(message);
  };

  /* --------------------------------------------------------- save plumbing */

  const planFor = (concert: ConcertEvent): Omit<Outing, 'id' | 'createdAt'> => ({
    kind: 'concert',
    refId: concert.id,
    title: concert.title,
    subtitle: `${concert.artist} · ${concert.venue}`,
    date: localDate(concert, Date.now()),
    time: concert.time,
    partner: null,
    city: concert.city,
  });

  const syncSaveUI = (concert: ConcertEvent, saved: boolean): void => {
    root.querySelectorAll<HTMLElement>(`[data-save="${concert.id}"]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? 'Saved' : 'Save';
      button.classList.toggle('is-saved', saved);
    });
    root.querySelectorAll<HTMLElement>(`[data-remind="${concert.id}"]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? 'Reminder set' : 'Remind me';
    });
  };

  const refreshPlans = (): void => {
    const section = stage.querySelector<HTMLElement>('[data-plans]');
    if (section) {
      section.innerHTML = `<h2 class="cx-section-title">Your plans</h2>${plansInnerHTML(Date.now())}`;
    }
  };

  const writeIcs = (concert: ConcertEvent): void => {
    const now = Date.now();
    const link = ticketLinks({
      city: concert.city,
      title: concert.searchTitle,
      genre: concert.searchGenre,
    })[0];
    const ics = eventIcs({
      uid: `cultured-concert-${concert.id}`,
      title: `${concert.artist} — ${concert.title}`,
      description: `${concert.tagline} (Sample listing from cultured.)`,
      location: `${concert.venue}, ${concert.city}`,
      start: localStamp(concert, now),
      durationMinutes: concert.durationMins,
      url: link?.url,
    });
    downloadIcs(`cultured-${concert.id}.ics`, ics);
  };

  /** The ticket-stub tear: the button splits, then settles. */
  const tearStub = (button: HTMLElement): void => {
    button.classList.add('is-tearing');
    animate(
      button,
      [
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: 'translateY(-3px) rotate(-2.5deg)' },
        { transform: 'translateY(0) rotate(0deg)' },
      ],
      { duration: 420, easing: 'cubic-bezier(.34,1.3,.5,1)' },
    );
    later(() => button.classList.remove('is-tearing'), 620);
  };

  /** Book → "Opening…" → a check, then back to the label. */
  const morphBook = (button: HTMLElement, label: string): void => {
    button.classList.add('is-busy');
    button.textContent = 'Opening BookMyShow…';
    animate(
      button,
      [{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    later(() => {
      button.textContent = '✓ Opened BookMyShow';
      button.classList.remove('is-busy');
      button.classList.add('is-done');
      later(() => {
        button.textContent = label;
        button.classList.remove('is-done');
      }, 2600);
    }, 700);
  };


  /* ---------------------------------------------------------- render + tick */

  const tick = (): void => {
    const now = Date.now();
    root.querySelectorAll<HTMLElement>('.cx-countdown[data-start]').forEach((node) => {
      const remaining = Number(node.dataset.start) - now;
      node.textContent = remaining <= 0 ? 'Doors open' : formatCountdown(countdownParts(remaining));
      node.classList.toggle('is-live', remaining <= 0);
    });
  };

  let observedVideo: HTMLVideoElement | null = null;
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const video = entry.target as HTMLVideoElement;
              if (entry.isIntersecting) {
                const play = video.play();
                if (play && typeof play.catch === 'function') play.catch(() => undefined);
              } else {
                video.pause();
              }
            }
          },
          { threshold: 0.1 },
        )
      : null;

  let heroTop = 0;
  const cacheHero = (): void => {
    const media = stage.querySelector<HTMLElement>('.cx-hero-media');
    heroTop = media ? media.getBoundingClientRect().top + window.scrollY : 0;
  };

  /** Slide the genre indicator under the active pill. Widths, not a guess. */
  const positionIndicator = (): void => {
    const indicator = stage.querySelector<HTMLElement>('[data-genre-indicator]');
    const active = stage.querySelector<HTMLElement>('.cx-genres .cx-pill.is-on');
    if (!indicator || !active) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  };

  const afterRender = (): void => {
    if (io) {
      const video = stage.querySelector<HTMLVideoElement>('[data-ambience]');
      if (observedVideo && observedVideo !== video) io.unobserve(observedVideo);
      if (video) {
        video.muted = true;
        io.observe(video);
      }
      observedVideo = video;
    }
    positionIndicator();
    cacheHero();
  };

  const render = (): void => {
    const now = Date.now();
    const list = filterEvents({ city, genre, window: windowKey, sort }, now);
    const next = nextUpIn(city, now);
    stage.innerHTML = `
      ${headerHTML(city)}
      ${next ? heroHTML(next, now, heavy) : ''}
      ${filtersHTML(genre, windowKey, sort)}
      ${list.length ? listHTML(list, city, now) : emptyHTML()}
      ${plansHTML(now)}
      ${sheetFor ? sheetHTML(sheetFor) : ''}`;
    afterRender();
    tick();
  };

  /* ------------------------------------------------------------ parallax */

  const applyParallax = (): void => {
    if (!heavy) return;
    const media = stage.querySelector<HTMLElement>('.cx-hero-media');
    if (!media) return;
    const offset = Math.max(-48, Math.min(48, (window.scrollY - heroTop) * 0.12));
    media.style.setProperty('--parallax', `${offset.toFixed(2)}px`);
  };
  const onScroll = (): void => applyParallax();
  const onResize = (): void => {
    cacheHero();
    positionIndicator();
  };


  /* --------------------------------------------------------------- events */

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-sheet-close]')) {
      sheetFor = null;
      render();
      return;
    }

    const partnerBtn = target.closest<HTMLElement>('[data-partner]');
    if (partnerBtn?.dataset.partner && sheetFor) {
      const link = ticketLinks({
        city: sheetFor.city,
        title: sheetFor.searchTitle,
        genre: sheetFor.searchGenre,
      }).find((candidate) => candidate.id === partnerBtn.dataset.partner);
      if (link) {
        openPartnerLink(link);
        toast(`${link.label} — opening…`);
      }
      return;
    }

    const cityBtn = target.closest<HTMLElement>('[data-city]');
    if (cityBtn?.dataset.city) {
      city = cityBtn.dataset.city;
      writeCity(city);
      haptics.play('tick');
      render();
      return;
    }

    const genreBtn = target.closest<HTMLElement>('[data-genre]');
    if (genreBtn?.dataset.genre) {
      genre = genreBtn.dataset.genre;
      haptics.play('tick');
      render();
      return;
    }

    const windowBtn = target.closest<HTMLElement>('[data-window]');
    if (windowBtn?.dataset.window) {
      windowKey = windowBtn.dataset.window as DateWindow;
      haptics.play('tick');
      render();
      return;
    }

    const sortBtn = target.closest<HTMLElement>('[data-sort]');
    if (sortBtn?.dataset.sort) {
      sort = sortBtn.dataset.sort as SortKey;
      haptics.play('tick');
      render();
      return;
    }

    if (target.closest('[data-clear]')) {
      genre = 'all';
      windowKey = 'all';
      sort = 'soonest';
      haptics.play('tick');
      render();
      return;
    }

    const heroBook = target.closest<HTMLElement>('[data-book-hero]');
    if (heroBook) {
      const concert = findEvent(heroBook.dataset.bookHero);
      const link = concert
        ? ticketLinks({ city: concert.city, title: concert.searchTitle, genre: concert.searchGenre })[0]
        : undefined;
      if (link) {
        openPartnerLink(link);
        morphBook(heroBook, link.label);
      }
      return;
    }

    const bookBtn = target.closest<HTMLElement>('[data-book]');
    if (bookBtn?.dataset.book) {
      sheetFor = findEvent(bookBtn.dataset.book);
      haptics.play('tick');
      render();
      animate(
        stage.querySelector('.cx-sheet'),
        [
          { opacity: 0, transform: 'translateY(28px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, easing: 'cubic-bezier(.22,.61,.36,1)' },
      );
      stage.querySelector<HTMLElement>('.cx-sheet [data-sheet-close]')?.focus();
      return;
    }

    const saveBtn = target.closest<HTMLElement>('[data-save]');
    if (saveBtn?.dataset.save) {
      const concert = findEvent(saveBtn.dataset.save);
      if (concert) {
        const result = toggleOuting(planFor(concert));
        haptics.play('tick');
        syncSaveUI(concert, result.saved);
        if (result.saved) {
          tearStub(saveBtn);
          writeIcs(concert);
        }
        refreshPlans();
        tick();
      }
      return;
    }

    const remindBtn = target.closest<HTMLElement>('[data-remind]');
    if (remindBtn?.dataset.remind) {
      const concert = findEvent(remindBtn.dataset.remind);
      if (concert) {
        const result = toggleOuting(planFor(concert));
        haptics.play('tick');
        syncSaveUI(concert, result.saved);
        if (result.saved) {
          writeIcs(concert);
          toast('Reminder saved — calendar file downloaded');
        }
        refreshPlans();
        tick();
      }
      return;
    }

    const storyBtn = target.closest<HTMLElement>('[data-story]');
    if (storyBtn?.dataset.story) {
      const concert = findEvent(storyBtn.dataset.story);
      if (concert) {
        haptics.play('tick');
        options.onAddToStory?.(concert);
        toast('Added to your story');
      }
      return;
    }

    const shareBtn = target.closest<HTMLElement>('[data-share]');
    if (shareBtn?.dataset.share) {
      const concert = findEvent(shareBtn.dataset.share);
      if (concert) {
        haptics.play('tick');
        options.onShare?.(concert);
      }
      return;
    }

    const openBtn = target.closest<HTMLElement>('[data-open]');
    if (openBtn?.dataset.open) {
      const concert = findEvent(openBtn.dataset.open);
      const link = concert
        ? ticketLinks({ city: concert.city, title: concert.searchTitle, genre: concert.searchGenre })[0]
        : ticketLinks({ city, title: openBtn.dataset.open })[0];
      if (link) openPartnerLink(link);
      return;
    }

    const removeBtn = target.closest<HTMLElement>('[data-remove]');
    if (removeBtn?.dataset.remove) {
      removeOuting(removeBtn.dataset.remove);
      haptics.play('light');
      render();
      return;
    }
  });

  /* ---------------------------------------------------------------- mount */

  host.appendChild(root);
  render();
  const interval = window.setInterval(tick, 1000);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const unsubscribe = subscribeOutings(() => refreshPlans());

  animate(
    root,
    [
      { opacity: 0, transform: 'translateY(16px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' },
  );

  return {
    destroy() {
      window.clearInterval(interval);
      window.clearTimeout(toastTimer);
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      unsubscribe();
      io?.disconnect();
      observedVideo = null;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      root.remove();
    },
  };
};

