/**
 * Dine-in seed catalogue — editorial sample listings (D-42).
 *
 * Every venue here is invented for cultured: fictional names, fictional areas,
 * no real-world restaurant. `priceForTwo` is a hand-written *estimate* for two
 * people, not a quote and not live. Nothing that only a partner can know is
 * invented: no ratings, no review counts, no wait times, no availability. A
 * real table comes from Zomato or Swiggy through the deep links built in
 * `src/lib/partners.ts`.
 *
 * `searchName` / `searchCuisine` are the terms the partner search resolves, so
 * a listing always opens a real, usable page even though the venue is a sample.
 */

export interface Restaurant {
  readonly id: string;
  /** One of `CITIES`. */
  readonly city: string;
  readonly area: string;
  readonly name: string;
  /** Primary cuisine; always a member of `CUISINES`. */
  readonly cuisine: string;
  /** Every cuisine this kitchen cooks, for filtering. */
  readonly cuisines: readonly string[];
  /** Estimate in rupees for two people. Never a price, always an estimate. */
  readonly priceForTwo: number;
  readonly vibes: readonly string[];
  /** One editorial line on why you would pick this table. */
  readonly why: string;
  /** Values drawn from `OCCASIONS`. */
  readonly occasions: readonly string[];
  /** Deterministic seed for the procedural ambience art. */
  readonly posterSeed: string;
  /** What the partner search is given as the venue term. */
  readonly searchName: string;
  /** What the partner search is given as the cuisine term. */
  readonly searchCuisine: string;
  /** Exactly three, written for this product. */
  readonly menuHighlights: readonly string[];
  readonly hasBar: boolean;
  readonly pureVeg: boolean;
  /** Dietary flags beyond veg: honest, hand-set, never inferred. */
  readonly vegan?: boolean;
  readonly jain?: boolean;
}

