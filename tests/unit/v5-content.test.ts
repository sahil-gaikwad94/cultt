/**
 * The content pipelines. The committed manifests are the contract: a fresh
 * clone must build with one command and the app must never serve a meme whose
 * rights are not cleared (brief: build gate, §0.3).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateBank } from '../../scripts/build-nhie';
import { ROUND_SIZE, cardText, pickRound, roundCount, spiceLabel } from '../../src/content/nhie';
import { MEME_CATEGORY_SLUGS, HUMOR_AXES } from '../../src/copy/taxonomy';
import { contentStats, memes, nhie, servableMemes, songs } from '../../src/content';
import { memeArt } from '../../src/v5/deck';

const rawBank = () => JSON.parse(readFileSync(resolve(__dirname, '../../v5Direction/nhie_questions.json'), 'utf8'));

describe('validateBank', () => {
  it('accepts the shipped 100-question bank', () => {
    const bank = validateBank(rawBank());
    expect(bank.questions).toHaveLength(100);
    expect(bank.categories).toHaveLength(10);
    expect(bank.prefix).toBe('Never have I ever');
    expect(bank.rounds).toBe(Math.floor(100 / ROUND_SIZE));
    expect(roundCount(bank)).toBe(bank.rounds);
  });

  it('rejects a duplicate id', () => {
    const raw = rawBank();
    raw.questions[1].id = raw.questions[0].id;
    expect(() => validateBank(raw)).toThrow(/duplicate id/);
  });

  it('rejects empty question text', () => {
    const raw = rawBank();
    raw.questions[3].text = '   ';
    expect(() => validateBank(raw)).toThrow(/empty text/);
  });

  it('rejects an unknown category, axis and spice level', () => {
    const badCategory = rawBank();
    badCategory.questions[0].category = 'nope';
    expect(() => validateBank(badCategory)).toThrow(/unknown category/);

    const badAxis = rawBank();
    badAxis.questions[0].axis = 'slapstick';
    expect(() => validateBank(badAxis)).toThrow(/unknown axis/);

    const badSpice = rawBank();
    badSpice.questions[0].spice = 9;
    expect(() => validateBank(badSpice)).toThrow(/unknown spice/);
  });

  it('refuses a bank too small for even one round', () => {
    const raw = rawBank();
    raw.questions = raw.questions.slice(0, ROUND_SIZE - 1);
    expect(() => validateBank(raw)).toThrow(/needs at least 12 questions/);
  });
});

describe('pickRound', () => {
  const bank = validateBank(rawBank());

  it('deals exactly ROUND_SIZE cards with no repeats', () => {
    const { questions, bankExhausted } = pickRound(bank, { seed: 1 });
    expect(questions).toHaveLength(ROUND_SIZE);
    expect(new Set(questions.map((q) => q.id)).size).toBe(ROUND_SIZE);
    expect(bankExhausted).toBe(false);
  });

  it('deals the same twelve for the same seed, so friend-mode links match', () => {
    const a = pickRound(bank, { seed: 4242 }).questions.map((q) => q.id);
    const b = pickRound(bank, { seed: 4242 }).questions.map((q) => q.id);
    const c = pickRound(bank, { seed: 99 }).questions.map((q) => q.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('honours the category and spice filters', () => {
    const categories = [bank.categories[0]!.slug];
    const { questions } = pickRound(bank, { seed: 3, categories });
    expect(questions.every((q) => categories.includes(q.category))).toBe(true);

    const mild = pickRound(bank, { seed: 3, maxSpice: 1 });
    expect(mild.questions.every((q) => q.spice <= 1)).toBe(true);
  });

  it('skips anything already asked and restarts the pool when it runs dry', () => {
    const first = pickRound(bank, { seed: 5 }).questions.map((q) => q.id);
    const second = pickRound(bank, { seed: 5, asked: first });
    expect(second.bankExhausted).toBe(false);
    expect(second.questions.map((q) => q.id).some((id) => first.includes(id))).toBe(false);

    // Everything asked but twelve: still a full round, no repeats inside it.
    const allButTwelve = bank.questions.slice(0, bank.questions.length - ROUND_SIZE).map((q) => q.id);
    const last = pickRound(bank, { seed: 5, asked: allButTwelve });
    expect(last.questions).toHaveLength(ROUND_SIZE);
    expect(new Set(last.questions.map((q) => q.id)).size).toBe(ROUND_SIZE);

    // Everything asked: the pool restarts and says so.
    const exhausted = pickRound(bank, { seed: 5, asked: bank.questions.map((q) => q.id) });
    expect(exhausted.bankExhausted).toBe(true);
    expect(exhausted.questions).toHaveLength(ROUND_SIZE);
  });

  it('names the spice level from the bank legend', () => {
    const question = bank.questions.find((q) => q.spice === 2)!;
    expect(spiceLabel(question, bank)).toBe(bank.spiceLegend['2']);
    expect(spiceLabel({ ...question, spice: 99 }, bank)).toBe('');
  });

  it('prefixes card text without doubling the ellipsis', () => {
    const question = bank.questions[0]!;
    expect(cardText(question, bank)).toBe(`Never have I ever${question.text}`);
    expect(cardText({ ...question, text: 'gone full send' }, bank)).toBe('Never have I ever… gone full send');
  });
});

describe('the committed manifests', () => {
  it('ship the counts the pipelines reported', () => {
    expect(contentStats()).toEqual({
      memes: memes.count,
      songs: songs.count,
      resolvedSongs: songs.resolvedCount,
      nhie: 100,
      nhieRounds: 8,
      genres: songs.genres.length,
      categories: memes.categories.length,
    });
    expect(memes.items).toHaveLength(memes.count);
    expect(songs.items).toHaveLength(songs.count);
    expect(nhie.questions).toHaveLength(contentStats().nhie);
  });

  it('validate every meme against the taxonomy', () => {
    for (const meme of memes.items) {
      expect(MEME_CATEGORY_SLUGS).toContain(meme.category);
      expect(HUMOR_AXES).toContain(meme.axis);
      expect(meme.id).toMatch(/^meme-[0-9a-f]{12}$/);
      expect(meme.alt.length).toBeGreaterThan(8);
      // §11: the placard doubles as the alt text.
      expect(meme.alt).toBe(`${meme.title}. ${meme.placard}`);
      expect(meme.width).toBeGreaterThan(0);
      expect(meme.bytes).toBeGreaterThan(0);
      // Variants are only emitted at widths the source can actually fill — a
      // 236 px source gets no 480/960/1440 renditions rather than an upscale.
      for (const variant of meme.variants) {
        expect(variant.width).toBeLessThanOrEqual(meme.width);
        expect(variant.avif).toMatch(/\.avif$/);
        expect(variant.webp).toMatch(/\.webp$/);
      }
    }
    // 19 of the 20 seed memes have renditions; the one 236 px source does not.
    expect(memes.items.filter((meme) => meme.variants.length > 0).length).toBe(memes.count - 1);
  });

  it('always produce renderable art, with or without renditions', () => {
    for (const meme of memes.items) {
      const art = memeArt(meme);
      expect(art.src).toMatch(/\.(avif|webp)$/);
      expect(art.alt).toBe(meme.alt);
      if (meme.variants.length === 0) expect(art.srcset).toBe(null);
      else expect(art.srcset).toContain(`${meme.variants[0]!.avif} ${meme.variants[0]!.width}w`);
    }
  });

  it('gate: the seed memes are rights-cleared and servable', () => {
    // Every shipped meme is rightsCleared: true (cleared in memes.meta.json),
    // so the default path serves the full set and the production build passes
    // `content:gate` without the ALLOW_UNLICENSED override.
    expect(memes.items.every((meme) => meme.rightsCleared === true)).toBe(true);
    expect(servableMemes()).toHaveLength(memes.count);
    expect(servableMemes(true)).toHaveLength(memes.count);
  });

  it('never fabricate a preview URL for an unresolved track', () => {
    for (const song of songs.items) {
      if (!song.resolved) {
        expect(song.previewUrl).toBe(null);
        expect(song.trackId).toBe(null);
      }
    }
  });
});
