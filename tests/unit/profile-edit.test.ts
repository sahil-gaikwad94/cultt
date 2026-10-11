/**
 * Profile customisation rules.
 *
 * The bug this exists to prevent: the humor picker used to accept any number of
 * chips while the profile rendered `pr.humor.slice(0, 3)`. A fourth chip lit up,
 * saved, and never appeared. The cap now lives here and refuses with a reason.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_HUMOR,
  MAX_PHOTOS,
  MAX_PROMPTS,
  PROMPT_BANK,
  addPrompt,
  answerPrompt,
  availablePrompts,
  completeness,
  makeLeadPhoto,
  normalizePrompt,
  removePrompt,
  toggleHumor,
  type ProfileEdit,
} from '../../src/screens/profile';

const edit = (over: Partial<ProfileEdit> = {}): ProfileEdit => ({
  pronouns: '',
  humor: [],
  prompts: [],
  photos: [],
  name: 'Alex',
  bio: '',
  artists: [],
  hasPhoto: false,
  ...over,
});

describe('toggleHumor', () => {
  it('adds and removes', () => {
    const added = toggleHumor([], 'Deadpan');
    expect(added).toEqual({ ok: true, next: ['Deadpan'] });
    expect(toggleHumor(['Deadpan'], 'Deadpan')).toEqual({ ok: true, next: [] });
  });

  it('refuses the fourth signal with a reason instead of dropping it', () => {
    const full = ['Deadpan', 'Absurdist', 'Dry wit'];
    const result = toggleHumor(full, 'Chaotic');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('limit');
    expect(result.next).toEqual(full);
  });

  it('still lets you swap once you are at the cap', () => {
    const full = ['Deadpan', 'Absurdist', 'Dry wit'];
    const cleared = toggleHumor(full, 'Dry wit');
    expect(cleared.ok).toBe(true);
    const next = cleared.ok ? cleared.next : [];
    expect(toggleHumor(next, 'Chaotic')).toEqual({ ok: true, next: ['Deadpan', 'Absurdist', 'Chaotic'] });
  });

  it('does not mutate the array it was given', () => {
    const humor = ['Deadpan'];
    toggleHumor(humor, 'Absurdist');
    expect(humor).toEqual(['Deadpan']);
  });

  it('caps at exactly what the profile renders', () => {
    expect(MAX_HUMOR).toBe(3);
  });
});

describe('prompts', () => {
  it('offers every bank question, with unique ids', () => {
    const ids = PROMPT_BANK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROMPT_BANK.length).toBeGreaterThan(MAX_PROMPTS);
  });

  it('never offers a question that is already on the profile', () => {
    const withOne = edit({ prompts: [addPrompt([], PROMPT_BANK[0].id).next[0]] });
    expect(withOne.prompts).toHaveLength(1);
    expect(availablePrompts(withOne).map((p) => p.id)).not.toContain(PROMPT_BANK[0].id);
  });

  it('refuses a duplicate and an unknown id', () => {
    const first = addPrompt([], PROMPT_BANK[0].id);
    expect(first.ok).toBe(true);
    const again = addPrompt(first.ok ? first.next : [], PROMPT_BANK[0].id);
    expect(again.ok).toBe(false);
    expect(addPrompt([], 'no-such-prompt').ok).toBe(false);
  });

  it('stops at the maximum and says why', () => {
    let prompts = addPrompt([], PROMPT_BANK[0].id).next;
    prompts = addPrompt(prompts, PROMPT_BANK[1].id).next;
    prompts = addPrompt(prompts, PROMPT_BANK[2].id).next;
    expect(prompts).toHaveLength(MAX_PROMPTS);
    const over = addPrompt(prompts, PROMPT_BANK[3].id);
    expect(over.ok).toBe(false);
    if (over.ok) throw new Error('unreachable');
    expect(over.next).toHaveLength(MAX_PROMPTS);
  });

  it('adds a prompt with an empty answer, not a prefilled one', () => {
    const added = addPrompt([], PROMPT_BANK[4].id);
    expect(added.ok).toBe(true);
    expect(added.ok && added.next[0].answer).toBe('');
  });

  it('removes by id and answers by id without touching the others', () => {
    let prompts = addPrompt([], PROMPT_BANK[0].id).next;
    prompts = addPrompt(prompts, PROMPT_BANK[1].id).next;
    prompts = answerPrompt(prompts, PROMPT_BANK[1].id, 'A real answer');
    expect(prompts.map((p) => p.answer)).toEqual(['', 'A real answer']);
    expect(removePrompt(prompts, PROMPT_BANK[0].id)).toHaveLength(1);
    expect(removePrompt(prompts, 'not-there')).toHaveLength(2);
  });

  it('reads the legacy {q,a} shape and derives a stable id', () => {
    const legacy = normalizePrompt({ q: PROMPT_BANK[0].question, a: 'Cherry Static' });
    expect(legacy.id).toBe(PROMPT_BANK[0].id);
    expect(legacy.question).toBe(PROMPT_BANK[0].question);
    expect(legacy.answer).toBe('Cherry Static');
  });

  it('keeps a question that is not in the bank, with a derived id', () => {
    const custom = normalizePrompt({ q: 'Something nobody else wrote', a: '' });
    expect(custom.id).toBe('custom-something-nobody-else-wr');
    expect(custom.question).toBe('Something nobody else wrote');
    const again = normalizePrompt({ q: 'Something nobody else wrote', a: '' });
    expect(again.id).toBe(custom.id);
  });
});

describe('makeLeadPhoto', () => {
  const photos = ['a', 'b', 'c'];

  it('moves the chosen photo to the front', () => {
    expect(makeLeadPhoto(photos, 2)).toEqual(['c', 'a', 'b']);
    expect(makeLeadPhoto(photos, 1)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the order alone for index 0 and for out-of-range indexes', () => {
    expect(makeLeadPhoto(photos, 0)).toEqual(photos);
    expect(makeLeadPhoto(photos, 9)).toEqual(photos);
    expect(makeLeadPhoto(photos, -1)).toEqual(photos);
  });

  it('never loses or duplicates a photo', () => {
    expect([...makeLeadPhoto(photos, 2)].sort()).toEqual([...photos].sort());
  });

  it('does not mutate', () => {
    makeLeadPhoto(photos, 2);
    expect(photos).toEqual(['a', 'b', 'c']);
  });

  it('matches the cap the view enforces', () => {
    expect(MAX_PHOTOS).toBe(9);
  });
});

describe('completeness', () => {
  it('is zero for an empty profile and 100 for a full one', () => {
    expect(completeness(edit({ name: '', bio: '', prompts: [], photos: [] })).score).toBe(0);
    const full = edit({
      name: 'Alex',
      bio: 'Collects songs that sound like 4pm in October.',
      hasPhoto: true,
      pronouns: 'they/them',
      humor: ['Deadpan'],
      artists: ['Odessa Vale'],
      prompts: [{ id: 'song-defend', question: 'The song I’ll defend forever', answer: 'Cherry Static' }],
      photos: ['a', 'b'],
    });
    expect(completeness(full).score).toBe(100);
    expect(completeness(full).missing).toEqual([]);
  });

  it('weights the answers, not just the fields', () => {
    /* An empty prompt answer is not the same as an answered one, and a bio that
       is three characters is not a bio. */
    const stubbed = edit({
      bio: 'hi',
      hasPhoto: true,
      pronouns: 'she/her',
      humor: ['Deadpan'],
      artists: ['Odessa Vale'],
      prompts: [{ id: 'song-defend', question: 'q', answer: '' }],
      photos: ['a', 'b'],
    });
    expect(completeness(stubbed).score).toBeLessThan(100);
    expect(completeness(stubbed).missing).toEqual(expect.arrayContaining(['Answer a prompt']));
  });

  it('names what is missing, in order', () => {
    const missing = completeness(edit()).missing;
    expect(missing[0]).toBe('Write a bio longer than a fragment');
    expect(missing).toContain('Add a profile photo');
  });

  it('is never above 100 or below 0', () => {
    for (const over of [
      {},
      { humor: ['a', 'b', 'c'] },
      { photos: ['a', 'b', 'c', 'd', 'e'] },
      { name: 'x', bio: 'a sufficiently long bio here', pronouns: 'he/him' },
    ]) {
      const score = completeness(edit(over)).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
