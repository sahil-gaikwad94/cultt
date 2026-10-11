/**
 * The concert catalogue, as the app sees it (D-42).
 *
 * These are **editorial sample listings** — fictional artists, fictional venues,
 * invented titles and prices. They exist so the Concerts page has something real
 * to lay out, filter and animate before a partner integration lands. Nothing
 * here is live inventory and nothing here is social proof: there are no ratings,
 * no "sold out" flags and no "1.2k going", because none of that is knowable
 * without the partner (D-27/D-30, the honesty rule, applied to going out).
 *
 * Each event carries a `dayOffset` (days from *today*) rather than an absolute
 * date, and the page resolves it against the current clock at render time. That
 * is deliberate: a hard-coded 2026 date would make the whole page stale the
 * moment it shipped, and a stale "tonight" is a lie. `dayOffset` keeps the
 * listing perpetually upcoming, so the page is never stale.
 *
 * Real inventory — which shows exist, when, at what price — comes from the
 * partner. Until then `partnersLive()` is false and every surface shows the
 * "Sample listing" chip; the deep links still open the partner's own search.
 */

export type ConcertEnergy = 'intimate' | 'loud' | 'wild';

export interface ConcertEvent {
  /** Stable id — also the outing refId and the poster seed prefix. */
  id: string;
  /** One of `CITIES`. */
  city: string;
  /** Fictional venue. Never a real room's live listing. */
  venue: string;
  /** Fictional act. Never a real artist. */
  artist: string;
  /** The show's name. */
  title: string;
  /** Primary genre; always present in `genres`. */
  genre: string;
  /** Every genre tag on the bill, primary first. */
  genres: string[];
  /** One editorial line. */
  tagline: string;
  /** Days from *today* (0 = tonight). Resolved against the live clock. */
  dayOffset: number;
  /** Local wall-clock doors-for-music time, `"20:30"`. */
  time: string;
  /** How long before `time` the doors actually open. */
  doorsLeadMins: number;
  /** Set length in minutes. */
  durationMins: number;
  /** Cheapest ticket, in whole rupees. A "from" price, never a discount. */
  priceFrom: number;
  /** Room energy, for the chip and the sort of night it implies. */
  energy: ConcertEnergy;
  /** Deterministic poster seed — same seed, same art, forever. */
  posterSeed: string;
  /** Partner search term for the act. */
  searchTitle: string;
  /** Partner search term for the genre. */
  searchGenre: string;
}

/** The eight cities the page offers. Order is the chip order. */
export const CITIES: readonly string[] = [
  'Mumbai',
  'Delhi NCR',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Goa',
];

/** Every genre used by at least one event, in rail order. */
export const GENRES: readonly string[] = [
  'Indie',
  'Electronic',
  'Rock',
  'Jazz',
  'Hip-Hop',
  'Folk',
  'Classical',
  'Stand-up',
];

