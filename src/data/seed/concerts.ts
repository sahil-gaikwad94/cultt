/**
 * The seeded Live pack.
 *
 * Sample data, and the UI says so on every card (`SOURCE_LABEL.demo`). It is
 * not a scrape and not a claim about what is actually on: there is no public
 * BookMyShow or SortMyScene API to have scraped. What the pack is for is
 * building and testing the screen, and giving the booking deep link something
 * real to search for.
 *
 * Dates are stored as an offset from today rather than a fixed timestamp, so a
 * gig never renders as "last Tuesday" three months after someone cloned the
 * repo. The offset makes the pack deterministic for a given day, which is what
 * `planLive` needs to be testable.
 *
 * Artwork is generated from the palette (see `src/screens/places.ts`). No
 * artist photography ships here — inventing a photo of a band that does not
 * exist is exactly the failure mode `tests/unit/no-fake-people.test.ts` guards
 * against elsewhere in this app.
 */

import type { LiveEvent } from '../../lib/places/types';

interface ConcertSeed {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly kind: LiveEvent['kind'];
  readonly venue: string;
  readonly area: string;
  /** Days from today. 0 is tonight. */
  readonly dayOffset: number;
  readonly time: string;
  readonly doors: string;
  readonly priceFrom: number;
  readonly genres: readonly string[];
  readonly pitch: string;
  readonly palette: readonly [string, string, string, string];
  readonly style: LiveEvent['poster']['style'];
  readonly seats: LiveEvent['seats'];
  readonly provider: LiveEvent['provider'];
  readonly ageNote?: string;
}

const CITY = 'Pune';

