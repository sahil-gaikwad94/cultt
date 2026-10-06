/**
 * The Meme Duel prompt set — the one content list shared by four places:
 * the arena sheet, the /d/:id recipient page, the Duel Card renderer and the
 * mock Repo's calibration seeding. Prompts are fixed A/B choices: no free
 * text anywhere in the duel, which is exactly why it can be public without
 * moderation (the brief's UGC gate stays closed).
 *
 * Every option carries taxonomy tags from src/lib/matching/taxonomy.ts, so a
 * completed duel is also a real taste signal — picks seed onboarding
 * calibration events rather than a cosmetic score.
 */

export interface DuelOptionSeed {
  text: string;
  /** Humor taxonomy ids; unknown ids are ignored by the engine, never fatal. */
  tags: readonly string[];
}

export interface DuelPromptSeed {
  id: string;
  emoji: string;
  q: string;
  options: { a: DuelOptionSeed; b: DuelOptionSeed };
}

export const DUEL_PROMPTS: readonly DuelPromptSeed[] = [
  {
    id: 'd1',
    emoji: '',
    q: 'The song everyone mocks. You still…',
    options: {
      a: { text: 'replay it in the dark, no witnesses', tags: ['relatable', 'self_defeating'] },
      b: { text: 'skip it twice a day, ritualistically', tags: ['observational', 'anti_humor'] },
    },
  },
  {
    id: 'd2',
    emoji: '🫥',
    q: 'A read receipt with no reply means…',
    options: {
      a: { text: 'a silence I curated on purpose', tags: ['meta', 'dark'] },
      b: { text: 'they fell asleep, the audacity of being well-adjusted', tags: ['wholesome', 'wordplay'] },
    },
  },
  {
    id: 'd3',
    emoji: '💸',
    q: 'The $11 service fee on a $40 ticket is…',
    options: {
      a: { text: 'emotionally, a second ticket', tags: ['hyperbole', 'money_pain'] },
      b: { text: 'paid without complaint, every single time', tags: ['self_defeating', 'relatable'] },
    },
  },
  {
    id: 'd4',
    emoji: '🌃',
    q: 'The group chat at 2am is…',
    options: {
      a: { text: 'feral but supportive', tags: ['pet_energy', 'wholesome', 'affiliative'] },
      b: { text: 'dead but still replying', tags: ['observational', 'relatable'] },
    },
  },
  {
    id: 'd5',
    emoji: '💿',
    q: 'The playlist for the person you will never send it to…',
    options: {
      a: { text: 'sequenced like a museum exhibit', tags: ['romance_disaster', 'meta'] },
      b: { text: 'deleted 48 hours later, out of spite', tags: ['absurd', 'dark'] },
    },
  },
];

/** Verdict copy, ordered from a full match down to a total disagreement. */
export const duelVerdict = (score: number, of: number): { line: string; emoji: string } => {
  const pct = of > 0 ? score / of : 0;
  if (pct >= 1) return { line: 'Same damage. Suspiciously aligned.', emoji: '🔥' };
  if (pct >= 0.8) return { line: 'Mostly same damage. Concerning.', emoji: '🔥' };
  if (pct >= 0.6) return { line: 'Adjacent chaos. Respectable.', emoji: '😏' };
  if (pct >= 0.4) return { line: 'Different damage. Send a meme anyway.', emoji: '🙂' };
  if (pct > 0) return { line: 'Different damage. Opposites attract?', emoji: '😅' };
  return { line: 'Different damage. A whole cultural gap to explore.', emoji: '🙈' };
};
