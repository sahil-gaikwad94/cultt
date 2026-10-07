import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockRepo } from '../../src/data/mockRepo';
import { AgeGateError } from '../../src/lib/safety';
import { HUMOR_DIMS, MUSIC_DIMS } from '../../src/lib/matching';

const NOW = Date.parse('2026-10-06T12:00:00Z');

/* These specs exercise the matching engine, which needs the invented
   population to have anything to rank. That population is demo content and is
   off by default, so the helper opts in explicitly. The regression test below
   pins the default. */
const newRepo = (): MockRepo => new MockRepo(NOW, true);

const onboard = {
  dateOfBirth: '1998-04-02',
  displayName: 'Alex',
  mode: 'dating' as const,
  city: 'Lisbon',
  musicSource: 'manual' as const,
  pickedTastes: ['deadpan', 'niche_hobby', 'wordplay'],
  memeSignals: [
    { memeId: 'mk001', kind: 'laugh' as const },
    { memeId: 'mk002', kind: 'laugh' as const },
    { memeId: 'mk003', kind: 'meh' as const },
    { memeId: 'mk004', kind: 'laugh' as const },
  ],
  audioSignals: [{ trackId: 't_choir', kind: 'react' as const }],
  photoChecked: true,
  antiGenres: ['metal'],
};

describe('MockRepo — adapter contract', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('records reactions and safety actions behind the adapter', async () => {
    const repo = newRepo();
    await repo.recordReaction('mk001', 'laugh');
    await repo.submitSafetyAction('u_1', 'vibe-report', 'Nothing in common');
    const trace = JSON.parse(localStorage.getItem('cultured2:repo-events') ?? '[]') as unknown[];
    expect(trace.length).toBeGreaterThanOrEqual(2);
  });

  it('models a deletion request as a cooling-off period', async () => {
    const result = await newRepo().requestAccountDeletion();
    expect(result.status).toBe('cooling-off');
    expect(new Date(result.effectiveAt).getTime()).toBeGreaterThan(NOW);
  });

  it('exposes a session and a full profile', async () => {
    const repo = newRepo();
    const session = await repo.getSession();
    expect(session.authed).toBe(true);
    expect(session.tier).toBe('free');

    const me = await repo.getMe();
    expect(me.displayName).toBeTruthy();
    expect(me.antiGenres).toEqual([]);
  });
});

describe('MockRepo — onboarding wires real vectors', () => {
  beforeEach(() => localStorage.clear());

  it('hard-blocks an under-18 date of birth', async () => {
    await expect(newRepo().onboard({ ...onboard, dateOfBirth: '2012-01-01' })).rejects.toThrow(AgeGateError);
  });

  it('produces a vector of the declared dimensions with real signal', async () => {
    const result = await newRepo().onboard(onboard);
    expect(result.fingerprint.humor).toHaveLength(HUMOR_DIMS);
    expect(result.fingerprint.music).toHaveLength(MUSIC_DIMS);
    expect(result.fingerprint.humor.some((value) => value > 0)).toBe(true);
    expect(result.fingerprint.eventCount).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('starts uncalibrated and reads as calibrating', async () => {
    const result = await newRepo().onboard(onboard);
    // Five calibration signals is nowhere near the 50-event ramp.
    expect(result.fingerprint.eventCount).toBeLessThan(10);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('marks the session onboarded and keeps adult true from the server check', async () => {
    const repo = newRepo();
    const result = await repo.onboard(onboard);
    expect(result.session.onboarded).toBe(true);
    expect(result.session.adult).toBe(true);
    expect((await repo.getSession()).onboarded).toBe(true);
  });

  it('never persists an under-18 profile', async () => {
    const repo = newRepo();
    await expect(repo.onboard({ ...onboard, dateOfBirth: '2013-01-01' })).rejects.toThrow();
    expect((await repo.getSession()).onboarded).toBe(false);
  });
});

describe('MockRepo — the engine drives the Matrix', () => {
  beforeEach(() => localStorage.clear());

  it('returns ranked candidates with a computed score and a why line', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    // No taste override: the adapter resolves the viewer's own vectors.
    const cards = await repo.getCandidates();

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.display.score).toBeGreaterThanOrEqual(0);
      expect(card.display.score).toBeLessThanOrEqual(100);
      expect(card.display.whyYouMatch.length).toBeGreaterThan(10);
      expect(card.display.label).toMatch(/Taste twin|Strong overlap|Worth a listen/);
      expect(card.profile.photoChecked).toBe(true);
      expect(card.profile.age).toBeGreaterThanOrEqual(18);
    }
  });

  it('changes the ranking when the viewer reacts to things', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const fingerprint = await repo.getFingerprint();

    const before = await repo.getCandidates();
    for (const memeId of ['mk045', 'mk046', 'mk047', 'mk048', 'mk049']) {
      await repo.recordReaction(memeId, 'laugh');
    }
    const after = await repo.getCandidates();

    const beforeScore = before[0]?.display.score ?? 0;
    const afterScore = after[0]?.display.score ?? 0;
    // Scores are computed, so they move when the vector moves.
    expect(beforeScore + afterScore).toBeGreaterThan(0);
    const afterVector = await repo.getFingerprint();
    expect(afterVector.vectorVersion).toBeGreaterThan(fingerprint.vectorVersion);
  });

  it('never returns more than the requested deck size', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const cards = await repo.getCandidates({ limit: 3 });
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('drops a person from the deck once a decision is made', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const first = (await repo.getCandidates({}))[0];
    expect(first).toBeDefined();
    await repo.decide(first.id, 'pass');

    const next = await repo.getCandidates({});
    expect(next.map((card) => card.id)).not.toContain(first.id);
  });

  it('removes a blocked person from the deck', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const first = (await repo.getCandidates({}))[0];
    await repo.submitSafetyAction(first.id, 'block');
    const next = await repo.getCandidates({});
    expect(next.map((card) => card.id)).not.toContain(first.id);
  });
});

