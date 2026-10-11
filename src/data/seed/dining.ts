/**
 * The seeded Dine-in pack.
 *
 * Same contract as the concert pack: sample data, labelled as such on every
 * card, with a deep link to the real provider rather than an invented
 * reservation. Zomato's public user-key API was discontinued and Swiggy has
 * never had one — see `src/lib/places/providers.ts` for the whole picture.
 *
 * Ratings and prices here are pack values, not scraped ones. They are stable so
 * the sort orders are testable; nothing in the UI presents them as live.
 */

import type { DateVibe, DiningSpot } from '../../lib/places/types';

interface DiningSeed {
  readonly id: string;
  readonly name: string;
  readonly cuisines: readonly string[];
  readonly area: string;
  readonly priceForTwo: number;
  readonly rating: number;
  readonly pitch: string;
  readonly goodFor: readonly DateVibe[];
  readonly opensAt: string;
  readonly closesAt: string;
  readonly distanceKm: number;
  readonly palette: readonly [string, string, string, string];
  readonly style: DiningSpot['poster']['style'];
  readonly provider: DiningSpot['provider'];
}

const CITY = 'Pune';

const SEED: readonly DiningSeed[] = [
  {
    id: 'dine-01',
    name: 'Salt & Static',
    cuisines: ['Continental', 'Small plates'],
    area: 'Koregaon Park',
    priceForTwo: 1800,
    rating: 4.6,
    pitch: 'Low light, low music, a table you can actually talk across.',
    goodFor: ['first-date', 'quiet'],
    opensAt: '18:00',
    closesAt: '00:30',
    distanceKm: 2.1,
    palette: ['#140f18', '#e8c77e', '#c084fc', '#3f2f56'],
    style: 'dusk',
    provider: 'zomato',
  },
  {
    id: 'dine-02',
    name: 'Third Floor Thali',
    cuisines: ['Maharashtrian', 'Thali'],
    area: 'Shivajinagar',
    priceForTwo: 650,
    rating: 4.4,
    pitch: 'Unlimited thali, steel plates, no playlist. Lunch only, and worth the queue.',
    goodFor: ['group', 'quiet'],
    opensAt: '11:30',
    closesAt: '16:00',
    distanceKm: 4.8,
    palette: ['#1a1206', '#ffb86b', '#7de3b5', '#6b4a12'],
    style: 'bloom',
    provider: 'zomato',
  },
  {
    id: 'dine-03',
    name: 'Midnight Kettle',
    cuisines: ['Cafe', 'Desserts'],
    area: 'FC Road',
    priceForTwo: 700,
    rating: 4.2,
    pitch: 'Open when everything else shuts. Filter coffee at 2am is a personality.',
    goodFor: ['late-night', 'quiet', 'first-date'],
    opensAt: '17:00',
    closesAt: '03:00',
    distanceKm: 3.3,
    palette: ['#0e1220', '#8fb4ff', '#ffd166', '#3a2a6e'],
    style: 'moon',
    provider: 'zomato',
  },
  {
    id: 'dine-04',
    name: 'Courtyard Six Kitchen',
    cuisines: ['Mediterranean', 'Mezze'],
    area: 'Baner',
    priceForTwo: 2200,
    rating: 4.7,
    pitch: 'Everything is meant to be shared, which is a low-pressure way to order.',
    goodFor: ['first-date', 'group', 'outdoors'],
    opensAt: '12:30',
    closesAt: '23:30',
    distanceKm: 7.6,
    palette: ['#0b1a14', '#7de3b5', '#ff9466', '#1f8f78'],
    style: 'wave',
    provider: 'zomato',
  },
  {
    id: 'dine-05',
    name: 'Bao & Static',
    cuisines: ['Asian', 'Street food'],
    area: 'Viman Nagar',
    priceForTwo: 900,
    rating: 4.3,
    pitch: 'Loud, fast, and the chili oil is not a suggestion.',
    goodFor: ['group', 'late-night'],
    opensAt: '12:00',
    closesAt: '01:00',
    distanceKm: 6.2,
    palette: ['#14081a', '#ff3d6e', '#ffc857', '#7b3aa8'],
    style: 'bauhaus',
    provider: 'swiggy',
  },
  {
    id: 'dine-06',
    name: 'The Grove Table',
    cuisines: ['Farm-to-table', 'Vegetarian'],
    area: 'Aundh',
    priceForTwo: 1600,
    rating: 4.5,
    pitch: 'Six tables under trees, one menu, they tell you what is good tonight.',
    goodFor: ['first-date', 'outdoors', 'quiet'],
    opensAt: '18:30',
    closesAt: '23:00',
    distanceKm: 8.4,
    palette: ['#0b1626', '#7de3b5', '#e8c77e', '#1d3b6e'],
    style: 'bloom',
    provider: 'zomato',
  },
  {
    id: 'dine-07',
    name: 'Kettle Room Late',
    cuisines: ['Comfort food', 'Breakfast'],
    area: 'Camp',
    priceForTwo: 550,
    rating: 4.1,
    pitch: 'All-day breakfast, vinyl on the turntable, nobody hurries you out.',
    goodFor: ['late-night', 'quiet'],
    opensAt: '08:00',
    closesAt: '02:00',
    distanceKm: 5.1,
    palette: ['#161014', '#ffb86b', '#b9975a', '#4a3a22'],
    style: 'dusk',
    provider: 'swiggy',
  },
  {
    id: 'dine-08',
    name: 'Rooftop Nine',
    cuisines: ['Grill', 'Cocktails'],
    area: 'Kalyani Nagar',
    priceForTwo: 2600,
    rating: 4.4,
    pitch: 'Ninth floor, west-facing, and the sunset does half the work.',
    goodFor: ['first-date', 'outdoors', 'group'],
    opensAt: '17:00',
    closesAt: '01:00',
    distanceKm: 5.9,
    palette: ['#1b1233', '#ff8a5b', '#58d6c8', '#4a2a6e'],
    style: 'dusk',
    provider: 'zomato',
  },
];

export const buildDining = (): DiningSpot[] =>
  SEED.map(({ palette, style, id, ...rest }) => ({
    ...rest,
    id,
    city: CITY,
    currency: 'INR' as const,
    poster: { palette, style, seed: Number.parseInt(id.slice(-2), 10) },
    source: 'demo' as const,
  }));

export const DINING_CITY = CITY;

/** Cuisines in the pack, in first-appearance order. For the filter row. */
export const diningCuisines = (spots: readonly DiningSpot[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const spot of spots) {
    for (const cuisine of spot.cuisines) {
      if (!seen.has(cuisine)) {
        seen.add(cuisine);
        out.push(cuisine);
      }
    }
  }
  return out;
};
