/**
 * Profile customisation: the rules, kept out of the view.
 *
 * The You screen already let you change a lot — name, bio, tint, wall art,
 * photo, humor signals, artists, photos. What it did not let you do was pick
 * your own prompt questions, and it had a bug hiding in plain sight: the humor
 * picker accepted as many chips as you tapped, while the profile only ever
 * rendered `pr.humor.slice(0, 3)`. A fourth chip lit up and then went nowhere.
 *
 * So this module owns the limits and says them out loud. Everything here is
 * pure and returns new state rather than mutating, so the seam can persist the
 * result and the rules can be tested without a DOM.
 */

export interface Prompt {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface ProfileEdit {
  readonly pronouns: string;
  readonly humor: readonly string[];
  readonly prompts: readonly Prompt[];
  readonly photos: readonly string[];
  readonly name: string;
  readonly bio: string;
  readonly artists: readonly string[];
  readonly hasPhoto: boolean;
}

/** Shown on the profile. Selecting more is refused, not silently dropped. */
export const MAX_HUMOR = 3;
export const MAX_PROMPTS = 3;
export const MAX_PHOTOS = 9;

export const PROMPT_BANK: readonly { id: string; question: string }[] = [
  { id: 'song-defend', question: 'The song I’ll defend forever' },
  { id: 'niche-ref', question: 'My most niche reference' },
  { id: 'hill', question: 'A hill I will genuinely die on' },
  { id: 'worst-date', question: 'The worst date idea, respectfully' },
  { id: 'good-at', question: 'Something I’m unreasonably good at' },
  { id: 'roman-empire', question: 'The thing I think about weekly' },
  { id: 'group-role', question: 'My role in the group chat' },
  { id: 'meal', question: 'A meal worth crossing town for' },
  { id: 'two-truths', question: 'Two truths and a lie about me' },
  { id: 'unserious', question: 'The most unserious thing I own' },
  { id: 'free-tuesday', question: 'What I’d do with a free Tuesday' },
  { id: 'karaoke', question: 'My karaoke fallback' },
  { id: 'rewatch', question: 'A film I’ve seen too many times' },
  { id: 'trouble', question: 'The opinion that gets me in trouble' },
  { id: 'loud-laugh', question: 'The last thing that made me laugh out loud' },
  { id: 'trade-skill', question: 'A useful skill I’d trade for a useless one' },
  { id: 'good-night', question: 'What a good night actually looks like' },
  { id: 'red-flag', question: 'My own red flag, disclosed voluntarily' },
];

/** Questions not already on the profile, so the picker never offers a dupe. */
export const availablePrompts = (state: ProfileEdit): { id: string; question: string }[] => {
  const used = new Set(state.prompts.map((p) => p.id));
  return PROMPT_BANK.filter((p) => !used.has(p.id));
};

/** Legacy state stored `{q, a}` with no id; derive one from the question. */
export const normalizePrompt = (raw: { id?: string; q?: string; question?: string; a?: string; answer?: string }): Prompt => {
  const question = raw.question ?? raw.q ?? '';
  const found = PROMPT_BANK.find((p) => p.question === question);
  return {
    id: raw.id ?? found?.id ?? `custom-${question.slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    question,
    answer: raw.answer ?? raw.a ?? '',
  };
};

export type ToggleResult<T> = { ok: true; next: T } | { ok: false; reason: string; next: T };

/**
 * Adds or removes a humor signal. The cap is enforced here, once, instead of
 * being implied by a `slice` in the view — refusing with a reason is the whole
 * point, because the old behaviour let a chip light up and then vanish.
 */
export const toggleHumor = (humor: readonly string[], value: string): ToggleResult<string[]> => {
  const at = humor.indexOf(value);
  if (at > -1) return { ok: true, next: humor.filter((h) => h !== value) };
  if (humor.length >= MAX_HUMOR) {
    return {
      ok: false,
      reason: `Three is the limit — drop one first.`,
      next: [...humor],
    };
  }
  return { ok: true, next: [...humor, value] };
};

export const addPrompt = (prompts: readonly Prompt[], id: string): ToggleResult<Prompt[]> => {
  const bank = PROMPT_BANK.find((p) => p.id === id);
  if (!bank) return { ok: false, reason: 'That prompt does not exist', next: [...prompts] };
  if (prompts.some((p) => p.id === id)) return { ok: false, reason: 'Already on your profile', next: [...prompts] };
  if (prompts.length >= MAX_PROMPTS) {
    return { ok: false, reason: `Three prompts is the most anyone reads`, next: [...prompts] };
  }
  return { ok: true, next: [...prompts, { ...bank, answer: '' }] };
};

export const removePrompt = (prompts: readonly Prompt[], id: string): Prompt[] =>
  prompts.filter((p) => p.id !== id);

export const answerPrompt = (prompts: readonly Prompt[], id: string, answer: string): Prompt[] =>
  prompts.map((p) => (p.id === id ? { ...p, answer } : p));

/** Moves a photo to the front. The lead photo is the one anyone sees first. */
export const makeLeadPhoto = (photos: readonly string[], index: number): string[] => {
  if (index <= 0 || index >= photos.length) return [...photos];
  const next = [...photos];
  const [picked] = next.splice(index, 1);
  return [picked as string, ...next];
};

export interface Completeness {
  /** 0–100, integer. */
  readonly score: number;
  /** What is still missing, in the order it is worth doing. */
  readonly missing: readonly string[];
}

/**
 * How finished the profile is. Deliberately not a personality score and not
 * shown as one — it measures the fields, and the copy in the view says so.
 */
export const completeness = (state: ProfileEdit): Completeness => {
  const checks: readonly { weight: number; done: boolean; label: string }[] = [
    { weight: 10, done: state.name.trim().length > 0, label: 'Add a name' },
    { weight: 15, done: state.bio.trim().length >= 12, label: 'Write a bio longer than a fragment' },
    { weight: 10, done: state.hasPhoto, label: 'Add a profile photo' },
    { weight: 10, done: state.pronouns.trim().length > 0, label: 'Add your pronouns' },
    { weight: 15, done: state.humor.length >= 1, label: 'Pick a humor signal' },
    { weight: 10, done: state.artists.length >= 1, label: 'Add an artist' },
    { weight: 20, done: state.prompts.some((p) => p.answer.trim().length >= 8), label: 'Answer a prompt' },
    { weight: 10, done: state.photos.length >= 2, label: 'Add a second photo' },
  ];
  const score = checks.reduce((total, check) => total + (check.done ? check.weight : 0), 0);
  return { score, missing: checks.filter((check) => !check.done).map((check) => check.label) };
};
