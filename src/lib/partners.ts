/**
 * Partner adapters: BookMyShow, SortMyScene, Zomato, Swiggy.
 *
 * The app never pretends to hold live inventory. What it does hold is the one
 * thing that always works without an API key: a correctly built deep link into
 * the partner's own search or listing page, so "Book tickets" opens a real,
 * usable page for that city, genre and title.
 *
 * When a partner integration *is* configured
 * (`window.CULTURED_CONFIG.partners = { live: true, ... }`), `partnersLive()`
 * returns true and the UI stops labelling the listing as a sample. Until then
 * the screens say "sample listing" — the honesty rule (D-27/D-30) applied to
 * going out.
 */

export type PartnerId = 'bookmyshow' | 'sortmyscene' | 'zomato' | 'swiggy';

export interface PartnerLink {
  id: PartnerId;
  /** Button label, already in product voice. */
  label: string;
  /** Web URL — always present, always opens a real page. */
  url: string;
  /** Native scheme, tried first on touch devices before the web fallback. */
  scheme: string | null;
  kind: 'tickets' | 'table';
}

interface PartnerConfig {
  partners?: { live?: boolean };
}

/** True only when a real integration is wired up for this deploy. */
export const partnersLive = (): boolean => {
  if (typeof window === 'undefined') return false;
  const config = (window as Window & { CULTURED_CONFIG?: PartnerConfig }).CULTURED_CONFIG;
  return config?.partners?.live === true;
};

const q = (value: string): string => encodeURIComponent(value.trim().replace(/\s+/g, ' '));

/** `Mumbai` → `mumbai`; `Delhi NCR` → `delhi-ncr`. */
export const citySlug = (city: string): string =>
  city
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface TicketQuery {
  city: string;
  /** Artist or event title. */
  title: string;
  /** Optional genre, folded into the search term. */
  genre?: string;
}

export interface TableQuery {
  city: string;
  /** Restaurant name, or the cuisine when browsing. */
  name: string;
  cuisine?: string;
}

/** The partner's search page for a set of terms. Pure, so it is testable. */
export const partnerUrl = (id: PartnerId, terms: (string | undefined)[], city?: string): string => {
  const term = terms.filter(Boolean).join(' ');
  switch (id) {
    case 'bookmyshow':
      return `https://in.bookmyshow.com/search?q=${q(term)}`;
    case 'sortmyscene':
      return `https://www.sortmyscene.com/search?q=${q(term)}`;
    case 'zomato':
      return city
        ? `https://www.zomato.com/${citySlug(city)}/restaurants?q=${q(term)}`
        : `https://www.zomato.com/search?q=${q(term)}`;
    case 'swiggy':
      return `https://www.swiggy.com/search?query=${q(term)}`;
  }
};

const schemeFor = (id: PartnerId): string | null => {
  switch (id) {
    case 'bookmyshow':
      return 'bookmyshow://';
    case 'sortmyscene':
      return 'sortmyscene://';
    case 'zomato':
      return 'zomato://';
    case 'swiggy':
      return 'swiggy://';
  }
};

/** Where a concert can be booked. BookMyShow first — it is the default in India. */
export const ticketLinks = (query: TicketQuery): PartnerLink[] => [
  {
    id: 'bookmyshow',
    label: 'Book on BookMyShow',
    url: partnerUrl('bookmyshow', [query.title, query.genre, query.city]),
    scheme: schemeFor('bookmyshow'),
    kind: 'tickets',
  },
  {
    id: 'sortmyscene',
    label: 'Find on SortMyScene',
    url: partnerUrl('sortmyscene', [query.title, query.genre]),
    scheme: schemeFor('sortmyscene'),
    kind: 'tickets',
  },
];

/** Where a table can be booked. Zomato for the table, Swiggy for the food. */
export const tableLinks = (query: TableQuery): PartnerLink[] => [
  {
    id: 'zomato',
    label: 'Book on Zomato',
    url: partnerUrl('zomato', [query.name, query.cuisine], query.city),
    scheme: schemeFor('zomato'),
    kind: 'table',
  },
  {
    id: 'swiggy',
    label: 'Order on Swiggy',
    url: partnerUrl('swiggy', [query.name, query.cuisine]),
    scheme: schemeFor('swiggy'),
    kind: 'table',
  },
];

/**
 * Opens a partner link. On a touch device the native scheme is tried first and
 * the web URL is opened after a short grace period, which is the only pattern
 * that works without knowing whether the app is installed. Returns the URL it
 * opened, so a caller can toast the truth rather than an assumption.
 */
export const openPartnerLink = (link: PartnerLink, opts: { open?: (url: string) => void } = {}): string => {
  const open = opts.open ?? ((url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); });
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  if (link.scheme && touch) {
    const started = Date.now();
    try {
      window.location.href = link.scheme;
    } catch {
      /* scheme blocked — the timer below still opens the web page */
    }
    window.setTimeout(() => {
      // Still here after 900 ms means the app did not take over.
      if (Date.now() - started < 4000 && !document.hidden) open(link.url);
    }, 900);
    return link.url;
  }
  open(link.url);
  return link.url;
};
