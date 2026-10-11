/**
 * The provider seam for the Live and Dine-in screens.
 *
 * Read this before adding a "book now" button anywhere.
 *
 * None of these services has a usable self-serve public API, and that was
 * checked rather than assumed:
 *
 *  - BookMyShow: no public developer API. Only invitation-only partner access
 *    and third-party scrapers.
 *  - SortMyScene: same shape, no public key.
 *  - Zomato: the public `developers.zomato.com/api/v2.1` user-key API was
 *    discontinued; what is left is a partner onboarding programme.
 *  - Swiggy: partner-only.
 *  - Ticketmaster Discovery: **real, free, self-serve**, roughly 5,000
 *    requests/day. This is the one a production build would actually switch on,
 *    which is why it is the only adapter here with a documented call shape.
 *
 * So a "book" action is a deep link, not an API call. That is the honest
 * implementation, and it is also what the app already does elsewhere — see the
 * note in `src/legacy.ts` about buttons that promised more than the platform
 * allows and were removed.
 *
 * The URLs below are the best I could produce without network access to those
 * hosts: the sandbox this was written in can only reach github.com, npm and
 * PyPI, so **no search path in this file has been fetched and verified**. They
 * are single constants for exactly that reason. `bookingLink` also returns the
 * search term separately so the caller can copy it to the clipboard, which
 * means a stale search path degrades to "you are on the right site with the
 * right words in your hand" rather than a dead end.
 */

import type { DiningSpot, LiveEvent, ProviderId } from './types';

/** Thrown by every adapter's `search`. There is no key to connect with. */
export class ProviderNotConnected extends Error {
  readonly provider: ProviderId;
  constructor(provider: ProviderId) {
    super(
      `${provider} has no public API. Turn on the Ticketmaster adapter for live inventory, or keep the seeded pack.`,
    );
    this.name = 'ProviderNotConnected';
    this.provider = provider;
  }
}

export interface Provider {
  readonly id: ProviderId;
  /** What the button says. Names the real destination. */
  readonly label: string;
  /** Shown under the button, so the destination is never a surprise. */
  readonly hint: string;
  /** Landing page for a city. Safe: it is just the provider's own site. */
  cityUrl(city: string): string;
  /** Best-effort search. See the warning at the top of this file. */
  searchUrl?(term: string): string;
}

const BOOKMYSHOW: Provider = {
  id: 'bookmyshow',
  label: 'BookMyShow',
  hint: 'Opens BookMyShow with this event in the search',
  cityUrl: (city) => `https://in.bookmyshow.com/explore/events-${slug(city)}`,
  searchUrl: (term) => `https://in.bookmyshow.com/search?q=${encodeURIComponent(term)}`,
};

const SORTMYSCENE: Provider = {
  id: 'sortmyscene',
  label: 'SortMyScene',
  hint: 'Opens SortMyScene — search for the event there',
  cityUrl: () => 'https://www.sortmyscene.com/',
};

const TICKETMASTER: Provider = {
  id: 'ticketmaster',
  label: 'Ticketmaster',
  hint: 'Opens Ticketmaster with this event in the search',
  cityUrl: (city) => `https://www.ticketmaster.com/search?q=${encodeURIComponent(city)}`,
  searchUrl: (term) => `https://www.ticketmaster.com/search?q=${encodeURIComponent(term)}`,
};

const ZOMATO: Provider = {
  id: 'zomato',
  label: 'Zomato',
  hint: 'Opens Zomato for this city',
  cityUrl: (city) => `https://www.zomato.com/${slug(city)}`,
  searchUrl: (term) => `https://www.zomato.com/search?q=${encodeURIComponent(term)}`,
};

const SWIGGY: Provider = {
  id: 'swiggy',
  label: 'Swiggy',
  hint: 'Opens Swiggy for this city',
  cityUrl: (city) => `https://www.swiggy.com/city/${slug(city)}`,
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  bookmyshow: BOOKMYSHOW,
  sortmyscene: SORTMYSCENE,
  ticketmaster: TICKETMASTER,
  zomato: ZOMATO,
  swiggy: SWIGGY,
};

export const provider = (id: ProviderId): Provider => PROVIDERS[id];

const slug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Where a listing came from, for the UI to name. */
export const providerOf = (item: LiveEvent | DiningSpot): Provider => PROVIDERS[item.provider];

export interface BookingLink {
  readonly url: string;
  /** Copy this to the clipboard as well; the search path may be stale. */
  readonly term: string;
  readonly label: string;
  readonly hint: string;
  /** True when the provider could only offer a city page, not a search. */
  readonly searchUnavailable: boolean;
}

/** The search phrase a person would actually type for this listing. */
export const searchTermFor = (item: LiveEvent | DiningSpot): string =>
  'title' in item ? `${item.artist} ${item.venue}`.trim() : `${item.name} ${item.area}`.trim();

export const bookingLink = (item: LiveEvent | DiningSpot): BookingLink => {
  const p = providerOf(item);
  const term = searchTermFor(item);
  const hasSearch = typeof p.searchUrl === 'function';
  return {
    url: hasSearch ? (p.searchUrl as (t: string) => string)(term) : p.cityUrl(item.city),
    term,
    label: p.label,
    hint: hasSearch ? p.hint : `${p.hint} — the name is copied, paste it into search`,
    searchUnavailable: !hasSearch,
  };
};

/**
 * Live inventory. Deliberately throws: there is no key, and an adapter that
 * quietly returned an empty list would look like "nothing on tonight" rather
 * than "not connected", which is a worse lie.
 */
export const searchProvider = async (id: ProviderId): Promise<never> => {
  throw new ProviderNotConnected(id);
};

/**
 * What a real Ticketmaster call would look like, kept here as the shape the
 * seam expects. Not wired: it needs a key, and inventing results is the one
 * thing this screen must not do.
 *
 * GET https://app.ticketmaster.com/discovery/v2/events.json
 *   ?apikey=<key>&city=pune&classificationName=music&sort=date,asc
 */
export const TICKETMASTER_DISCOVERY = 'https://app.ticketmaster.com/discovery/v2/events.json';