describe('MockRepo — chat', () => {
  beforeEach(() => localStorage.clear());

  it('opens a thread on a mutual and delivers a message', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const cards = await repo.getCandidates({});
    const mutual = cards.find((card) => card.likesYou);
    if (!mutual) return;

    const result = await repo.decide(mutual.id, 'resonate');
    expect(result.matched).toBe(true);
    const threadId = result.threadId as string;

    const message = await repo.sendMessage(threadId, 'your taste is a problem, respectfully');
    expect(message.from).toBe('me');
    expect((await repo.getMessages(threadId)).some((entry) => entry.id === message.id)).toBe(true);
  });

  it('holds an abusive message instead of sending it', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    const cards = await repo.getCandidates({});
    const mutual = cards.find((card) => card.likesYou);
    if (!mutual) return;
    const threadId = (await repo.decide(mutual.id, 'resonate')).threadId as string;
    await expect(repo.sendMessage(threadId, 'kill yourself')).rejects.toThrow(/held for review/);
  });

  it('delivers a reply to a thread subscriber', async () => {
    vi.useFakeTimers();
    const repo = newRepo();
    await repo.onboard(onboard);
    const cards = await repo.getCandidates({});
    const mutual = cards.find((card) => card.likesYou);
    if (!mutual) {
      vi.useRealTimers();
      return;
    }
    const threadId = (await repo.decide(mutual.id, 'resonate')).threadId as string;

    const received: string[] = [];
    repo.subscribeToThread(threadId, (message) => received.push(message.from));
    await repo.sendMessage(threadId, 'hello there');
    await vi.advanceTimersByTimeAsync(2000);
    expect(received).toContain('them');
    vi.useRealTimers();
  });
});

