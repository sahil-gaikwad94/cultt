/**
 * Seed track catalogue.
 *
 * Every artist and title here is invented for cultured, so nothing in the feed
 * is a real-world catalogue entry and nothing needs a label clearance. Genres
 * are taxonomy ids from src/lib/matching/taxonomy.ts; `searchArtist`/`searchTitle`
 * are what the preview provider resolves a legal 30-second preview from.
 *
 * No audio is hosted or re-streamed by cultured. Previews are resolved at play
 * time from a no-auth source and cached into `tracks.preview_url`.
 */

import type { Genre } from '../../lib/matching/taxonomy';

export interface SeedTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly genres: readonly Genre[];
  /** Seconds. */
  readonly length: number;
  /** One line of editorial copy, written for this product. */
  readonly blurb: string;
  /** Poster style key used by the v3 art generator. */
  readonly style: 'dusk' | 'moon' | 'wave' | 'bloom' | 'bauhaus';
}

export const SEED_TRACKS: readonly SeedTrack[] = [
  {
    id: 't_route9',
    title: 'Slow Light on Route 9',
    artist: 'Halcyon Mile',
    genres: ['indie_rock'],
    length: 214,
    blurb: 'A slow-burn driving song that sounds like the last hour of sun on a long highway.',
    style: 'dusk',
  },
  {
    id: 't_moons',
    title: 'Paper Moons',
    artist: 'Odessa Vale',
    genres: ['dream_pop'],
    length: 187,
    blurb: 'One detuned piano and a drum machine that sounds like rain on a bus window.',
    style: 'moon',
  },
  {
    id: 't_choir',
    title: 'Night Bus Choir',
    artist: 'The Lowtides',
    genres: ['indie_rock', 'folk'],
    length: 243,
    blurb: 'Forty voices on the final chorus and somehow it still feels intimate.',
    style: 'wave',
  },
  {
    id: 't_cherry',
    title: 'Cherry Static',
    artist: 'Nuvia',
    genres: ['hyperpop'],
    length: 176,
    blurb: 'Glossy synths over a bassline that never resolves.',
    style: 'bauhaus',
  },
  {
    id: 't_soft',
    title: 'Soft Machine Summer',
    artist: 'Dov and the Echoes',
    genres: ['folk'],
    length: 229,
    blurb: 'A warm, slightly sad song about a summer that already ended.',
    style: 'bloom',
  },
  {
    id: 't_glass',
    title: 'Glasshouse',
    artist: 'Imre Tanaka',
    genres: ['ambient'],
    length: 201,
    blurb: 'Glass harmonica and field recordings from a greenhouse.',
    style: 'dusk',
  },
  {
    id: 't_amapiano',
    title: 'Piano in the Market',
    artist: 'Sabelo Mokoena',
    genres: ['amapiano'],
    length: 238,
    blurb: 'Log drum, soft shaker, and the specific patience of an amapiano log.',
    style: 'bloom',
  },
  {
    id: 't_jungle',
    title: 'Breakline',
    artist: 'Cordell Nine',
    genres: ['jungle', 'drum_and_bass'],
    length: 196,
    blurb: 'Jungle that forgets it is a breakbeat right at the good part.',
    style: 'wave',
  },
  {
    id: 't_neosoul',
    title: 'Cheap Flowers',
    artist: 'Amara Bright',
    genres: ['neo_soul', 'r_and_b'],
    length: 224,
    blurb: 'Neo-soul that would rather talk about it than raise its voice.',
    style: 'bloom',
  },
  {
    id: 't_shoegaze',
    title: 'Undertow',
    artist: 'Pale Cassette',
    genres: ['shoegaze'],
    length: 268,
    blurb: 'Wall of guitar doing the emotional work of a whole support group.',
    style: 'dusk',
  },
  {
    id: 't_bedroom',
    title: 'Ceiling Fan',
    artist: 'Junie Ito',
    genres: ['bedroom_pop'],
    length: 172,
    blurb: 'Recorded in one take at 1am with the door shut.',
    style: 'moon',
  },
  {
    id: 't_hyperpop',
    title: 'Sugar Static',
    artist: 'Marzipan.exe',
    genres: ['hyperpop', 'disco'],
    length: 154,
    blurb: 'Sugar-rush hyperpop that empties the room and refills it twice.',
    style: 'bauhaus',
  },
  {
    id: 't_funk',
    title: 'Corner Store Funk',
    artist: 'The Laundromat',
    genres: ['funk'],
    length: 205,
    blurb: 'Funk recorded live in a laundromat because the room sounded right.',
    style: 'wave',
  },
  {
    id: 't_house',
    title: 'Basement Tempo',
    artist: 'Ola Fenn',
    genres: ['house'],
    length: 312,
    blurb: 'Four on the floor and absolutely no interest in making conversation.',
    style: 'dusk',
  },
  {
    id: 't_techno',
    title: 'Gray Area',
    artist: 'NULLPOINTER',
    genres: ['techno'],
    length: 348,
    blurb: 'Minimal techno for the last hour of a very long shift.',
    style: 'moon',
  },
  {
    id: 't_dnb',
    title: 'Overpass',
    artist: 'Kestrel Nine',
    genres: ['drum_and_bass'],
    length: 262,
    blurb: 'Drum and bass for crossing a city without noticing you crossed it.',
    style: 'wave',
  },
  {
    id: 't_jazz',
    title: 'Third Avenue Rain',
    artist: 'Hollis Byrd',
    genres: ['jazz'],
    length: 289,
    blurb: 'A trio playing like they had this conversation before.',
    style: 'bloom',
  },
  {
    id: 't_classical',
    title: 'Nocturne for a Phone Screen',
    artist: 'Ilya Sorokin',
    genres: ['classical'],
    length: 331,
    blurb: 'Piano nocturne written for 2am and a bright screen.',
    style: 'moon',
  },
  {
    id: 't_country',
    title: 'Tractor Light',
    artist: 'Wren Adair',
    genres: ['country', 'folk'],
    length: 219,
    blurb: 'Country that admits it is a love song the whole time.',
    style: 'dusk',
  },
  {
    id: 't_metal',
    title: 'Rust Belt Hymn',
    artist: 'Gravefield',
    genres: ['metal'],
    length: 276,
    blurb: 'Metal with a hymn structure and a genuinely good breakdown.',
    style: 'bauhaus',
  },
  {
    id: 't_punk',
    title: 'Eleven Songs About Nothing',
    artist: 'Short Attention',
    genres: ['punk'],
    length: 128,
    blurb: 'Punk that runs out of song ideas and turns that into the joke.',
    style: 'wave',
  },
  {
    id: 't_kpop',
    title: 'Platform 4',
    artist: 'Mint Condition',
    genres: ['k_pop'],
    length: 198,
    blurb: 'K-pop precision with a very British sense of humour underneath.',
    style: 'bloom',
  },
  {
    id: 't_latin',
    title: 'Avenida Lenta',
    artist: 'Cielo Marques',
    genres: ['latin'],
    length: 207,
    blurb: 'Latin rhythms that refuse to hurry anywhere.',
    style: 'bauhaus',
  },
  {
    id: 't_rnb',
    title: 'Slow Reply',
    artist: 'Devon Okafor',
    genres: ['r_and_b'],
    length: 231,
    blurb: 'R&B about drafting a text and then deleting it.',
    style: 'moon',
  },
];

export const SEED_ARTISTS: readonly string[] = [...new Set(SEED_TRACKS.map((track) => track.artist))];

export const trackById = (id: string): SeedTrack | undefined => SEED_TRACKS.find((track) => track.id === id);

/** The anti-genre list the Fingerprint uses for negative signals. */
export const ANTI_GENRE_OPTIONS: readonly Genre[] = [
  'country',
  'metal',
  'techno',
  'classical',
  'latin',
  'hip_hop',
];

/** Free no-auth preview sources, in the order the provider tries them. */
export const PREVIEW_SOURCES = [
  { id: 'itunes', label: 'Preview via iTunes Search' },
  { id: 'deezer', label: 'Preview via Deezer' },
] as const;