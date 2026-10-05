import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  AXIS_BLOCK_WEIGHT,
  calibrationConfidence,
  diversify,
  emptyFingerprint,
  eventFor,
  HUMOR_CONTENT,
  HUMOR_DIMS,
  HUMOR_STYLE_AXES,
  HUMOR_STYLES,
  isCalibrating,
  memeStyleVector,
  MUSIC_DIMS,
  pacingDecision,
  rankCandidates,
  replayEvents,
  tasteEmbeddings,
  tasteTwins,
  whyYouMatch,
  type Candidate,
  type TasteProfile,
} from '../../src/lib/matching';
import { cosine, magnitude as magnitudeOf, normalize } from '../../src/lib/matching/vector';
import { humorAxes } from '../../src/lib/matching/embed';
import { buildPopulation } from '../../src/data/population';

const NOW = 1_700_000_000_000;

/* ----------------------------------------------------------------- helpers */

const profile = (over: Partial<TasteProfile> = {}): TasteProfile => ({
  userId: 'u_test',
  humor: [],
  music: [],
  eventCount: 60,
  topArtists: [],
  topGenres: [],
  topCategories: [],
  antiGenres: [],
  vibeReported: [],
  lastActiveAt: NOW,
  ...over,
});

interface TasteSpec {
  content: string[];
  genres: string[];
  artists: string[];
  styles?: Record<string, number>;
}

/** Builds a profile straight from taxonomy tags, the way onboarding does. */
const tagged = (userId: string, taste: TasteSpec, eventCount = 60): TasteProfile => {
  const vectors = tasteEmbeddings({
    humor: {
      content: taste.content,
      formats: ['text_post'],
      styles: taste.styles ?? { affiliative: 0.4, self_enhancing: 0.3, aggressive: 0.1, self_defeating: 0.2 },
    },
    music: { genres: taste.genres, artists: taste.artists },
  });
  return profile({
    userId,
    humor: vectors.humor,
    music: vectors.music,
    eventCount,
    topArtists: taste.artists,
    topGenres: taste.genres,
    topCategories: taste.content,
  });
};

/**
 * The fixture set the brief asks for: a viewer, someone clearly similar, someone
 * partly similar, and someone clearly different. If these do not order the way
 * the assertions below require, the engine is not doing its job.
 */
const VIEWER = tagged('u_fast', {
  content: ['deadpan', 'relatable', 'observational', 'wordplay'],
  genres: ['indie_rock', 'dream_pop', 'ambient'],
  artists: ['Odessa Vale', 'Halcyon Mile', 'Imre Tanaka'],
});

const SIMILAR = tagged('u_similar', {
  content: ['deadpan', 'relatable', 'observational', 'meta'],
  genres: ['indie_rock', 'dream_pop', 'ambient'],
  artists: ['Odessa Vale', 'Halcyon Mile', 'Imre Tanaka'],
});

const MILDLY_SIMILAR = tagged('u_mild', {
  content: ['deadpan', 'relatable', 'hyperbole'],
  genres: ['indie_rock'],
  artists: ['Odessa Vale', 'Halcyon Mile'],
});

const DIFFERENT = tagged(
  'u_different',
  {
    content: ['edgelord', 'dark', 'boomer', 'work_horror'],
    genres: ['metal', 'country', 'techno'],
    artists: ['Gravefield', 'Wren Adair', 'NULLPOINTER'],
    styles: { affiliative: 0.1, self_enhancing: 0.4, aggressive: 0.4, self_defeating: 0.1 },
  },
  60,
);

/* ----------------------------------------------------------- fixtures proof */

