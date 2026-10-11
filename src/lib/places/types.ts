/**
 * Types for the two "go somewhere together" screens: Live and Dine-in.
 *
 * Both screens render a seeded pack, because neither has a usable public API.
 * The research behind that is recorded in docs/v5/STATUS.md, and it is not a
 * close call: BookMyShow, Zomato and Swiggy have no self-serve public API, and
 * the Zomato `developers.zomato.com` key was discontinued. Ticketmaster's
 * Discovery API is the one real, free, self-serve option and is the adapter a
 * production build would actually turn on.
 *
 * So the shape here is the honest one: a pack the app owns, plus a provider
 * seam that a real key can be dropped into later without touching a screen.
 * Nothing in this module invents a price, a rating or a seat count for a real
 * venue — every number comes from the pack, and every pack entry is labelled
 * as sample data in the UI.
 */

/** How a listing was sourced. Surfaced in the UI, never hidden. */
export type SourceKind = 'demo' | 'live';

export interface Poster {
  /** Four-colour palette the generated artwork is built from. */
  readonly palette: readonly [string, string, string, string];
  /** Which generator shape to use. */
  readonly style: PosterStyle;
  /** Stable seed, so the artwork never changes between renders. */
  readonly seed: number;
}

export type PosterStyle = 'dusk' | 'moon' | 'wave' | 'bauhaus' | 'bloom';

/** A clip the player can actually play. Optional: the demo pack has none. */
export interface Clip {
  readonly src: string;
  /** e.g. 'video/webm'. Passed through to the <source> element. */
  readonly type: string;
  readonly caption: string;
}

export type ProviderId = 'bookmyshow' | 'sortmyscene' | 'ticketmaster' | 'zomato' | 'swiggy';

export interface LiveEvent {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly kind: 'concert' | 'festival' | 'comedy' | 'open-mic';
  readonly venue: string;
  readonly area: string;
  readonly city: string;
  /** ISO-8601, local time, with an offset. */
  readonly startsAt: string;
  /** Doors, as printed on a ticket: '19:00'. */
  readonly doors: string;
  readonly priceFrom: number;
  readonly currency: 'INR';
  readonly genres: readonly string[];
  /** One line, in the voice of the app. Not marketing copy. */
  readonly pitch: string;
  readonly poster: Poster;
  readonly seats: 'available' | 'limited' | 'selling-fast';
  readonly provider: ProviderId;
  readonly ageNote?: string;
  readonly clip?: Clip;
  readonly source: SourceKind;
}

export interface DiningSpot {
  readonly id: string;
  readonly name: string;
  readonly cuisines: readonly string[];
  readonly area: string;
  readonly city: string;
  readonly priceForTwo: number;
  readonly currency: 'INR';
  /** Out of 5, one decimal. */
  readonly rating: number;
  /** One line, in the voice of the app. */
  readonly pitch: string;
  readonly goodFor: readonly DateVibe[];
  readonly opensAt: string;
  readonly closesAt: string;
  readonly distanceKm: number;
  readonly poster: Poster;
  readonly provider: ProviderId;
  readonly source: SourceKind;
}

export type DateVibe = 'first-date' | 'late-night' | 'quiet' | 'group' | 'outdoors';

export const DATE_VIBES: readonly { id: DateVibe; label: string }[] = [
  { id: 'first-date', label: 'First date' },
  { id: 'late-night', label: 'Late night' },
  { id: 'quiet', label: 'Can talk' },
  { id: 'group', label: 'Group' },
  { id: 'outdoors', label: 'Outdoors' },
];

export const SEAT_LABEL: Record<LiveEvent['seats'], string> = {
  available: 'Tickets available',
  limited: 'Few left',
  'selling-fast': 'Selling fast',
};

/** Shared by both packs: everything the UI needs to label a listing honestly. */
export const SOURCE_LABEL: Record<SourceKind, string> = {
  demo: 'Sample listing',
  live: 'Live',
};
