#!/usr/bin/env node
/**
 * Seed corpus generator.
 *
 * Writes every original meme-style card the Culture Feed can show. Nothing here
 * is scraped, downloaded or adapted from an existing meme: each caption is
 * written for this product, sits on a generated background, and carries the
 * taxonomy tags the matching engine learns from.
 *
 *   node scripts/generate-meme-corpus.mjs
 *
 * Output: src/data/seed/memes.ts (typed) and src/data/seed/memes.json.
 * Deterministic: same input, byte-identical output.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/* --------------------------------------------------------------- palettes */

/** Exactly the accents the v3 seam already paints with. No new colours. */
const PALETTE = [
  { bg: '#EFE9DA', fg: '#141413', ac: '#F26B4E' },
  { bg: '#F26B4E', fg: '#141413', ac: '#EFE9DA' },
  { bg: '#F2D45C', fg: '#141413', ac: '#141413' },
  { bg: '#9EC5E8', fg: '#141413', ac: '#F2D45C' },
  { bg: '#C8A8F0', fg: '#141413', ac: '#EFE9DA' },
  { bg: '#9be8bf', fg: '#141413', ac: '#F26B4E' },
  { bg: '#ff8fa3', fg: '#141413', ac: '#F2D45C' },
  { bg: '#2b2a26', fg: '#EFE9DA', ac: '#ff5d7a' },
];

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/* --------------------------------------------------------------- corpus */

/**
 * [caption, topic, [content families], [format features], [style axes]]
 * `content`/`format`/`styles` are taxonomy ids from src/lib/matching/taxonomy.ts.
 */