const SEED: readonly ConcertSeed[] = [
  {
    id: 'live-01',
    title: 'Slow Light, Live',
    artist: 'Halcyon Mile',
    kind: 'concert',
    venue: 'The Blue Room',
    area: 'Koregaon Park',
    dayOffset: 0,
    time: '20:30',
    doors: '19:30',
    priceFrom: 799,
    genres: ['Indie', 'Road rock'],
    pitch: 'Four people, one van of gear, and a room small enough to hear the amp hum.',
    palette: ['#1b1233', '#ff8a5b', '#7c5cff', '#4a2a6e'],
    style: 'dusk',
    seats: 'limited',
    provider: 'bookmyshow',
    ageNote: '18+',
  },
  {
    id: 'live-02',
    title: 'Paper Moons — an evening set',
    artist: 'Odessa Vale',
    kind: 'concert',
    venue: 'Amber Hall',
    area: 'Kalyani Nagar',
    dayOffset: 1,
    time: '19:00',
    doors: '18:15',
    priceFrom: 1299,
    genres: ['Dream pop'],
    pitch: 'One detuned piano and a drum machine that sounds like rain on a bus window.',
    palette: ['#0b1626', '#58d6c8', '#8f7bff', '#1d3b6e'],
    style: 'moon',
    seats: 'available',
    provider: 'bookmyshow',
  },
  {
    id: 'live-03',
    title: 'Night Bus Choir',
    artist: 'The Lowtides',
    kind: 'concert',
    venue: 'Courtyard Six',
    area: 'Baner',
    dayOffset: 2,
    time: '21:00',
    doors: '20:00',
    priceFrom: 999,
    genres: ['Indie anthem'],
    pitch: 'Forty stacked voices on the last chorus, and the key change at 2:40.',
    palette: ['#180c1c', '#ff6fa5', '#ffb86b', '#7b3aa8'],
    style: 'wave',
    seats: 'selling-fast',
    provider: 'sortmyscene',
    ageNote: '21+',
  },
  {
    id: 'live-04',
    title: 'Cherry Static — album launch',
    artist: 'Nuvia',
    kind: 'concert',
    venue: 'Warehouse 9',
    area: 'Viman Nagar',
    dayOffset: 4,
    time: '22:00',
    doors: '21:00',
    priceFrom: 1499,
    genres: ['Synth pop', 'Electronic'],
    pitch: 'Glossy synths over a bassline that never resolves. Built for a dramatic commute.',
    palette: ['#14081a', '#ff3d6e', '#c3a6ff', '#ffc857'],
    style: 'bauhaus',
    seats: 'available',
    provider: 'bookmyshow',
    ageNote: '21+',
  },
  {
    id: 'live-05',
    title: 'Soft Machine Summer',
    artist: 'Dov and the Echoes',
    kind: 'concert',
    venue: 'The Grove Lawn',
    area: 'Aundh',
    dayOffset: 6,
    time: '18:00',
    doors: '17:00',
    priceFrom: 649,
    genres: ['Balearic folk'],
    pitch: 'Live in one take, crowd noise at the end, lawn seating, bring a jacket.',
    palette: ['#0b1a14', '#7de3b5', '#ffd166', '#1f8f78'],
    style: 'bloom',
    seats: 'available',
    provider: 'sortmyscene',
  },
  {
    id: 'live-06',
    title: 'Glasshouse — ambient set',
    artist: 'Imre Tanaka',
    kind: 'concert',
    venue: 'The Long Gallery',
    area: 'Shivajinagar',
    dayOffset: 8,
    time: '20:00',
    doors: '19:30',
    priceFrom: 899,
    genres: ['Ambient'],
    pitch: 'Glass harmonica and greenhouse field recordings. Sit down, do not talk.',
    palette: ['#0e1220', '#8fb4ff', '#ff9466', '#3a2a6e'],
    style: 'dusk',
    seats: 'limited',
    provider: 'ticketmaster',
  },
  {
    id: 'live-07',
    title: 'Pineapple on Pizza: a debate',
    artist: 'Open mic night',
    kind: 'comedy',
    venue: 'Basement 4',
    area: 'FC Road',
    dayOffset: 3,
    time: '20:00',
    doors: '19:30',
    priceFrom: 299,
    genres: ['Comedy'],
    pitch: 'Twelve people, one microphone, no set list. Bring someone you can laugh at it with.',
    palette: ['#1a1206', '#ffb86b', '#ff6f61', '#6b4a12'],
    style: 'bauhaus',
    seats: 'available',
    provider: 'bookmyshow',
    ageNote: '18+',
  },
  {
    id: 'live-08',
    title: 'Riverside Sessions',
    artist: 'Six acts, one lawn',
    kind: 'festival',
    venue: 'Riverfront Grounds',
    area: 'Hadapsar',
    dayOffset: 12,
    time: '16:00',
    doors: '15:00',
    priceFrom: 2499,
    genres: ['Indie', 'Folk', 'Electronic'],
    pitch: 'Two stages, food trucks, and a sunset that does most of the lighting design.',
    palette: ['#101a22', '#6fd3ff', '#ffd166', '#2b5f7a'],
    style: 'wave',
    seats: 'available',
    provider: 'bookmyshow',
  },
  {
    id: 'live-09',
    title: 'Late Set — unplugged',
    artist: 'Rotating open mic',
    kind: 'open-mic',
    venue: 'The Kettle Room',
    area: 'Camp',
    dayOffset: 5,
    time: '21:30',
    doors: '21:00',
    priceFrom: 0,
    genres: ['Acoustic'],
    pitch: 'Free entry, one song each, sign-up on the door. The room is small on purpose.',
    palette: ['#161014', '#e8c77e', '#b9975a', '#4a3a22'],
    style: 'moon',
    seats: 'available',
    provider: 'sortmyscene',
  },
];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local-time ISO stamp for `dayOffset` days from `now`, at `hh:mm`. */
export const stampFor = (now: number, dayOffset: number, hhmm: string): string => {
  const base = new Date(now);
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  const at = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + dayOffset,
    Number.isFinite(h) ? h : 20,
    Number.isFinite(m) ? m : 0,
    0,
    0,
  );
  const offsetMin = -at.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(
    at.getMinutes(),
  )}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

/** The pack, resolved against a clock. Pure: same `now` in, same list out. */
export const buildConcerts = (now: number): LiveEvent[] =>
  SEED.map((seed) => ({
    id: seed.id,
    title: seed.title,
    artist: seed.artist,
    kind: seed.kind,
    venue: seed.venue,
    area: seed.area,
    city: CITY,
    startsAt: stampFor(now, seed.dayOffset, seed.time),
    doors: seed.doors,
    priceFrom: seed.priceFrom,
    currency: 'INR' as const,
    genres: seed.genres,
    pitch: seed.pitch,
    poster: { palette: seed.palette, style: seed.style, seed: Number.parseInt(seed.id.slice(-2), 10) },
    seats: seed.seats,
    provider: seed.provider,
    ...(seed.ageNote ? { ageNote: seed.ageNote } : {}),
    source: 'demo' as const,
  }));

/** Every genre in the pack, in the order it first appears. For the filter row. */
export const concertGenres = (events: readonly LiveEvent[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const event of events) {
    for (const genre of event.genres) {
      if (!seen.has(genre)) {
        seen.add(genre);
        out.push(genre);
      }
    }
  }
  return out;
};

export const CONCERT_CITY = CITY;