/** Sixteen sample listings — two per city, eight genres, eleven nights out. */
export const EVENTS: readonly ConcertEvent[] = [
  {
    id: 'cx-mum-01',
    city: 'Mumbai',
    venue: 'The Ballroom, Lower Parel',
    artist: 'Tara Vale & The Static',
    title: 'Neon Cartography',
    genre: 'Indie',
    genres: ['Indie', 'Rock'],
    tagline: 'Four-piece indie with a horn section that will not sit down.',
    dayOffset: 0,
    time: '20:30',
    doorsLeadMins: 60,
    durationMins: 120,
    priceFrom: 499,
    energy: 'loud',
    posterSeed: 'mumbai-neon-cartography',
    searchTitle: 'Tara Vale The Static',
    searchGenre: 'Indie',
  },
  {
    id: 'cx-mum-02',
    city: 'Mumbai',
    venue: 'Bandra Amphitheatre',
    artist: 'Azaan Rao',
    title: 'Concrete Bloom',
    genre: 'Electronic',
    genres: ['Electronic'],
    tagline: 'Live modular set. No laptop, all cables.',
    dayOffset: 2,
    time: '21:00',
    doorsLeadMins: 45,
    durationMins: 150,
    priceFrom: 899,
    energy: 'wild',
    posterSeed: 'mumbai-concrete-bloom',
    searchTitle: 'Azaan Rao',
    searchGenre: 'Electronic',
  },
  {
    id: 'cx-del-01',
    city: 'Delhi NCR',
    venue: 'The Vault, Cyber Hub',
    artist: 'Mira Sethi',
    title: 'Late Checkout',
    genre: 'Stand-up',
    genres: ['Stand-up'],
    tagline: 'New hour. Mostly true. Slightly incriminating.',
    dayOffset: 1,
    time: '20:00',
    doorsLeadMins: 30,
    durationMins: 90,
    priceFrom: 599,
    energy: 'intimate',
    posterSeed: 'delhi-late-checkout',
    searchTitle: 'Mira Sethi',
    searchGenre: 'Stand-up',
  },
  {
    id: 'cx-del-02',
    city: 'Delhi NCR',
    venue: 'Sunder Nursery Lawns',
    artist: 'Kolaba',
    title: 'Monsoon Frequencies',
    genre: 'Electronic',
    genres: ['Electronic', 'Folk'],
    tagline: 'Bass-heavy ragas under an open sky.',
    dayOffset: 5,
    time: '19:30',
    doorsLeadMins: 90,
    durationMins: 180,
    priceFrom: 1199,
    energy: 'wild',
    posterSeed: 'delhi-monsoon-frequencies',
    searchTitle: 'Kolaba',
    searchGenre: 'Electronic',
  },

  {
    id: 'cx-blr-01',
    city: 'Bengaluru',
    venue: 'The Foundry, Indiranagar',
    artist: 'The Halcyon Set',
    title: 'Glasshouse Sessions',
    genre: 'Indie',
    genres: ['Indie', 'Folk'],
    tagline: 'Acoustic first, feedback later.',
    dayOffset: 0,
    time: '20:45',
    doorsLeadMins: 45,
    durationMins: 110,
    priceFrom: 449,
    energy: 'intimate',
    posterSeed: 'bengaluru-glasshouse-sessions',
    searchTitle: 'The Halcyon Set',
    searchGenre: 'Indie',
  },
  {
    id: 'cx-blr-02',
    city: 'Bengaluru',
    venue: 'Cubbon Bandstand',
    artist: 'Vidya & The Loop',
    title: 'Raag & Roll',
    genre: 'Jazz',
    genres: ['Jazz', 'Classical'],
    tagline: 'Carnatic lines, a Rhodes piano, and a very patient drummer.',
    dayOffset: 3,
    time: '19:00',
    doorsLeadMins: 60,
    durationMins: 120,
    priceFrom: 649,
    energy: 'intimate',
    posterSeed: 'bengaluru-raag-and-roll',
    searchTitle: 'Vidya The Loop',
    searchGenre: 'Jazz',
  },
  {
    id: 'cx-hyd-01',
    city: 'Hyderabad',
    venue: 'The Terrace, Banjara Hills',
    artist: 'Nakul Prasad',
    title: 'Deccan Drive',
    genre: 'Hip-Hop',
    genres: ['Hip-Hop'],
    tagline: 'Telugu bars over boom-bap. Bring a friend.',
    dayOffset: 1,
    time: '21:30',
    doorsLeadMins: 60,
    durationMins: 120,
    priceFrom: 549,
    energy: 'loud',
    posterSeed: 'hyderabad-deccan-drive',
    searchTitle: 'Nakul Prasad',
    searchGenre: 'Hip-Hop',
  },
  {
    id: 'cx-hyd-02',
    city: 'Hyderabad',
    venue: 'Charminar Courtyard',
    artist: 'Saath Collective',
    title: 'Qawwali Electric',
    genre: 'Folk',
    genres: ['Folk', 'Classical'],
    tagline: 'Eight voices, one harmonium, a wall of dhol.',
    dayOffset: 6,
    time: '20:00',
    doorsLeadMins: 75,
    durationMins: 150,
    priceFrom: 399,
    energy: 'wild',
    posterSeed: 'hyderabad-qawwali-electric',
    searchTitle: 'Saath Collective',
    searchGenre: 'Folk',
  },

  {
    id: 'cx-pun-01',
    city: 'Pune',
    venue: 'The Loft, Koregaon Park',
    artist: 'Ira Menon',
    title: 'Small Hours',
    genre: 'Indie',
    genres: ['Indie'],
    tagline: 'Songs for the last train you already missed.',
    dayOffset: 2,
    time: '20:15',
    doorsLeadMins: 45,
    durationMins: 100,
    priceFrom: 399,
    energy: 'intimate',
    posterSeed: 'pune-small-hours',
    searchTitle: 'Ira Menon',
    searchGenre: 'Indie',
  },
  {
    id: 'cx-pun-02',
    city: 'Pune',
    venue: 'Shanivar Wada Grounds',
    artist: 'Bolt & The Baseline',
    title: 'Thunder Minor',
    genre: 'Rock',
    genres: ['Rock'],
    tagline: 'Loud, tuned down, and unreasonably tight.',
    dayOffset: 8,
    time: '19:30',
    doorsLeadMins: 90,
    durationMins: 150,
    priceFrom: 799,
    energy: 'wild',
    posterSeed: 'pune-thunder-minor',
    searchTitle: 'Bolt The Baseline',
    searchGenre: 'Rock',
  },
  {
    id: 'cx-che-01',
    city: 'Chennai',
    venue: 'The Docks, MRC Nagar',
    artist: 'Kaapi Klub',
    title: 'Salt Air Sessions',
    genre: 'Jazz',
    genres: ['Jazz'],
    tagline: 'A brass front line and the Bay of Bengal behind it.',
    dayOffset: 4,
    time: '19:45',
    doorsLeadMins: 60,
    durationMins: 120,
    priceFrom: 699,
    energy: 'loud',
    posterSeed: 'chennai-salt-air-sessions',
    searchTitle: 'Kaapi Klub',
    searchGenre: 'Jazz',
  },
  {
    id: 'cx-che-02',
    city: 'Chennai',
    venue: 'Marina Pavilion',
    artist: 'Meera Krishnan',
    title: 'Carnatic Loop',
    genre: 'Classical',
    genres: ['Classical'],
    tagline: 'Tradition, then a loop pedal.',
    dayOffset: 7,
    time: '18:30',
    doorsLeadMins: 45,
    durationMins: 150,
    priceFrom: 499,
    energy: 'intimate',
    posterSeed: 'chennai-carnatic-loop',
    searchTitle: 'Meera Krishnan',
    searchGenre: 'Classical',
  },

  {
    id: 'cx-kol-01',
    city: 'Kolkata',
    venue: 'The Ghat, Princep',
    artist: 'Anaya Bose',
    title: 'Howrah Hum',
    genre: 'Folk',
    genres: ['Folk', 'Indie'],
    tagline: 'Baul songs with a fuzz pedal.',
    dayOffset: 3,
    time: '20:00',
    doorsLeadMins: 60,
    durationMins: 120,
    priceFrom: 349,
    energy: 'intimate',
    posterSeed: 'kolkata-howrah-hum',
    searchTitle: 'Anaya Bose',
    searchGenre: 'Folk',
  },
  {
    id: 'cx-kol-02',
    city: 'Kolkata',
    venue: 'Salt Lake Arena',
    artist: 'Soham Dutt',
    title: 'Blackout Poetry',
    genre: 'Stand-up',
    genres: ['Stand-up'],
    tagline: 'One hour, no props, one microphone stand.',
    dayOffset: 9,
    time: '21:00',
    doorsLeadMins: 30,
    durationMins: 80,
    priceFrom: 449,
    energy: 'loud',
    posterSeed: 'kolkata-blackout-poetry',
    searchTitle: 'Soham Dutt',
    searchGenre: 'Stand-up',
  },
  {
    id: 'cx-goa-01',
    city: 'Goa',
    venue: 'The Beach House, Anjuna',
    artist: 'Tropic Static',
    title: 'Sunset Set',
    genre: 'Electronic',
    genres: ['Electronic'],
    tagline: 'Starts at golden hour, ends when it ends.',
    dayOffset: 2,
    time: '18:00',
    doorsLeadMins: 60,
    durationMins: 240,
    priceFrom: 1299,
    energy: 'wild',
    posterSeed: 'goa-sunset-set',
    searchTitle: 'Tropic Static',
    searchGenre: 'Electronic',
  },
  {
    id: 'cx-goa-02',
    city: 'Goa',
    venue: 'Old Quarter, Fontainhas',
    artist: 'Lila Fernandes',
    title: 'Fado, Reworked',
    genre: 'Folk',
    genres: ['Folk', 'Jazz'],
    tagline: 'Portuguese ghosts, Goan rhythm section.',
    dayOffset: 10,
    time: '20:30',
    doorsLeadMins: 45,
    durationMins: 110,
    priceFrom: 599,
    energy: 'intimate',
    posterSeed: 'goa-fado-reworked',
    searchTitle: 'Lila Fernandes',
    searchGenre: 'Folk',
  },

];