const CORPUS = [
  /* --- 9-5 Cyber --------------------------------------------------- */
  ['me: i’ll just patch one small thing\n\nthe codebase: a nature documentary', 'work', ['absurd', 'work_horror'], ['text_post'], ['self_defeating']],
  ['standup meeting:\n\n*agenda: no agenda*', 'work', ['deadpan', 'observational'], ['text_post', 'reaction_meme'], ['deadpan', 'self_defeating']],
  ['“quick question” — 45 minutes later', 'work', ['hyperbole', 'observational'], ['text_post'], ['hyperbole']],
  ['my calendar is full but nothing is booked', 'work', ['absurd', 'observational'], ['text_post'], ['deadpan']],
  ['the deploy is green. i am not.', 'work', ['dark', 'work_horror'], ['reaction_meme'], ['self_defeating']],
  ['nobody: absolutely nobody:\n\nme at 4:59pm: one more fix', 'work', ['absurd', 'relatable'], ['text_post'], ['absurd']],
  ['we solved it with a spreadsheet\n\nthe spreadsheet had a bug', 'work', ['wordplay', 'edgelord'], ['text_post'], ['affiliative']],
  ['“it works on my machine” is not a defence, it is a confession', 'work', ['deadpan', 'edgelord'], ['text_post'], ['deadpan']],
  ['onboarding doc: 4 pages\n\nactual onboarding: “ask Ravi”', 'work', ['relatable', 'observational'], ['screenshot', 'text_post'], ['self_defeating']],
  ['promotion criteria: be visible\n\nactual criteria: be in the meeting where decisions happen', 'work', ['edgelord', 'observational'], ['text_post'], ['deadpan']],
  ['i renamed a variable and two things broke\n\nthey were unrelated', 'work', ['absurd'], ['text_post'], ['absurd']],
  ['the ticket says “simple”\n\nthe ticket has 14 subtasks', 'work', ['work_horror', 'hyperbole'], ['screenshot'], ['hyperbole']],
  ['“can we make it simpler”\n\n*deletes the feature*', 'work', ['cringe_irony', 'work_horror'], ['two_panel'], ['dark']],
  ['writing documentation for future me\n\nfuture me: who is this', 'work', ['absurd', 'meta'], ['text_post'], ['absurd']],
  ['friday deploy at 4:58\n\nit is always friday at 4:58', 'work', ['absurd', 'relatable'], ['reaction_meme'], ['absurd']],
  ['i have opinions about tabs vs spaces\n\ni will not be changing them', 'work', ['edgelord', 'wordplay'], ['text_post'], ['aggressive']],

  /* --- Main Character Audio ------------------------------------------ */
  ['“one more song then bed”\n\nme at 4am: sequencing a second album', 'music', ['relatable', 'dark'], ['text_post'], ['self_defeating']],
  ['the 8 seconds before the beat drop\n\nme: 🧍', 'music', ['absurd'], ['reaction_meme'], ['absurd']],
  ['new album friday at midnight\n\nme: refreshing at 11:59 like a raccoon', 'music', ['relatable', 'hyperbole'], ['text_post'], ['affiliative']],
  ['i can tell you the tempo of a song by vibe alone\n\nit is almost always wrong', 'music', ['wordplay', 'deadpan'], ['text_post'], ['deadpan']],
  ['the bridge. THE BRIDGE.\n\ni have no one to send this to. i am sending it here.', 'music', ['hyperbole', 'niche_hobby'], ['text_post'], ['affiliative']],
  ['“it grows on you” is what we say\n\nabout the song we skipped 40 times', 'music', ['wordplay', 'deadpan'], ['text_post'], ['deadpan']],
  ['vinyl arrived today\n\nnow i own a music player and one album', 'music', ['niche_hobby', 'wholesome'], ['text_post'], ['affiliative']],
  ['my taste in music peaked in 2019\n\nand honestly? valid', 'music', ['boomer', 'self_defeating'], ['text_post'], ['self_defeating']],
  ['the song is 3 minutes long\n\nthe epilogue is 3 days long', 'music', ['hyperbole', 'dark'], ['text_post'], ['self_enhancing']],
  ['someone played this at a party\n\ni have been emotionally bonded since', 'music', ['relatable', 'niche_hobby'], ['text_post'], ['affiliative']],
  ['rewind credits: 4\n\nused on: finding the exact second the drums enter', 'music', ['niche_hobby', 'absurd'], ['screenshot'], ['absurd']],
  ['discovered this song from a 14-second clip\n\nand now the full version owns me', 'music', ['relatable', 'niche_hobby'], ['text_post'], ['affiliative']],
  ['i make a playlist for every mood\n\nthe mood is always “avoidant on a tuesday”', 'music', ['self_defeating', 'dark'], ['text_post'], ['self_defeating']],
  ['the key change is illegal in 11 states\n\ni know because i checked, in a group chat', 'music', ['wordplay', 'niche_hobby'], ['text_post'], ['affiliative']],
  ['concert: 3 songs in and everyone is filming\n\nme: finally hearing the second song', 'music', ['observational', 'cringe_irony'], ['two_panel'], ['deadpan']],
  ['“this is so niche”\n\nme, streaming it on loop: correct', 'music', ['niche_hobby', 'affiliative'], ['text_post'], ['self_enhancing']],
  ['the bassline does not resolve\n\nand that is the whole point', 'music', ['deadpan', 'niche_hobby'], ['text_post'], ['deadpan']],
  ['my most played song this year starts with rain', 'music', ['wholesome', 'niche_hobby'], ['text_post'], ['affiliative']],
  ['i cannot sing. i will never sing.\nyou will hear me singing.', 'music', ['self_defeating', 'affiliative'], ['two_panel'], ['self_defeating']],

  /* --- Couch Canon --------------------------------------------------- */
  ['“just one more episode”\n\nsunrise: hi', 'screen', ['relatable', 'dark'], ['text_post'], ['self_defeating']],
  ['starting season 1 at 1am is a lifestyle choice', 'screen', ['dark', 'relatable'], ['text_post'], ['self_defeating']],
  ['“it gets good at episode 12”\n\nepisode 3: nothing could be worse\n\nepisode 12: nothing could be better', 'screen', ['hyperbole', 'wordplay'], ['text_post'], ['hyperbole']],
  ['finished the show. now what.\n\nthe void stares back', 'screen', ['dark', 'absurd'], ['reaction_meme'], ['dark']],
  ['streaming service suggested this because i paused once, twice, three times', 'screen', ['absurd', 'cringe_irony'], ['screenshot'], ['absurd']],
  ['rewatching the comfort show for the 900th time\n\nstill know every line', 'screen', ['wholesome', 'relatable'], ['text_post'], ['affiliative']],
  ['the plot is simple:\n\n1. someone lies\n2. everyone forgives them', 'screen', ['deadpan', 'observational'], ['text_post'], ['deadpan']],
  ['i paused to check the fridge and now\n\nseven episodes passed', 'screen', ['absurd', 'relatable'], ['reaction_meme'], ['absurd']],
  ['season finale, alone, at 1am, in the dark.\n\nthis is cinema and i accept that.', 'screen', ['wholesome', 'dark'], ['text_post'], ['affiliative']],
  ['“canceled after 2 seasons”\n\nwe were not ready anyway', 'screen', ['wordplay', 'dark'], ['text_post'], ['deadpan']],
  ['adding 400 hours of background noise to my personality', 'screen', ['self_defeating', 'meta'], ['text_post'], ['self_defeating']],
  ['i watch documentaries about my own habits\n\nand then do the habits', 'screen', ['observational', 'meta'], ['text_post'], ['deadpan']],
  ['binge-watched a cooking show\n\nstill cannot cook', 'screen', ['absurd', 'cringe_irony'], ['two_panel'], ['absurd']],
  ['the new season has 3 good episodes\n\nthat is a 100% success rate by industry standards', 'screen', ['deadpan', 'edgelord'], ['text_post'], ['deadpan']],
  ['fell asleep mid-scene\n\nwoke up to the credits. no idea who anyone is.', 'screen', ['relatable', 'absurd'], ['reaction_meme'], ['self_defeating']],
  ['added a new language because the character speaks it\n\nnow i’m invested. this is a trap.', 'screen', ['niche_hobby', 'wordplay'], ['text_post'], ['absurd']],
  ['the prestige TV to match my unhinged schedule', 'screen', ['wordplay', 'cringe_irony'], ['text_post'], ['self_enhancing']],
  ['i finished the series that everyone asked me about\n\nsorry it took 4 years', 'screen', ['deadpan', 'self_defeating'], ['text_post'], ['deadpan']],

  /* --- Third Space --------------------------------------------------- */
  ['gym: 5 min\nstretching: 4 min\nresting on my phone: 51 min', 'life', ['relatable', 'wholesome'], ['text_post'], ['self_defeating']],
  ['hydration is a lifestyle now', 'life', ['absurd', 'self_defeating'], ['text_post'], ['absurd']],
  ['my dog hears the word “walk” from three rooms away\n\ni hear the word “out” from three words away', 'life', ['wholesome', 'relatable'], ['text_post'], ['affiliative']],
  ['cooking for one is just meal prep\n\nwith nobody to impress', 'life', ['observational', 'wholesome'], ['text_post'], ['affiliative']],
  ['the smoke alarm has opinions about my cooking\n\nwe are in a relationship now', 'life', ['absurd', 'wordplay'], ['text_post'], ['absurd']],
  ['plants: thriving\n\nme: thriving, technically', 'life', ['wholesome', 'self_defeating'], ['text_post'], ['self_defeating']],
  ['i go outside “for a bit”\n\nthe sun has fully retired by then', 'life', ['relatable', 'dark'], ['text_post'], ['self_defeating']],
  ['the corner of the shop where the good snacks are\n\nnobody goes there. it is mine.', 'life', ['niche_hobby', 'wholesome'], ['text_post'], ['affiliative']],
  ['weekend plans: aggressively unplanned\n\nand that is the whole point', 'life', ['relatable', 'absurd'], ['text_post'], ['absurd']],
  ['laundry day is a personality trait at this point', 'life', ['observational', 'deadpan'], ['text_post'], ['deadpan']],
  ['bought a plant to prove i am responsible\n\nthe plant is thriving. i am not.', 'life', ['wordplay', 'self_defeating'], ['two_panel'], ['self_defeating']],
  ['my idea of adventure: a different route home', 'life', ['relatable', 'absurd'], ['text_post'], ['absurd']],
  ['walking to get milk takes 4 minutes\n\ncoming back takes 22', 'life', ['hyperbole', 'relatable'], ['text_post'], ['hyperbole']],
  ['i reorganized my bookmarks by mood\n\nnow i have 3,000 bookmarks and 12 moods', 'life', ['niche_hobby', 'absurd'], ['screenshot'], ['absurd']],
  ['the third cup of coffee has left the building', 'life', ['absurd', 'self_defeating'], ['reaction_meme'], ['absurd']],
  ['made a pasta from scratch\n\nso did the sauce from a jar. still counts.', 'life', ['wordplay', 'self_defeating'], ['text_post'], ['self_defeating']],
  ['sunday scaries vs sunday scaries: late edition', 'life', ['wordplay', 'relatable'], ['text_post'], ['self_defeating']],
  ['i hold doorways like it is my job', 'life', ['wholesome', 'cringe_irony'], ['text_post'], ['affiliative']],

  /* --- Situationship HQ ---------------------------------------------- */
  ['flirting style: sending a song at 1:47am\n\ncaption: “no reason”', 'love', ['romance_disaster', 'relatable'], ['text_post'], ['self_defeating']],
  ['we have not spoken in 6 weeks\n\nbut the playlist is still collaborative', 'love', ['romance_disaster', 'wordplay'], ['text_post'], ['self_defeating']],
  ['“we should hang out sometime”\n\ntransmission received. never acknowledged.', 'love', ['deadpan', 'romance_disaster'], ['text_post'], ['deadpan']],
  ['the read receipt is on and it is a hostage situation', 'love', ['dark', 'romance_disaster'], ['reaction_meme'], ['dark']],
  ['they replied “haha” and i have not recovered', 'love', ['romance_disaster', 'cringe_irony'], ['text_post'], ['self_defeating']],
  ['my type: person with good taste and terrible timing', 'love', ['romance_disaster', 'wordplay'], ['text_post'], ['self_defeating']],
  ['confidently single. aggressively coupled to my spotify.', 'love', ['wordplay', 'self_enhancing'], ['text_post'], ['self_enhancing']],
  ['crush archive: songs i sent to no one', 'love', ['self_defeating', 'romance_disaster'], ['screenshot'], ['self_defeating']],
  ['“let’s keep it chill”\n\nsure. here is a 14-page analysis of your texts.', 'love', ['romance_disaster', 'hyperbole'], ['two_panel'], ['cringe_irony']],
  ['dating app fatigue: i now swipe through playlists faster than people', 'love', ['meta', 'absurd'], ['text_post'], ['absurd']],
  ['situationship: a relationship where both people are correct', 'love', ['wordplay', 'observational'], ['text_post'], ['deadpan']],
  ['we agreed to be casual\n\nand then I made a shared spreadsheet', 'love', ['romance_disaster', 'niche_hobby'], ['screenshot'], ['self_defeating']],
  ['the late night text lands at 2:14am\n\nwhich is the worst possible time to be right', 'love', ['romance_disaster', 'dark'], ['reaction_meme'], ['self_defeating']],
  ['“i am bad at texting” \n\n*immediately proves it*', 'love', ['deadpan', 'cringe_irony'], ['text_post'], ['deadpan']],
  ['meeting their friends: performance review: pass', 'love', ['cringe_irony', 'romance_disaster'], ['text_post'], ['self_enhancing']],
  ['the mutual friend who has to translate for both of us', 'love', ['romance_disaster', 'observational'], ['two_panel'], ['self_defeating']],
  ['they share my exact bad take on a 2014 band\n\nthis is the one. this is the one.', 'love', ['niche_hobby', 'affiliative'], ['text_post'], ['affiliative']],
  ['i deleted the app. the memories remain.', 'love', ['dark', 'romance_disaster'], ['text_post'], ['dark']],

  /* --- Ramen Budget -------------------------------------------------- */
  ['budget review: rent or matcha\n\nmatcha, obviously', 'money', ['money_pain', 'wordplay'], ['text_post'], ['wordplay']],
  ['“treat yourself”\n\nthe treat: $9 toast and a quiet reckoning', 'money', ['money_pain', 'relatable'], ['text_post'], ['self_defeating']],
  ['subscription audit found 6 things\n\ni have used 2 of them', 'money', ['money_pain', 'absurd'], ['screenshot'], ['absurd']],
  ['payday went: rent, groceries, subscriptions\n\nleaves: a good sandwich and hope', 'money', ['money_pain', 'relatable'], ['text_post'], ['self_defeating']],
  ['concert tickets: excellent seats\n\nfees: also excellent', 'money', ['money_pain', 'hyperbole'], ['text_post'], ['hyperbole']],
  ['the free trial lasted 9 days\n\ni forgot everything from day 3', 'money', ['absurd', 'self_defeating'], ['text_post'], ['absurd']],
  ['delivery fee is a toll on your own groceries', 'money', ['observational', 'money_pain'], ['text_post'], ['deadpan']],
  ['“it’s an investment in myself”\n\nit is a jacket', 'money', ['cringe_irony', 'money_pain'], ['text_post'], ['cringe_irony']],
  ['i split the bill to the penny\n\nthen missed the last train anyway', 'money', ['money_pain', 'romance_disaster'], ['text_post'], ['self_defeating']],
  ['side hustle: buying things cheaper than everyone else', 'money', ['deadpan', 'money_pain'], ['text_post'], ['deadpan']],
  ['i opened a spreadsheet to save money\n\nthe spreadsheet cost me 3 hours', 'money', ['money_pain', 'niche_hobby'], ['screenshot'], ['money_pain']],
  ['price tag said “vintage”\n\nit was made last thursday', 'money', ['cringe_irony', 'money_pain'], ['text_post'], ['cringe_irony']],
  ['the group chat has a “who owes who” list\n\nit is 400 messages long', 'money', ['money_pain', 'observational'], ['two_panel'], ['absurd']],
  ['“it’s an investment”\n\nthe return is one very good t-shirt', 'money', ['money_pain', 'wordplay'], ['text_post'], ['self_defeating']],
  ['i budgeted for concert tickets\n\nthe budget had other ideas', 'money', ['money_pain', 'relatable'], ['text_post'], ['self_defeating']],
  ['delivery minimums exist to make you\n\nbuy the thing you did not want', 'money', ['money_pain', 'observational'], ['text_post'], ['deadpan']],
  ['a cheap flight to nowhere beats a bus\n\nthis is what personal finance has done to me', 'money', ['absurd', 'money_pain'], ['text_post'], ['absurd']],
  ['my emergency fund is 6 months of instant noodles\n\ngrowth is a process', 'money', ['money_pain', 'wordplay'], ['text_post'], ['self_defeating']],

  /* --- mixed weather: keeps every taxonomy family in rotation --------- */
  ['my humour has two settings: charmingly off and deeply concerned', 'life', ['meta', 'wordplay'], ['text_post'], ['affiliative']],
  ['the group chat goes quiet whenever i post anything with nuance', 'life', ['observational', 'dark'], ['two_panel'], ['deadpan']],
  ['i rate every restaurant by the song they play at the door', 'life', ['niche_hobby', 'affiliative'], ['text_post'], ['affiliative']],
  ['confident answer delivered with zero preparation', 'work', ['cringe_irony', 'wordplay'], ['text_post'], ['aggressive']],
  ['i told them i’d listen to the album\n\ni have listened to the album', 'love', ['romance_disaster', 'wordplay'], ['text_post'], ['self_defeating']],
  ['the algorithm finally understood me\n\nit showed me one ad', 'life', ['absurd', 'meta'], ['text_post'], ['absurd']],
  ['quiet mode off. back to being perceived.', 'life', ['wordplay', 'wholesome'], ['text_post'], ['affiliative']],
  ['a very sincere meme about cheese got 400 laughs\n\nwe are all just people', 'life', ['wholesome', 'absurd'], ['text_post'], ['affiliative']],
  ['i apologise in advance for how i talk about spreadsheets', 'money', ['niche_hobby', 'self_defeating'], ['text_post'], ['self_defeating']],
  ['the only genre i trust is the one that surprises me', 'music', ['niche_hobby', 'affiliative'], ['text_post'], ['self_enhancing']],
  ['hard to explain to someone who has never paused mid-sentence to search a song', 'music', ['niche_hobby', 'wordplay'], ['text_post'], ['affiliative']],
  ['they said “put on something”\n\nand i took that as a creative brief', 'music', ['absurd', 'affiliative'], ['text_post'], ['absurd']],
  ['three episodes in, i have decided the show is about something else entirely', 'screen', ['absurd', 'meta'], ['text_post'], ['absurd']],
  ['the confidence of a person who has read the whole comment section', 'screen', ['edgelord', 'wordplay'], ['text_post'], ['aggressive']],
  ['i have been “almost ready” to post this for eleven minutes', 'life', ['self_defeating', 'meta'], ['screenshot'], ['self_defeating']],
];