/** The five occasions the planner offers. Also the occasion filter values. */
export const OCCASIONS = ['First date', 'Anniversary', 'Friends', 'Solo', 'Just hungry'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const CITIES = ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Goa'] as const;
export type City = (typeof CITIES)[number];

export const CUISINES = [
  'South Indian',
  'North Indian',
  'Modern Indian',
  'Awadhi',
  'Hyderabadi',
  'Chettinad',
  'Bengali',
  'Parsi',
  'Maharashtrian',
  'Coastal',
  'Goan',
  'Street Food',
  'Seafood',
  'Continental',
  'Italian',
  'Bakery',
  'Vegetarian',
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const RESTAURANTS: readonly Restaurant[] = [
  {
    id: 'r_mum_amber',
    city: 'Mumbai',
    area: 'Bandra West',
    name: 'Amber Dhow',
    cuisine: 'Coastal',
    cuisines: ['Coastal', 'Seafood'],
    priceForTwo: 1800,
    vibes: ['Sea breeze', 'Low light', 'Slow'],
    why: 'The tables face the water, so the sunset does the talking.',
    occasions: ['First date', 'Anniversary'],
    posterSeed: 'amber-dhow',
    searchName: 'Amber Dhow',
    searchCuisine: 'coastal seafood',
    menuHighlights: ['Koliwada prawns', 'Kokum cooler', 'Coconut rice'],
    hasBar: true,
    pureVeg: false,
  },
  {
    id: 'r_mum_tiffin',
    city: 'Mumbai',
    area: 'Lower Parel',
    name: 'Third Floor Tiffin',
    cuisine: 'Modern Indian',
    cuisines: ['Modern Indian', 'North Indian'],
    priceForTwo: 1400,
    vibes: ['Rooftop', 'Loud', 'Group-friendly'],
    why: 'A rooftop with a menu built for sharing and a view built for showing off.',
    occasions: ['Friends', 'Just hungry'],
    posterSeed: 'third-floor-tiffin',
    searchName: 'Third Floor Tiffin',
    searchCuisine: 'modern indian rooftop',
    menuHighlights: ['Ghee roast mushrooms', 'Kheema pao sliders', 'Miso kulfi'],
    hasBar: true,
    pureVeg: false,
  },
  {
    id: 'r_mum_curd',
    city: 'Mumbai',
    area: 'Matunga',
    name: 'Curd Rice Club',
    cuisine: 'South Indian',
    cuisines: ['South Indian', 'Vegetarian'],
    priceForTwo: 600,
    vibes: ['Canteen', 'Quick', 'No-fuss'],
    why: 'A canteen that treats comfort food as a serious discipline.',
    occasions: ['Solo', 'Just hungry'],
    posterSeed: 'curd-rice-club',
    searchName: 'Curd Rice Club',
    searchCuisine: 'south indian vegetarian',
    menuHighlights: ['Curd rice', 'Podhi dosa', 'Filter coffee'],
    hasBar: false,
    pureVeg: true,
    vegan: true,
  },
  {
    id: 'r_del_kebab',
    city: 'Delhi NCR',
    area: 'Hauz Khas',
    name: 'Kathputli Kebab',
    cuisine: 'Awadhi',
    cuisines: ['Awadhi', 'North Indian'],
    priceForTwo: 1600,
    vibes: ['Courtyard', 'Candlelit', 'Old-school'],
    why: 'Slow-cooked kebabs in a courtyard that has heard every first-date story.',
    occasions: ['First date', 'Anniversary'],
    posterSeed: 'kathputli-kebab',
    searchName: 'Kathputli Kebab',
    searchCuisine: 'awadhi kebab',
    menuHighlights: ['Galouti kebab', 'Sheermal', 'Shahi tukda'],
    hasBar: true,
    pureVeg: false,
  },
  {
    id: 'r_del_tandoor',
    city: 'Delhi NCR',
    area: 'Gurugram',
    name: 'Tandoor & Tonic',
    cuisine: 'North Indian',
    cuisines: ['North Indian', 'Continental'],
    priceForTwo: 2000,
    vibes: ['Bar-forward', 'Buzzy', 'Late'],
    why: 'A bar that happens to serve very good tandoor, or the reverse depending on the hour.',
    occasions: ['Friends', 'Just hungry'],
    posterSeed: 'tandoor-and-tonic',
    searchName: 'Tandoor & Tonic',
    searchCuisine: 'north indian bar',
    menuHighlights: ['Amritsari fish', 'Butter chicken', 'Smoked old fashioned'],
    hasBar: true,
    pureVeg: false,
  },
  {
    id: 'r_del_chillum',
    city: 'Delhi NCR',
    area: 'Khan Market',
    name: 'The Chillum Room',
    cuisine: 'Continental',
    cuisines: ['Continental', 'Italian'],
    priceForTwo: 2200,
    vibes: ['Quiet', 'Wine list', 'Window seats'],
    why: 'Small, low-lit, and entirely uninterested in being seen.',
    occasions: ['Anniversary', 'First date'],
    posterSeed: 'chillum-room',
    searchName: 'The Chillum Room',
    searchCuisine: 'continental italian',
    menuHighlights: ['Truffle gnocchi', 'Roast chicken', 'Basque cheesecake'],
    hasBar: true,
    pureVeg: false,
  },

  {
    id: 'r_blr_filter',
    city: 'Bengaluru',
    area: 'Indiranagar',
    name: 'Filter Coffee For Two',
    cuisine: 'South Indian',
    cuisines: ['South Indian', 'Vegetarian'],
    priceForTwo: 500,
    vibes: ['Daytime', 'Bright', 'Cheap'],
    why: 'A breakfast counter that is somehow always exactly what you needed.',
    occasions: ['Solo', 'Just hungry'],
    posterSeed: 'filter-coffee-for-two',
    searchName: 'Filter Coffee For Two',
    searchCuisine: 'south indian breakfast',
    menuHighlights: ['Idli with ghee podi', 'Benne masala dosa', 'Filter kaapi'],
    hasBar: false,
    pureVeg: true,
    vegan: true,
  },
  {
    id: 'r_blr_bakehouse',
    city: 'Bengaluru',
    area: 'Koramangala',
    name: 'Basement Bakehouse',
    cuisine: 'Italian',
    cuisines: ['Italian', 'Bakery'],
    priceForTwo: 1500,
    vibes: ['Cosy', 'Sourdough', 'Bookish'],
    why: 'A basement that smells of proofing dough and takes its pasta seriously.',
    occasions: ['First date', 'Friends'],
    posterSeed: 'basement-bakehouse',
    searchName: 'Basement Bakehouse',
    searchCuisine: 'italian bakery',
    menuHighlights: ['Cacio e pepe', 'Sourdough flatbread', 'Olive oil cake'],
    hasBar: false,
    pureVeg: false,
  },
  {
    id: 'r_hyd_dum',
    city: 'Hyderabad',
    area: 'Banjara Hills',
    name: 'Dum Pukht Deccan',
    cuisine: 'Hyderabadi',
    cuisines: ['Hyderabadi', 'Awadhi'],
    priceForTwo: 1700,
    vibes: ['Feast', 'Family-style', 'Spice-forward'],
    why: 'A sealed-pot biryani that arrives with the whole room watching.',
    occasions: ['Anniversary', 'Friends'],
    posterSeed: 'dum-pukht-deccan',
    searchName: 'Dum Pukht Deccan',
    searchCuisine: 'hyderabadi biryani',
    menuHighlights: ['Dum biryani', 'Haleem', 'Double ka meetha'],
    hasBar: false,
    pureVeg: false,
  },
  {
    id: 'r_hyd_chaat',
    city: 'Hyderabad',
    area: 'Charminar',
    name: 'Charminar Chaat Co.',
    cuisine: 'Street Food',
    cuisines: ['Street Food', 'Vegetarian'],
    priceForTwo: 400,
    vibes: ['Chaotic', 'Standing room', 'Cheap'],
    why: 'Loud, cheap, and the best possible way to end an evening.',
    occasions: ['Just hungry', 'Friends'],
    posterSeed: 'charminar-chaat',
    searchName: 'Charminar Chaat Co.',
    searchCuisine: 'street food chaat',
    menuHighlights: ['Pani puri', 'Dahi papdi', 'Osmania biscuit'],
    hasBar: false,
    pureVeg: true,
    vegan: true,
    jain: true,
  },
  {
    id: 'r_pun_misal',
    city: 'Pune',
    area: 'Kothrud',
    name: 'Misal & Me',
    cuisine: 'Maharashtrian',
    cuisines: ['Maharashtrian', 'Street Food'],
    priceForTwo: 450,
    vibes: ['Spicy', 'Morning', 'Unfussy'],
    why: 'A misal counter with four heat levels and no mercy at level four.',
    occasions: ['Solo', 'Just hungry'],
    posterSeed: 'misal-and-me',
    searchName: 'Misal & Me',
    searchCuisine: 'maharashtrian misal',
    menuHighlights: ['Kolhapuri misal', 'Sabudana khichdi', 'Sol kadhi'],
    hasBar: false,
    pureVeg: true,
    vegan: true,
  },
  {
    id: 'r_pun_river',
    city: 'Pune',
    area: 'Koregaon Park',
    name: 'Riverbank Grill',
    cuisine: 'Continental',
    cuisines: ['Continental', 'Seafood'],
    priceForTwo: 1900,
    vibes: ['Terrace', 'River view', 'Slow'],
    why: 'A terrace grill where the river does most of the decorating.',
    occasions: ['First date', 'Anniversary'],
    posterSeed: 'riverbank-grill',
    searchName: 'Riverbank Grill',
    searchCuisine: 'continental grill',
    menuHighlights: ['Grilled pomfret', 'Lamb chops', 'Key lime tart'],
    hasBar: true,
    pureVeg: false,
  },

  {
    id: 'r_che_marina',
    city: 'Chennai',
    area: 'Besant Nagar',
    name: 'Marina Meals',
    cuisine: 'South Indian',
    cuisines: ['South Indian', 'Vegetarian'],
    priceForTwo: 550,
    vibes: ['Beachside', 'Banana leaf', 'Family'],
    why: 'A banana-leaf meal a short walk from the sand.',
    occasions: ['Friends', 'Just hungry'],
    posterSeed: 'marina-meals',
    searchName: 'Marina Meals',
    searchCuisine: 'south indian banana leaf',
    menuHighlights: ['Full meals', 'Chettinad veg kurma', 'Rose milk'],
    hasBar: false,
    pureVeg: true,
    vegan: true,
  },
  {
    id: 'r_che_claypot',
    city: 'Chennai',
    area: 'T. Nagar',
    name: 'Chettinad Claypot',
    cuisine: 'Chettinad',
    cuisines: ['Chettinad', 'South Indian'],
    priceForTwo: 1300,
    vibes: ['Peppery', 'Home-style', 'Warm'],
    why: 'Black pepper and clay pots, cooked like the recipe is a family argument.',
    occasions: ['Friends', 'Anniversary'],
    posterSeed: 'chettinad-claypot',
    searchName: 'Chettinad Claypot',
    searchCuisine: 'chettinad restaurant',
    menuHighlights: ['Pepper chicken', 'Mushroom pepper fry', 'Elaneer payasam'],
    hasBar: false,
    pureVeg: false,
  },
  {
    id: 'r_kol_baithak',
    city: 'Kolkata',
    area: 'Ballygunge',
    name: 'Bhojohori Baithak',
    cuisine: 'Bengali',
    cuisines: ['Bengali', 'Seafood'],
    priceForTwo: 1200,
    vibes: ['Addas', 'Fish-forward', 'Nostalgic'],
    why: 'A parlour-style dining room that expects you to stay for the argument.',
    occasions: ['First date', 'Friends'],
    posterSeed: 'bhojohori-baithak',
    searchName: 'Bhojohori Baithak',
    searchCuisine: 'bengali restaurant',
    menuHighlights: ['Shorshe ilish', 'Kosha mangsho', 'Nolen gur ice cream'],
    hasBar: false,
    pureVeg: false,
  },
  {
    id: 'r_kol_parsi',
    city: 'Kolkata',
    area: 'Park Street',
    name: 'Para Parsi Cafe',
    cuisine: 'Parsi',
    cuisines: ['Parsi', 'Bakery'],
    priceForTwo: 1100,
    vibes: ['Old-world', 'Tea', 'Wooden'],
    why: 'Marble tables, a ceiling fan, and a menu unchanged on purpose.',
    occasions: ['Solo', 'Anniversary'],
    posterSeed: 'para-parsi-cafe',
    searchName: 'Para Parsi Cafe',
    searchCuisine: 'parsi cafe',
    menuHighlights: ['Mutton dhansak', 'Bun maska', 'Lagan nu custard'],
    hasBar: false,
    pureVeg: false,
  },
  {
    id: 'r_goa_susegad',
    city: 'Goa',
    area: 'Anjuna',
    name: 'Susegad Shack',
    cuisine: 'Goan',
    cuisines: ['Goan', 'Seafood'],
    priceForTwo: 1500,
    vibes: ['Beach', 'Barefoot', 'Sunset'],
    why: 'Shoes off, feet in the sand, a grill going behind you.',
    occasions: ['First date', 'Friends'],
    posterSeed: 'susegad-shack',
    searchName: 'Susegad Shack',
    searchCuisine: 'goan seafood shack',
    menuHighlights: ['Rava fried prawns', 'Fish curry rice', 'Bebinca'],
    hasBar: true,
    pureVeg: false,
  },
  {
    id: 'r_goa_prawn',
    city: 'Goa',
    area: 'Panjim',
    name: 'Prawn Curry Kitchen',
    cuisine: 'Goan',
    cuisines: ['Goan', 'Coastal'],
    priceForTwo: 1000,
    vibes: ['Family-run', 'Courtyard', 'Home-style'],
    why: 'A courtyard kitchen where the curry recipe has not changed in three generations.',
    occasions: ['Anniversary', 'Just hungry'],
    posterSeed: 'prawn-curry-kitchen',
    searchName: 'Prawn Curry Kitchen',
    searchCuisine: 'goan fish curry',
    menuHighlights: ['Prawn balchao', 'Xacuti', 'Sannas'],
    hasBar: false,
    pureVeg: false,
  },
];

export const restaurantById = (id: string): Restaurant | undefined =>
  RESTAURANTS.find((restaurant) => restaurant.id === id);