describe('Resonance Engine — Taste Twins fixtures', () => {
  it('scores two clearly similar users above two clearly different users', () => {
    const similar = tasteTwins(VIEWER, SIMILAR);
    const different = tasteTwins(VIEWER, DIFFERENT);

    expect(similar.score).toBeGreaterThan(different.score);
    // The gap must be decisive, not a rounding artefact.
    expect(similar.score - different.score).toBeGreaterThanOrEqual(30);
    expect(similar.humor).toBeGreaterThan(different.humor);
    expect(similar.music).toBeGreaterThan(different.music);
  });

  it('orders the near-match between the twin and the stranger', () => {
    const similar = tasteTwins(VIEWER, SIMILAR).score;
    const mild = tasteTwins(VIEWER, MILDLY_SIMILAR).score;
    const different = tasteTwins(VIEWER, DIFFERENT).score;

    expect(mild).toBeGreaterThan(different);
    expect(similar).toBeGreaterThanOrEqual(mild);
  });

  it('rewards a concrete shared artist over abstract similarity alone', () => {
    const withArtist = tasteTwins(VIEWER, SIMILAR);
    const withoutArtist = tasteTwins(VIEWER, { ...SIMILAR, topArtists: ['Someone Else Entirely'] });

    expect(withArtist.shared).toBeGreaterThan(withoutArtist.shared);
    expect(withArtist.score).toBeGreaterThanOrEqual(withoutArtist.score);
    expect(withArtist.sharedArtists).toContain('Odessa Vale');
  });

  it('always returns an integer percentage inside 0-100', () => {
    for (const other of [SIMILAR, DIFFERENT, profile({ userId: 'u_empty' })]) {
      const { score } = tasteTwins(VIEWER, other);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('handles an empty profile without throwing or scoring it highly', () => {
    const { score } = tasteTwins(VIEWER, profile({ userId: 'u_empty', eventCount: 0 }));
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeLessThan(60);
  });

  it('is symmetric in the score, because similarity has no direction', () => {
    expect(tasteTwins(VIEWER, SIMILAR).score).toBe(tasteTwins(SIMILAR, VIEWER).score);
  });
});

/* ---------------------------------------------------------------- cold start */

describe('Resonance Engine — cold start damping', () => {
  it('ramps confidence from 0.5 to 1.0 over the first 50 events', () => {
    expect(calibrationConfidence(0)).toBeCloseTo(0.5);
    expect(calibrationConfidence(25)).toBeCloseTo(0.75);
    expect(calibrationConfidence(50)).toBe(1);
    expect(calibrationConfidence(500)).toBe(1);
  });

  it('damps an identical taste when one side is brand new', () => {
    const newUser = { ...SIMILAR, userId: 'u_new', eventCount: 0 };
    const established = { ...SIMILAR, eventCount: 300 };

    const cold = tasteTwins(VIEWER, newUser);
    const warm = tasteTwins(VIEWER, established);

    expect(cold.calibrating).toBe(true);
    expect(warm.calibrating).toBe(false);
    expect(cold.confidence).toBeCloseTo(0.5);
    // Identical vectors, half the shown score: that is the damping, not the match.
    expect(cold.humor).toBeCloseTo(warm.humor, 5);
    expect(cold.score).toBeLessThan(warm.score);
  });

  it('marks a profile calibrating below 10 events', () => {
    expect(isCalibrating(9)).toBe(true);
    expect(isCalibrating(10)).toBe(false);
  });

  it('scales the damping by the weaker of the two profiles', () => {
    const mine = tagged('u_mine', { content: ['deadpan'], genres: ['indie_rock'], artists: ['Odessa Vale'] }, 120);
    const theirs = tagged('u_theirs', { content: ['deadpan'], genres: ['indie_rock'], artists: ['Odessa Vale'] }, 4);
    expect(tasteTwins(mine, theirs).confidence).toBeLessThan(1);
  });

  it('never lets the damping produce a negative score', () => {
    const brandNew = { ...DIFFERENT, eventCount: 0 };
    expect(tasteTwins(VIEWER, brandNew).score).toBeGreaterThanOrEqual(0);
  });
});

/* -------------------------------------------------------------- anti-genres */

describe('Resonance Engine — anti-genres', () => {
  it('lowers the score when the candidate leads with a blocked genre', () => {
    const viewer = { ...VIEWER, antiGenres: ['metal', 'country', 'techno'] };
    const penalised = tasteTwins(viewer, DIFFERENT);
    const plain = tasteTwins({ ...VIEWER, antiGenres: [] }, DIFFERENT);

    expect(penalised.antiGenrePenalty).toBeLessThan(0);
    expect(penalised.score).toBeLessThanOrEqual(plain.score);
  });

  it('caps the penalty at -0.25 even when every genre is blocked', () => {
    const viewer = { ...VIEWER, antiGenres: ['metal', 'country', 'techno'] };
    expect(tasteTwins(viewer, DIFFERENT).antiGenrePenalty).toBeCloseTo(-0.25);
  });

  it('produces no anti-genre penalty at all for unblocked genres', () => {
    const { antiGenrePenalty } = tasteTwins({ ...VIEWER, antiGenres: ['k_pop'] }, SIMILAR);
    // Guard against -0 leaking into storage or a comparison.
    expect(antiGenrePenalty).toBe(0);
    expect(Object.is(antiGenrePenalty, -0)).toBe(false);
  });

  it('penalises the viewer, never the target profile', () => {
    const viewer = { ...VIEWER, vibeReportedLookalikes: [SIMILAR.userId] };
    const { vibeReportPenalty, score } = tasteTwins(viewer, SIMILAR);

    expect(vibeReportPenalty).toBeCloseTo(-0.1);
    expect(score).toBeLessThan(tasteTwins(VIEWER, SIMILAR).score);
    expect(SIMILAR.eventCount).toBe(60);
    expect(SIMILAR.vibeReported).toHaveLength(0);
  });
});

/* --------------------------------------------------------- why-you-match copy */

describe('Resonance Engine — why you match', () => {
  it('never leaks a blocked genre or a vibe-report to the reader', () => {
    const viewer = { ...VIEWER, antiGenres: ['metal'], vibeReported: ['u_x'] };
    const line = whyYouMatch(tasteTwins(viewer, DIFFERENT), { theirName: 'Kai' });
    expect(line.toLowerCase()).not.toContain('metal');
    expect(line.toLowerCase()).not.toContain('vibe');
  });

  it('names the shared artist when there is one', () => {
    expect(whyYouMatch(tasteTwins(VIEWER, SIMILAR), { theirName: 'Kai' })).toContain('Odessa Vale');
  });

  it('says it is still calibrating rather than guessing', () => {
    const newUser = { ...SIMILAR, eventCount: 1 };
    expect(whyYouMatch(tasteTwins(VIEWER, newUser))).toContain('calibrating');
  });

  it('always returns a non-empty sentence for every pairing', () => {
    for (const other of [SIMILAR, MILDLY_SIMILAR, DIFFERENT, profile({ userId: 'u_e', eventCount: 0 })]) {
      const line = whyYouMatch(tasteTwins(VIEWER, other), { theirName: 'Kai' });
      expect(line.length).toBeGreaterThan(10);
      expect(line.endsWith('.')).toBe(true);
    }
  });
});

/* ------------------------------------------------------ vector invariants */

describe('Resonance Engine — corrected incremental update', () => {
  const meme = (tags: string[]) => memeStyleVector({ tags });

  it('lays the taxonomy out over exactly the declared dimensions', () => {
    const vectors = tasteEmbeddings({
      humor: { content: ['absurd', 'deadpan'], formats: ['text_post'] },
      music: { genres: ['indie_rock'], artists: ['Odessa Vale'] },
    });
    expect(vectors.humor).toHaveLength(HUMOR_DIMS);
    expect(vectors.music).toHaveLength(MUSIC_DIMS);
    expect(HUMOR_DIMS).toBe(HUMOR_STYLE_AXES + HUMOR_CONTENT.length + 10);
    expect(HUMOR_DIMS).toBe(4 + 30);
  });

  it('keeps the humor vector unit length after 200 events', () => {
    let fingerprint = emptyFingerprint();
    for (let i = 0; i < 200; i++) {
      fingerprint = applyEvent({
        fingerprint,
        event: eventFor('laugh', 'humor'),
        humorVector: meme(['absurd', 'deadpan', 'text_post']),
      }).fingerprint;
    }
    expect(magnitudeOf(fingerprint.humor)).toBeCloseTo(1, 3);
  });

  it('keeps the four style axes a valid distribution through any event mix', () => {
    let fingerprint = emptyFingerprint();
    for (const tags of [['absurd'], ['edgelord'], ['wholesome'], ['romance_disaster'], ['deadpan']]) {
      fingerprint = applyEvent({ fingerprint, event: eventFor('laugh', 'humor'), humorVector: meme(tags) }).fingerprint;
      const axes = humorAxes(fingerprint.humor);
      expect(axes).toHaveLength(4);
      for (const value of axes) expect(value).toBeGreaterThanOrEqual(0);
      expect(axes.reduce((total, value) => total + value, 0)).toBeCloseTo(1, 6);
    }
  });

  it('bounds the axis block so it cannot dominate the taxonomy dims', () => {
    let fingerprint = emptyFingerprint();
    fingerprint = applyEvent({
      fingerprint,
      event: eventFor('laugh', 'humor'),
      humorVector: meme(['absurd', 'dark', 'deadpan', 'meta', 'wholesome']),
    }).fingerprint;

    const axisMagnitude = magnitudeOf(fingerprint.humor.slice(0, HUMOR_STYLE_AXES));
    expect(axisMagnitude).toBeLessThanOrEqual(AXIS_BLOCK_WEIGHT + 1e-6);
  });

  it('does not amplify noise when negative events cancel the vector', () => {
    let fingerprint = emptyFingerprint();
    const one = meme(['absurd']);
    fingerprint = applyEvent({ fingerprint, event: eventFor('laugh', 'humor'), humorVector: one }).fingerprint;
    for (let i = 0; i < 40; i++) {
      fingerprint = applyEvent({
        fingerprint,
        event: eventFor(i % 2 === 0 ? 'meh' : 'skip', 'humor'),
        humorVector: one,
      }).fingerprint;
    }
    expect(fingerprint.humor.every((value) => Number.isFinite(value) && Math.abs(value) <= 1)).toBe(true);
    expect(magnitudeOf(fingerprint.humor)).toBeCloseTo(1, 3);
  });

  it('clamps weights so a single event cannot flip the profile', () => {
    const fingerprint = applyEvent({
      fingerprint: emptyFingerprint(),
      event: eventFor('duel', 'humor'), // weight 2.0, the documented ceiling
      humorVector: meme(['absurd']),
    }).fingerprint;
    expect(fingerprint.humor.every((value) => value <= 1)).toBe(true);

    const clamped = applyEvent({
      fingerprint: emptyFingerprint(),
      event: { kind: 'share', domain: 'humor', weight: 99 },
      humorVector: meme(['absurd']),
    });
    expect(clamped.weight).toBe(2);
  });

  it('is domain-scoped: a meme reaction never moves the music vector', () => {
    const result = applyEvent({
      fingerprint: emptyFingerprint(),
      event: eventFor('laugh', 'humor'),
      humorVector: meme(['absurd']),
    });
    expect(result.applied).toBe(true);
    expect(result.fingerprint.music.every((value) => value === 0)).toBe(true);
  });

  it('is domain-scoped the other way too', () => {
    const musicVector = new Array<number>(MUSIC_DIMS).fill(0);
    musicVector[0] = 1;
    const result = applyEvent({
      fingerprint: emptyFingerprint(),
      event: eventFor('like', 'music'),
      musicVector,
    });
    expect(result.fingerprint.humor.every((value) => value === 0)).toBe(true);
  });

  it('shrinks a blocked genre relative to an unblocked one', () => {
    // Two genres plus an artist, so the vector has real shape to preserve.
    const musicVector = new Array<number>(MUSIC_DIMS).fill(0);
    musicVector[0] = 1; // indie_rock — the genre we block
    musicVector[1] = 1; // dream_pop
    musicVector[24] = 1; // an artist bucket

    const withBoth = applyEvent({
      fingerprint: emptyFingerprint(),
      event: eventFor('like', 'music'),
      musicVector,
    }).fingerprint;

    const afterBlock = applyEvent({
      fingerprint: withBoth,
      event: eventFor('like', 'music'),
      musicVector,
      antiGenres: ['indie_rock'],
    }).fingerprint;

    const blocked = afterBlock.music[0] ?? 0;
    const unblocked = afterBlock.music[1] ?? 0;

    expect(blocked).toBeLessThan(unblocked);
    expect(blocked).toBeLessThan(withBoth.music[0] ?? 0);
    // Floored: dislikes can push a genre down but never through zero.
    expect(blocked).toBeGreaterThan(0);
  });

  it('ignores an anti-genre that is not in the taxonomy', () => {
    const musicVector = new Array<number>(MUSIC_DIMS).fill(0);
    musicVector[0] = 1;
    const before = applyEvent({ fingerprint: emptyFingerprint(), event: eventFor('like', 'music'), musicVector }).fingerprint;
    const after = applyEvent({
      fingerprint: before,
      event: eventFor('like', 'music'),
      musicVector,
      antiGenres: ['not_a_genre'],
    }).fingerprint;
    expect(after.music[0]).toEqual(before.music[0]);
  });

  it('is replayable: the same event log always produces the same vector', () => {
    const events = [
      { event: eventFor('laugh', 'humor' as const), humorVector: meme(['absurd']) },
      { event: eventFor('save', 'humor' as const), humorVector: meme(['deadpan']) },
      { event: eventFor('meh', 'humor' as const), humorVector: meme(['wholesome']) },
    ];
    const a = replayEvents(events);
    const b = replayEvents(events);
    expect(a.humor).toEqual(b.humor);
    expect(a.eventCount).toBe(b.eventCount);
    expect(a.vectorVersion).toBe(b.vectorVersion);
    expect(a.eventCount).toBe(3);
  });

  it('never mutates the fingerprint it was given', () => {
    const before = emptyFingerprint();
    const snapshot = JSON.stringify(before);
    applyEvent({ fingerprint: before, event: eventFor('laugh', 'humor'), humorVector: meme(['absurd']) });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('applies the Daily Drop multiplier', () => {
    expect(eventFor('laugh', 'humor', true).weight).toBeCloseTo(1.5);
    expect(eventFor('laugh', 'humor').weight).toBeCloseTo(1);
    expect(eventFor('meh', 'humor', true).weight).toBeCloseTo(-0.9);
  });
});

/* ------------------------------------------------------- candidate pipeline */

const person = (over: Partial<Candidate> = {}, seed = 0): Candidate => {
  const base = buildPopulation(NOW, 12)[seed % 12] as Candidate;
  // Force an eligible profile so each test overrides exactly the field it is
  // about. The generated population randomises these on purpose.
  return {
    ...base,
    userId: base.userId,
    age: 28,
    distanceKm: 4,
    photoChecked: true,
    onboarded: true,
    deletedAt: null,
    deactivatedAt: null,
    lastActiveAt: NOW - 3_600_000,
    lookingFor: ['dating', 'friends'] as const,
    ...over,
  };
};

const viewerFor = (over: Partial<Parameters<typeof rankCandidates>[0]> = {}) => ({
  userId: 'u_me',
  mode: 'dating' as const,
  radiusKm: 25,
  ageMin: 18,
  ageMax: 45,
  onboarded: true,
  photoChecked: true,
  taste: VIEWER,
  now: NOW,
  ...over,
});

describe('Resonance Engine — candidate pipeline', () => {
  it('hard-filters ineligible people and counts each rejection reason', () => {
    const pool: Candidate[] = [
      person({ userId: 'u_child', age: 17 }),
      person({ userId: 'u_nophoto', photoChecked: false }),
      person({ userId: 'u_far', distanceKm: 90 }),
      person({ userId: 'u_friend', lookingFor: ['friends'] }, 1),
      person({ userId: 'u_dead', deletedAt: NOW }, 2),
      person({ userId: 'u_gone', deactivatedAt: NOW }, 3),
      person({ userId: 'u_unboarded', onboarded: false }, 4),
      person({ userId: 'u_old', age: 70 }, 5),
      person({ userId: 'u_ok' }, 6),
    ];
    const deck = rankCandidates(viewerFor({ limit: 20 }), pool);
    const ids = deck.candidates.map((entry) => entry.profile.userId);

    expect(ids).toContain('u_ok');
    for (const rejected of ['u_child', 'u_nophoto', 'u_far', 'u_friend', 'u_dead', 'u_gone', 'u_unboarded', 'u_old']) {
      expect(ids).not.toContain(rejected);
    }
    expect(deck.diagnostics.rejected.under_18).toBe(1);
    expect(deck.diagnostics.rejected.not_photo_checked).toBe(1);
    expect(deck.diagnostics.rejected.too_far).toBe(1);
    expect(deck.diagnostics.rejected.mode).toBe(1);
    expect(deck.diagnostics.rejected.inactive).toBe(2);
    expect(deck.diagnostics.rejected.not_onboarded).toBe(1);
    expect(deck.diagnostics.rejected.age_range).toBe(1);
  });

  it('never returns the viewer themselves', () => {
    const deck = rankCandidates(viewerFor(), [person({ userId: 'u_me' }), person({ userId: 'u_other' }, 1)]);
    expect(deck.candidates.map((entry) => entry.profile.userId)).not.toContain('u_me');
  });

  it('excludes people who have not been active recently', () => {
    const stale = person({ userId: 'u_stale', lastActiveAt: NOW - 60 * 86_400_000 });
    const deck = rankCandidates(viewerFor(), [stale, person({ userId: 'u_fresh' }, 1)]);
    expect(deck.candidates.map((entry) => entry.profile.userId)).not.toContain('u_stale');
  });

  it('resends a fresh profile ahead of an established one with the same taste', () => {
    const shared = { humor: SIMILAR.humor, music: SIMILAR.music, topArtists: SIMILAR.topArtists };
    const established = person({ userId: 'u_old', ...shared, eventCount: 400, lastActiveAt: NOW - 3_600_000 });
    const fresh = person({ userId: 'u_new', ...shared, eventCount: 6, lastActiveAt: NOW - 3_600_000 });

    const deck = rankCandidates(viewerFor({ limit: 5 }), [established, fresh]);
    const order = deck.candidates.map((entry) => entry.profile.userId);
    expect(order).toContain('u_new');
    expect(order.indexOf('u_new')).toBeLessThan(order.indexOf('u_old'));
  });

  it('stops boosting a fresh profile once the freshness window has passed', () => {
    const shared = { humor: SIMILAR.humor, music: SIMILAR.music, topArtists: SIMILAR.topArtists };
    // 9 days is inside the 30-day activity window but outside the 7-day boost.
    const pastWindow = person({
      userId: 'u_past',
      ...shared,
      eventCount: 6,
      lastActiveAt: NOW - 9 * 86_400_000,
    });
    const boosted = person({
      userId: 'u_boosted',
      ...shared,
      eventCount: 6,
      lastActiveAt: NOW - 1 * 86_400_000,
    });

    const deck = rankCandidates(viewerFor({ limit: 5 }), [pastWindow, boosted]);
    const order = deck.candidates.map((entry) => entry.profile.userId);
    expect(order).toContain('u_past');
    expect(order.indexOf('u_boosted')).toBeLessThan(order.indexOf('u_past'));
  });

  it('limits consecutive cards that lead with the same genre', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      person({ userId: `u_g${i}`, topGenres: i < 5 ? ['metal'] : ['folk'] }, i % 4),
    );
    const spread = diversify(
      rows.map((row) => ({ profile: row })),
      (row) => row.topGenres[0] ?? null,
    );
    let run = 1;
    for (let i = 1; i < spread.length; i++) {
      run = spread[i - 1]?.profile.topGenres[0] === spread[i]?.profile.topGenres[0] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
    // Diversity defers, it never drops.
    expect(spread).toHaveLength(rows.length);
  });

  it('throttles the over-represented side of an imbalanced pool', () => {
    const men = Array.from({ length: 8 }, (_, i) => person({ userId: `u_m${i}`, gender: 'man' }, i % 4));
    const women = Array.from({ length: 2 }, (_, i) => person({ userId: `u_w${i}`, gender: 'woman' }, i % 4));
    const decision = pacingDecision([...men, ...women], 10);

    expect(decision.dominantGender).toBe('man');
    expect(decision.cap).not.toBeNull();

    const deck = rankCandidates(viewerFor({ limit: 10 }), [...men, ...women]);
    const shownMen = deck.candidates.filter((entry) => entry.profile.gender === 'man');
    expect(shownMen.length).toBeLessThanOrEqual(decision.cap as number);
    // The scarce side is never dropped by the pacing rule.
    expect(deck.candidates.some((entry) => entry.profile.gender === 'woman')).toBe(true);
  });

  it('leaves a balanced pool alone', () => {
    const men = Array.from({ length: 4 }, (_, i) => person({ userId: `u_m${i}`, gender: 'man' }, i));
    const women = Array.from({ length: 4 }, (_, i) => person({ userId: `u_w${i}`, gender: 'woman' }, i));
    expect(pacingDecision([...men, ...women], 10).cap).toBeNull();
  });

  it('is deterministic: the same pool always ranks the same way', () => {
    const pool = buildPopulation(NOW, 12);
    const a = rankCandidates(viewerFor(), pool).candidates.map((entry) => entry.id);
    const b = rankCandidates(viewerFor(), pool).candidates.map((entry) => entry.id);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('respects the limit and ranks the whole offline population without error', () => {
    const deck = rankCandidates(viewerFor({ limit: 7 }), buildPopulation(NOW, 48));
    expect(deck.poolSize).toBeGreaterThan(0);
    expect(deck.candidates.length).toBeLessThanOrEqual(7);
    for (const entry of deck.candidates) {
      expect(entry.tasteTwins.score).toBeGreaterThanOrEqual(0);
      expect(entry.tasteTwins.score).toBeLessThanOrEqual(100);
    }
  });

  it('skips unreadable vectors from the noisy population', () => {
    const noisy = person({ userId: 'u_noisy', humor: [], music: [] });
    const deck = rankCandidates(viewerFor({ limit: 5 }), [noisy, person({ userId: 'u_real' }, 1)]);
    for (const entry of deck.candidates) {
      expect(Number.isFinite(entry.tasteTwins.score)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------- embeddings */

describe('Resonance Engine — embeddings', () => {
  it('normalises loose genre strings onto the taxonomy', () => {
    const a = tasteEmbeddings({ humor: {}, music: { genres: ['Neo Soul', 'R&B'], artists: ['X'] } }).music;
    const b = tasteEmbeddings({ humor: {}, music: { genres: ['neo_soul', 'r_and_b'], artists: ['X'] } }).music;
    expect(cosine(a, b)).toBeCloseTo(1, 6);
  });

  it('maps R&B spelled several ways onto one dimension', () => {
    const forms = ['R&B', 'rnb', 'R and B', 'randb', 'r_and_b'];
    const vectors = forms.map((form) => tasteEmbeddings({ humor: {}, music: { genres: [form], artists: ['X'] } }).music);
    for (const vector of vectors) expect(cosine(vector, vectors[0] as number[])).toBeCloseTo(1, 6);
  });

  it('gives the same artist the same bucket regardless of case', () => {
    const one = tasteEmbeddings({ humor: {}, music: { artists: ['Odessa Vale'] } }).music;
    const two = tasteEmbeddings({ humor: {}, music: { artists: ['odessa vale'] } }).music;
    expect(cosine(one, two)).toBeCloseTo(1, 6);
  });

  it('ignores unknown tags instead of throwing', () => {
    const vector = memeStyleVector({ tags: ['not_a_real_category', 'deadpan'] });
    expect(vector).toHaveLength(HUMOR_DIMS);
    expect(vector.some((value) => value > 0)).toBe(true);
  });

  it('produces unit-length vectors for a tagged profile', () => {
    const { humor, music } = tasteEmbeddings({
      humor: { content: ['deadpan'], formats: ['text_post'] },
      music: { genres: ['indie_rock'], artists: ['Odessa Vale'] },
    });
    // Vectors are rounded to 4dp on the way out, so unit length is close, not exact.
    expect(magnitudeOf(humor)).toBeCloseTo(1, 3);
    expect(magnitudeOf(normalize(music))).toBeCloseTo(1, 6);
  });

  it('gives a profile with no tags a zero vector rather than a fabricated one', () => {
    // Two brand-new users must not look identical and match on nothing.
    const a = tasteEmbeddings({ humor: {}, music: {} }).humor;
    const b = tasteEmbeddings({ humor: {}, music: {} }).humor;
    expect(a.every((value) => value === 0)).toBe(true);
    expect(cosine(a, b)).toBe(0);
  });

  it('accepts every humor taxonomy id without dropping one', () => {
    const vector = memeStyleVector({ tags: [...HUMOR_CONTENT, ...HUMOR_STYLES, 'text_post'] });
    for (const content of HUMOR_CONTENT) {
      const index = HUMOR_STYLES.length + HUMOR_CONTENT.indexOf(content);
      expect(vector[index]).toBeGreaterThan(0);
    }
  });
});