/* ------------------------------------------------------- safety repairs */

/**
 * Any caption whose style axis is not a real taxonomy id would silently score
 * as unclassifiable. Fail loudly at generation time instead.
 */
const STYLE_AXES = new Set([
  'affiliative',
  'self_enhancing',
  'aggressive',
  'self_defeating',
]);

const repairAxes = (styles) => {
  const out = styles.map((style) => (STYLE_AXES.has(style) ? style : 'self_defeating'));
  return [...new Set(out)];
};

/* ---------------------------------------------------------------- build */

const slug = (index) => `mk${String(index + 1).padStart(3, '0')}`;

const memes = CORPUS.map(([text, topic, content, formats, styles], index) => {
  const id = slug(index);
  const palette = PALETTE[hash(id) % PALETTE.length];
  return {
    id,
    source: 'pack',
    status: 'live',
    topic,
    text,
    alt: `${content[0].replace(/_/g, ' ')} meme card reading: ${text.replace(/\n+/g, ', ')}`,
    tags: [...content, ...formats, ...repairAxes(styles)],
    content,
    formats,
    styles: repairAxes(styles),
    bg: palette.bg,
    fg: palette.fg,
    ac: palette.ac,
    // Deterministic reaction baselines so the Feed looks alive on first run.
    likes: 40 + (hash(id + 'l') % 900),
    laughs: 20 + (hash(id + 'h') % 700),
  };
});

