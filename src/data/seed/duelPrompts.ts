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
    emoji: '🚪',
    q: 'What the club door says at 1am',
    options: {
      a: { text: '“you shall not pass until 2am”', tags: ['wordplay', 'hyperbole'] },
      b: { text: 'capacity is a suggestion', tags: ['relatable', 'anti_humor'] },
    },
  },
  {
    id: 'd2',
    emoji: '🎧',
    q: 'Your 3am playlist is…',
    options: {
      a: { text: 'a love letter with no recipient', tags: ['romance_disaster', 'meta', 'wholesome'] },
      b: { text: 'a war crime against genres', tags: ['absurd', 'hyperbole', 'aggressive'] },
    },
  },
  {
    id: 'd3',
    emoji: '🫠',
    q: 'Group chat energy tonight',
    options: {
      a: { text: 'feral but supportive', tags: ['pet_energy', 'wholesome', 'affiliative'] },
      b: { text: 'dead but still replying', tags: ['observational', 'relatable', 'self_defeating'] },
    },
  },
  {
    id: 'd4',
    emoji: '💸',
    q: 'The fee that hurts the most',
    options: {
      a: { text: 'concert ticket service fees', tags: ['money_pain', 'dark', 'observational'] },
      b: { text: 'the delivery tip', tags: ['money_pain', 'relatable', 'wholesome'] },
    },
  },
  {
    id: 'd5',
    emoji: '🐈',
    q: '2026 so far, in one image',
    options: {
      a: { text: 'a cat sitting calmly in chaos', tags: ['pet_energy', 'wholesome', 'relatable'] },
      b: { text: 'a cat knocking a glass off the table', tags: ['absurd', 'pet_energy', 'dark'] },
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
