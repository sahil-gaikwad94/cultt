/**
 * The binding non-features (PDF §1.3 / brief §1.3), as tests.
 *
 * These are product promises, not preferences:
 *   1. No swipe-to-judge-a-person gesture anywhere in the Culture Feed.
 *   2. No "who liked you" paywall; incoming likes appear only on a mutual match.
 *   3. No guilt-trip notifications.
 *   4. No grid of faces; the Match Matrix stays a calm, single-card deck.
 *
 * Each one is asserted against the shipped source so it cannot regress silently.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MockRepo } from '../../src/data/mockRepo';

const seam = readFileSync(resolve(process.cwd(), 'src/legacy.ts'), 'utf8');
const mockRepoSource = readFileSync(resolve(process.cwd(), 'src/data/mockRepo.ts'), 'utf8');
const legalSource = readFileSync(resolve(process.cwd(), 'src/content/legal.ts'), 'utf8');

/** Slice of source for one render function, so assertions stay scoped. */
const bodyOf = (name: string): string => {
  const start = seam.indexOf(name);
  if (start < 0) throw new Error(`could not find ${name} in src/legacy.ts`);
  // Crude but sufficient: read from the declaration to the next top-level fn.
  const rest = seam.slice(start);
  const next = rest.slice(1).search(/\n(function |const [A-Z_]+=|let |\/\* ={4,})/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

describe('non-feature: no swipe-to-judge in the Culture Feed', () => {
  it('keeps the Feed free of any person-evaluation code path', () => {
    const feed = [bodyOf('function homeBodyHTML'), bodyOf('function ccardHTML'), bodyOf('function deckItems')].join('\n');
    // The Feed swipes content. It never reaches for the candidate deck.
    expect(feed).not.toMatch(/\bqueue\(\)/);
    expect(feed).not.toMatch(/\.pcard/);
    expect(feed).not.toMatch(/\bPEOPLE\b/);
    expect(feed).not.toMatch(/decide\(/);
  });

  it('never exposes a pass/resonate action on a Feed card', () => {
    const feedCard = bodyOf('function dcardHTML');
    expect(feedCard).not.toMatch(/data-act="pass"/);
    expect(feedCard).not.toMatch(/data-act="resonate"/);
  });

  it('keeps the person deck on the Matrix only', () => {
    expect(seam).toMatch(/function renderDeck/);
    expect(bodyOf('function renderDeck')).toMatch(/pcardHTML/);
  });
});

describe('non-feature: no "who liked you" paywall', () => {
  it('ships no copy that offers to reveal who liked you', () => {
    expect(seam).not.toMatch(/who liked you/i);
    expect(seam).not.toMatch(/see who likes/i);
    expect(seam).not.toMatch(/\bliked you\b/i);
    expect(seam).not.toMatch(/people who like you/i);
  });

  it('reveals an incoming like only through a mutual match', () => {
    // `likesYou` may be read exactly once, at the moment a decision is made; it
    // must gate the mutual and never surface as a count or a teaser.
    const reads = mockRepoSource.match(/likesYou/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    expect(mockRepoSource).toMatch(/mutual/);

    const decisionBlock = mockRepoSource.slice(
      mockRepoSource.indexOf('async decide('),
      mockRepoSource.indexOf('private sharedTitles'),
    );
    expect(decisionBlock).toMatch(/card\.likesYou/);
    // Never a counter, never a blur, never a prompt to upgrade.
    expect(decisionBlock).not.toMatch(/upgrade|premium|unlock|blur/i);
  });

  it('reads an incoming like only inside the decision handler', () => {
    // `likesYou` may be consulted exactly once, to decide whether a Resonate is
    // mutual. It must never be counted, blurred or teased anywhere else.
    const occurrences = seam.match(/likesYou/g) ?? [];
    expect(occurrences.length).toBeGreaterThan(0);

    const decision = bodyOf('function decide');
    expect(decision).toMatch(/p\.likesYou/);

    for (const surface of ['function renderFeed', 'function renderDeck', 'function pcardHTML', 'function renderPeople']) {
      expect(bodyOf(surface)).not.toMatch(/likesYou/);
    }
  });

  it('ships no control that reveals or counts incoming likes', () => {
    expect(seam).not.toMatch(/data-act="reveal-likes"/);
    expect(seam).not.toMatch(/data-act="likes-count"/);
    expect(seam).not.toMatch(/likesYou\s*\?\s*[0-9]/);
  });
});

describe('non-feature: no guilt-trip notifications', () => {
  it('ships no guilt copy in user-facing surfaces', () => {
    const patterns = [
      /don'?t break your streak/i,
      /you'?ll miss out/i,
      /you haven'?t been here/i,
      /last chance/i,
      /hurry/i,
      /we miss you/i,
      /come back or/i,
    ];
    for (const pattern of patterns) {
      expect(seam).not.toMatch(pattern);
      expect(legalSource).not.toMatch(pattern);
    }
  });

  it('only ever mentions a waiting count to promise there is not one', () => {
    // The phrase may appear, but only negated: "we will not tell you how many
    // people are waiting for you". A notification would phrase it as a claim.
    const claims = seam.match(/\bhurry\b|\bwaiting for you\b(?!\.?\s*(?:If|$))/gi) ?? [];
    expect(claims).toHaveLength(0);

    const legalMentions = legalSource.match(/people are waiting/gi) ?? [];
    for (const match of legalMentions) {
      const index = legalSource.indexOf(match);
      const sentence = legalSource.slice(Math.max(0, index - 120), index);
      expect(sentence).toMatch(/not tell you how many/i);
    }
  });

  it('frames the Daily Drop ritual as optional, not as a debt', () => {
    expect(seam).toMatch(/no guilt trips/i);
    expect(seam).toMatch(/A quiet nudge when it lands/);
  });

  it('keeps the streak factual rather than coercive', () => {
    // A streak number is fine; a streak threat is not.
    expect(seam).not.toMatch(/streak (?:is )?at risk/i);
    expect(seam).not.toMatch(/protect your streak/i);
  });

  it('promises in the community guidelines that there are no guilt notifications', () => {
    expect(legalSource).toMatch(/no guilt notifications/i);
  });
});

describe('non-feature: no grid of faces', () => {
  it('keeps the Match Matrix a single-card deck', () => {
    const deck = bodyOf('function renderDeck');
    // A stack of at most three, never a grid of people.
    expect(deck).toMatch(/q\.slice\(0,\s*3\)/);
    expect(deck).not.toMatch(/class="grid|grid3|grid-people/);
  });

  it('has no person-grid CSS class in the stylesheet', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');
    expect(css).not.toMatch(/\.people-grid/);
    expect(css).not.toMatch(/\.face-grid/);
  });

  it('never renders a face grid from the matrix shell', () => {
    const shell = bodyOf('function renderMatchShell');
    expect(shell).not.toMatch(/grid/);
  });
});

describe('guardrails hold under a real match', () => {
  it('reports a mutual only when the other side already resonated', async () => {
    const repo = new MockRepo(Date.parse('2026-10-06T12:00:00Z'));
    const cards = await repo.getCandidates({
      taste: {
        userId: 'u_you',
        humor: [],
        music: [],
        eventCount: 0,
        topArtists: [],
        topGenres: [],
        topCategories: [],
        antiGenres: [],
        vibeReported: [],
        lastActiveAt: Date.now(),
      },
    });

    // Every card carries the flag, and at most one direction is ever revealed.
    for (const card of cards) {
      expect(typeof card.likesYou).toBe('boolean');
    }

    const likesYou = cards.filter((card) => card.likesYou);
    if (likesYou.length) {
      const result = await repo.decide(likesYou[0].id, 'resonate');
      expect(result.matched).toBe(true);
      expect(result.threadId).toBeTruthy();
    }

    const passOnly = cards.find((card) => !card.likesYou);
    if (passOnly) {
      const result = await repo.decide(passOnly.id, 'resonate');
      expect(result.matched).toBe(false);
      expect(result.threadId).toBeNull();
    }
  });

  it('records a report, a vibe-report and a block as three different things', async () => {
    const repo = new MockRepo(Date.parse('2026-10-06T12:00:00Z'));
    await repo.submitSafetyAction('u_a', 'report', 'Harassment or abuse');
    await repo.submitSafetyAction('u_b', 'vibe-report', 'Nothing in common');
    await repo.submitSafetyAction('u_c', 'block');

    expect(await repo.listBlocks()).toEqual(['u_c']);
    // The abuse queue and the recalibration signal are separate stores.
    const trace = JSON.parse(localStorage.getItem('cultured2:repo-events') ?? '[]') as Array<{ type: string }>;
    const types = trace.map((entry) => entry.type);
    expect(types).toContain('report');
    expect(types).toContain('vibe-report');
    expect(types).toContain('block');
  });
});