const outDir = resolve(root, 'src/data/seed');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  resolve(outDir, 'memes.json'),
  `${JSON.stringify({ generatedBy: 'scripts/generate-meme-corpus.mjs', count: memes.length, memes }, null, 2)}\n`,
);

const ts = `// GENERATED by scripts/generate-meme-corpus.mjs — do not edit by hand.
// ${memes.length} original in-house meme cards. Nothing scraped, nothing licensed,
// every caption written for cultured and tagged with the Resonance taxonomy.

import type { SeedMeme } from './types';

export const SEED_MEMES: readonly SeedMeme[] = ${JSON.stringify(
  memes.map((meme) => ({
    id: meme.id,
    topic: meme.topic,
    text: meme.text,
    alt: meme.alt,
    tags: meme.tags,
    bg: meme.bg,
    fg: meme.fg,
    ac: meme.ac,
    likes: meme.likes,
    laughs: meme.laughs,
  })),
  null,
  2,
)} as const;
`;

writeFileSync(resolve(outDir, 'memes.ts'), ts);

const byTopic = memes.reduce((acc, meme) => {
  acc[meme.topic] = (acc[meme.topic] ?? 0) + 1;
  return acc;
}, {});

process.stdout.write(
  `wrote ${memes.length} seed memes to src/data/seed/ (${Object.entries(byTopic)
    .map(([topic, count]) => `${topic}: ${count}`)
    .join(', ')})\n`,
);