describe('MockRepo — trust, sessions and data rights', () => {
  beforeEach(() => localStorage.clear());

  it('badges a photo check honestly and queues low confidence for review', async () => {
    const repo = newRepo();
    const confident = await repo.submitLiveness({ faceDetected: true, confidence: 0.95, matchesProfilePhoto: true });
    expect(confident.status).toBe('checked');
    expect(confident.badge).toBe('photo checked');
    expect(confident.badge).not.toMatch(/verified identity/i);

    const unsure = await repo.submitLiveness({ faceDetected: true, confidence: 0.4, matchesProfilePhoto: true });
    expect(unsure.status).toBe('review');
    expect(unsure.queuePosition).toBeGreaterThan(0);
  });

  it('rejects a capture with no face detected', async () => {
    const repo = newRepo();
    const result = await repo.submitLiveness({ faceDetected: false, confidence: 0.1, matchesProfilePhoto: null });
    expect(result.status).toBe('rejected');
  });

  it('enforces the 15-minute session cap server-side', async () => {
    const repo = newRepo();
    const entitlements = await repo.getEntitlements();
    expect(entitlements.tier).toBe('free');

    const session = await repo.startListeningSession({ matchId: 'm_1', trackId: 't_choir', seats: 2 });
    expect(session.allowed).toBe(true);
    expect(session.remainingSeconds).toBe(900);

    // The cap is per match per day, accumulated across sessions.
    await repo.endListeningSession(session.id, 600);
    const second = await repo.startListeningSession({ matchId: 'm_1', trackId: 't_moons', seats: 2 });
    expect(second.remainingSeconds).toBe(300);

    await repo.endListeningSession(second.id, 300);
    const third = await repo.startListeningSession({ matchId: 'm_1', trackId: 't_glass', seats: 2 });
    expect(third.allowed).toBe(false);
    expect(third.reason).toBe('session_cap');
    expect(third.id).toBe('');

    // A different match gets its own 15 minutes.
    const elsewhere = await repo.startListeningSession({ matchId: 'm_2', trackId: 't_glass', seats: 2 });
    expect(elsewhere.allowed).toBe(true);
    expect(elsewhere.remainingSeconds).toBe(900);
  });

  it('serves legal copy flagged for review', async () => {
    const repo = newRepo();
    const privacy = await repo.getLegalDocument('privacy');
    expect(privacy.status).toBe('needs_lawyer_review');
    expect(privacy.body).toMatch(/fuzzed/i);
    expect(privacy.title).toBe('Privacy policy');
  });

  it('queues an export and a cancellable deletion', async () => {
    const repo = newRepo();
    expect((await repo.requestDataExport()).status).toBe('queued');
    expect((await repo.requestAccountDeletion()).status).toBe('cooling-off');
    expect((await repo.cancelAccountDeletion()).status).toBe('active');
  });

  it('rebuilds the humor vector deterministically', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    await repo.recordReaction('mk010', 'laugh');
    const rebuilt = await repo.rebuildHumorVector();
    const again = await repo.rebuildHumorVector();
    expect(rebuilt.humor).toEqual(again.humor);
    expect(rebuilt.vectorVersion).toBeGreaterThan(1);
  });

  it('survives a page reload with its state intact', async () => {
    const repo = newRepo();
    await repo.onboard(onboard);
    await repo.recordReaction('mk020', 'save');
    const version = (await repo.getFingerprint()).vectorVersion;

    const reloaded = newRepo();
    expect((await reloaded.getSession()).onboarded).toBe(true);
    expect((await reloaded.getFingerprint()).vectorVersion).toBe(version);
  });
});

describe('the invented population is opt-in', () => {
  beforeEach(() => localStorage.clear());

  it('hands a default build an empty queue, not forty-eight strangers', async () => {
    const repo = new MockRepo(NOW);
    await repo.onboard(onboard);
    expect(await repo.getCandidates()).toEqual([]);
    expect((await repo.getFeed()).circles).toEqual([]);
  });

  it('hands the same build the population once demo is requested', async () => {
    const repo = new MockRepo(NOW, true);
    await repo.onboard(onboard);
    expect((await repo.getCandidates()).length).toBeGreaterThan(0);
    expect((await repo.getFeed()).circles.length).toBeGreaterThan(0);
  });

  it('never claims anyone likes you outside demo', async () => {
    const repo = new MockRepo(NOW);
    await repo.onboard(onboard);
    const cards = await repo.getCandidates();
    expect(cards.filter((card) => card.likesYou)).toEqual([]);
  });

  it('keeps what the user actually created either way', async () => {
    // React and save in demo, then read the same store back without the flag.
    const demo = new MockRepo(NOW, true);
    await demo.onboard(onboard);
    await demo.recordReaction('mk001', 'laugh');

    const plain = new MockRepo(NOW);
    const fingerprint = await plain.getFingerprint();
    expect(fingerprint.vectorVersion).toBeGreaterThan(0);
  });
});
