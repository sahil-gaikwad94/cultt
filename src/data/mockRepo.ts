/**
 * The offline adapter.
 *
 * This is not a stub. It is a working local backend: it persists state, runs the
 * real Resonance Engine on every reaction, ranks candidates with the real Taste
 * Twins score, and models matches, chat, safety, listening sessions and data
 * rights end to end. It is what CI, tests and offline development run against,
 * and it is the reference the Supabase adapter's contract is checked against.
 *
 * Everything the engine can decide locally it decides locally. The only thing
 * it fakes is other people being online.
 */

import {
  applyEvent,
  emptyFingerprint,
  eventFor,
  domainOf,
  type EventKind,
  type FingerprintVectors,
} from '../lib/matching/update';
import { memeStyleVector, tasteEmbeddings, tasteHumorVector, tasteMusicVector, trackEmbedding } from '../lib/matching/embed';
import { tasteTwins, scoreLabel, whyYouMatch, type TasteProfile } from '../lib/matching/tasteTwins';
import { rankCandidates, type Candidate, type CandidateRequest, type Mode } from '../lib/matching/candidates';
import { HUMOR_LABELS, type HumorTag, normalizeGenre, normalizeHumorTag } from '../lib/matching/taxonomy';
import { roundVector } from '../lib/matching/vector';
import {
  assertAdult,
  isAdult,
  moderateText,
  requestDeletion,
  cancelDeletion,
  type DeletionRequest,
  type ModerationVerdict,
} from '../lib/safety';
import {
  entitlementsFor,
  FREE_SESSION_CAP_SECONDS,
  sessionAllowance,
  startOfLocalDay,
  type Entitlements,
} from '../lib/entitlements';
import { SEED_MEMES } from './seed/memes';
import { SEED_TRACKS, trackById, type SeedTrack } from './seed/tracks';
import { LEGAL_DOCUMENTS } from '../content/legal';
import { buildPopulation, seededRandom, hashString } from './population';
import type {
  CandidateCard,
  CirclePost,
  DataExportResult,
  DecideResult,
  DuelState,
  FeedPage,
  Fingerprint,
  LegalDoc,
  LegalDocument,
  ListeningSessionInput,
  ListeningSessionResult,
  LivenessInput,
  LivenessResult,
  Me,
  Message,
  Meme,
  OnboardingPayload,
  OnboardingResult,
  ProfilePatch,
  Reaction,
  Repo,
  SafetyReason,
  SafetyReportResult,
  Session,
  Thread,
  Track,
} from '../lib/types';

const STATE_KEY = 'cultured2:repo:v2';
/** Kept for the Phase 0 audit trail that the v3 seam wrote. */
const TRACE_KEY = 'cultured2:repo-events';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The Daily Drop unlocks at 9:00 AM local, per the product copy. */
export const DROP_HOUR = 9;

interface ReactionState {
  like?: boolean;
  laugh?: boolean;
  save?: boolean;
}

interface StoredMessage {
  id: string;
  from: 'me' | 'them';
  body: string | null;
  kind: 'text' | 'meme' | 'track';
  ref?: string;
  at: number;
  readAt: number | null;
}

interface StoredThread {
  id: string;
  matchId: string;
  candidateId: string;
  unread: number;
  messages: StoredMessage[];
}

interface StoredSession {
  id: string;
  matchId: string;
  trackId: string;
  startedAt: number;
  seconds: number;
  ended: boolean;
}

interface MockState {
  version: 2;
  me: {
    userId: string;
    displayName: string;
    bio: string;
    age: number;
    city: string;
    mode: Mode;
    lookingFor: Mode[];
    onboarded: boolean;
    dateOfBirth: string;
    photoChecked: boolean;
    tier: 'free' | 'premium';
    fingerprintVisibility: 'everyone' | 'matches' | 'me';
    antiGenres: string[];
  };
  fingerprint: FingerprintVectors;
  topArtists: string[];
  topGenres: string[];
  topCategories: string[];
  reactions: Record<string, ReactionState>;
  decisions: Record<string, 'pass' | 'resonate'>;
  history: string[];
  threads: Record<string, StoredThread>;
  blocks: string[];
  vibeReports: Array<{ to: string; reason: string; at: number }>;
  reports: Array<{ to: string; reason: string; detail: string | null; at: number }>;
  sessions: StoredSession[];
  duel: DuelState | null;
  deletion: DeletionRequest | null;
  exports: Array<{ requestedAt: string }>;
  liveness: LivenessResult | null;
  entitlementDay: string;
  resonateUsed: number;
  triviaUsed: number;
  /** Append-only event log; `rebuildHumorVector` replays it. */
  eventLog: Array<{ kind: EventKind; targetType: 'meme' | 'track'; targetId: string; at: number }>;
  createdAt: number;
}

const DEFAULT_HUMOR_TAGS = ['deadpan', 'niche_hobby', 'wordplay', 'observational', 'relatable'];
const DEFAULT_FORMATS = ['text_post'];
const DEFAULT_STYLES = { affiliative: 0.3, self_enhancing: 0.3, aggressive: 0.1, self_defeating: 0.3 };

const freshState = (now: number): MockState => ({
  version: 2,
  me: {
    userId: 'u_you',
    displayName: 'Alex',
    bio: 'Collects songs that sound like 4pm in October.',
    age: 27,
    city: 'Lisbon',
    mode: 'dating',
    lookingFor: ['dating', 'friends'],
    onboarded: false,
    dateOfBirth: '',
    photoChecked: false,
    tier: 'free',
    fingerprintVisibility: 'matches',
    antiGenres: [],
  },
  fingerprint: emptyFingerprint(),
  topArtists: ['Odessa Vale', 'Halcyon Mile', 'Imre Tanaka', 'Nuvia', 'The Lowtides'],
  topGenres: ['indie_rock', 'dream_pop', 'ambient'],
  topCategories: DEFAULT_HUMOR_TAGS,
  reactions: {},
  decisions: {},
  history: [],
  threads: {},
  blocks: [],
  vibeReports: [],
  reports: [],
  sessions: [],
  duel: null,
  deletion: null,
  exports: [],
  liveness: null,
  entitlementDay: startOfLocalDay(now),
  resonateUsed: 0,
  triviaUsed: 0,
  eventLog: [],
  createdAt: now,
});

const idFor = (prefix: string, seed: string): string => `${prefix}_${hashString(seed).toString(36)}`;

export class MockRepo implements Repo {
  private state: MockState;
  private readonly now: number;
  private population: Candidate[] | null = null;
  private readonly listeners = new Set<(session: Session | null) => void>();
  private readonly threadListeners = new Map<string, Set<(message: Message) => void>>();

  constructor(now: number = Date.now()) {
    this.now = now;
    this.state = this.load(now);
  }

  /* ------------------------------------------------------------ storage */

  private load(now: number): MockState {
    const fallback = freshState(now);
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<MockState>;
      if (parsed.version !== 2) return fallback;
      return {
        ...fallback,
        ...parsed,
        me: { ...fallback.me, ...parsed.me },
        fingerprint: { ...fallback.fingerprint, ...parsed.fingerprint },
      };
    } catch {
      return fallback;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    } catch {
      // Private mode or quota: the in-memory state stays authoritative.
    }
  }

  private trace(entry: Record<string, unknown>): void {
    try {
      const existing = JSON.parse(localStorage.getItem(TRACE_KEY) ?? '[]') as unknown[];
      localStorage.setItem(TRACE_KEY, JSON.stringify([...existing, { ...entry, at: new Date().toISOString() }]));
    } catch {
      // Tracing is best effort and must never break a user action.
    }
  }

  /* -------------------------------------------------------- population */

  private candidates(): Candidate[] {
    if (!this.population) this.population = buildPopulation(this.now);
    return this.population;
  }

  private candidate(id: string): Candidate | undefined {
    return this.candidates().find((person) => person.userId === id);
  }

  /* ------------------------------------------------------------ session */

  async getSession(): Promise<Session> {
    return this.toSession();
  }

  private toSession(): Session {
    return {
      userId: this.state.me.userId,
      onboarded: this.state.me.onboarded,
      adult: this.state.me.dateOfBirth ? isAdult(this.state.me.dateOfBirth, this.now) : true,
      authed: true,
      displayName: this.state.me.displayName,
      mode: this.state.me.mode,
      tier: this.state.me.tier,
    };
  }

  async getMe(): Promise<Me> {
    const me = this.state.me;
    return {
      ...this.toSession(),
      bio: me.bio,
      age: me.age,
      city: me.city,
      lookingFor: me.lookingFor,
      photoChecked: me.photoChecked,
      fingerprintVisibility: me.fingerprintVisibility,
      antiGenres: me.antiGenres,
    };
  }

  async updateProfile(patch: ProfilePatch): Promise<Me> {
    if (patch.displayName?.trim()) this.state.me.displayName = patch.displayName.trim().slice(0, 40);
    if (patch.bio !== undefined) this.state.me.bio = patch.bio.slice(0, 280);
    if (patch.mode) this.state.me.mode = patch.mode;
    if (patch.fingerprintVisibility) this.state.me.fingerprintVisibility = patch.fingerprintVisibility;
    if (patch.antiGenres) {
      this.state.me.antiGenres = patch.antiGenres
        .map((genre) => normalizeGenre(genre) ?? genre)
        .filter((genre): genre is string => Boolean(genre));
      this.rebuildMusic();
    }
    this.persist();
    return this.getMe();
  }

  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async emit(): Promise<void> {
    const session = this.toSession();
    for (const listener of this.listeners) listener(session);
  }

  /* --------------------------------------------------------- onboarding */

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    // Server-side equivalent lives in the `users_dob_adult` trigger; an
    // under-18 date of birth must never produce a session.
    assertAdult(payload.dateOfBirth, this.now);

    this.state.me.dateOfBirth = payload.dateOfBirth;
    this.state.me.displayName = payload.displayName.trim() || this.state.me.displayName;
    this.state.me.city = payload.city || this.state.me.city;
    this.state.me.mode = payload.mode;
    this.state.me.lookingFor = payload.mode === 'both' ? ['dating', 'friends'] : [payload.mode];
    this.state.me.photoChecked = payload.photoChecked;
    this.state.me.antiGenres = payload.antiGenres.map((genre) => normalizeGenre(genre) ?? genre);

    const content = payload.pickedTastes.map((tag) => normalizeHumorTag(tag) ?? '');
    const styles = payload.memeSignals.length
      ? signalAxes(payload.memeSignals.map((signal) => signal.kind))
      : DEFAULT_STYLES;
    const embeddings = tasteEmbeddings({
      humor: { content: content.filter(Boolean), formats: DEFAULT_FORMATS, styles },
      music: {
        genres: this.state.topGenres,
        artists: this.state.topArtists,
      },
    });
    this.state.fingerprint = {
      humor: embeddings.humor,
      music: embeddings.music,
      eventCount: 0,
      vectorVersion: 1,
    };
    this.state.topCategories = content.filter(Boolean);

    for (const signal of payload.memeSignals) {
      await this.applyContentEvent('laugh', signal.kind === 'laugh', signal.kind !== 'skip', 'meme', signal.memeId);
    }
    for (const signal of payload.audioSignals) {
      await this.applyContentEvent('like', true, true, 'track', signal.trackId);
    }

    this.state.me.onboarded = true;
    this.persist();
    await this.emit();
    this.trace({ type: 'onboarding_complete', events: this.state.fingerprint.eventCount });

    return {
      session: this.toSession(),
      fingerprint: this.toFingerprint(),
      confidence: this.confidence(),
    };
  }

  /* -------------------------------------------------------------- feed */

  async getFeed(request: { cursor?: string | null; limit?: number } = {}): Promise<FeedPage> {
    const limit = request.limit ?? 12;
    const offset = request.cursor ? Number(request.cursor) || 0 : 0;
    const random = seededRandom(hashString(`feed:${Math.floor(this.now / DAY_MS)}`));

    const memes = this.orderedMemes()
      .slice(offset, offset + limit)
      .map((memeId) => this.toMeme(memeId, random));

    const tracks = SEED_TRACKS.slice(offset, offset + Math.min(limit, 6)).map((track) => this.toTrack(track.id));

    return {
      drop: this.toDrop(),
      memes,
      tracks,
      circles: this.circles(),
      cursor: offset + limit < this.orderedMemes().length ? String(offset + limit) : null,
    };
  }

  private orderedMemes(): string[] {
    const all = SEED_MEMES.map((meme) => meme.id);
    const random = seededRandom(hashString(`order:${Math.floor(this.now / DAY_MS)}`));
    // Deterministic shuffle: same day, same order, every surface agrees.
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }

  private toMeme(id: string, random?: () => number): Meme {
    const seed = SEED_MEMES.find((meme) => meme.id === id) ?? SEED_MEMES[0];
    const state = this.state.reactions[id] ?? {};
    const rng = random ?? seededRandom(hashString(`meme:${id}`));
    return {
      id: seed.id,
      topic: seed.topic,
      text: seed.text,
      alt: seed.alt,
      tags: seed.tags,
      bg: seed.bg,
      fg: seed.fg,
      ac: seed.ac,
      likes: seed.likes + (state.like ? 1 : 0),
      laughs: seed.laughs + (state.laugh ? 1 : 0),
      liked: Boolean(state.like),
      laughed: Boolean(state.laugh),
      saved: Boolean(state.save),
      // Local Discovery: never a face grid, never an inline swipe.
      nearbyCount: rng() > 0.55 ? 2 + Math.floor(rng() * 12) : null,
    };
  }

  private toTrack(id: string): Track {
    const track = trackById(id);
    return {
      id: track?.id ?? id,
      title: track?.title ?? id,
      artist: track?.artist ?? '',
      genres: track?.genres ?? [],
      previewUrl: null,
      previewSource: null,
      attribution: 'Preview resolved on demand from a no-auth source',
      saved: Boolean(this.state.reactions[`track:${id}`]?.save),
    };
  }

  private toDrop(): FeedPage['drop'] {
    const day = Math.floor(this.now / DAY_MS);
    const random = seededRandom(hashString(`drop:${day}`));
    const memeId = this.orderedMemes()[Math.floor(random() * SEED_MEMES.length)] ?? SEED_MEMES[0].id;
    const track = SEED_TRACKS[Math.floor(random() * SEED_TRACKS.length)] as SeedTrack;
    const unlock = new Date(this.now);
    unlock.setHours(DROP_HOUR, 0, 0, 0);
    if (unlock.getTime() <= this.now - DAY_MS) unlock.setDate(unlock.getDate() + 1);
    return {
      unlocksAt: unlock.toISOString(),
      meme: this.toMeme(memeId),
      track: this.toTrack(track.id),
      streak: this.dropStreak(),
      hint: 'Tonight’s hint: late-night drive',
    };
  }

  private dropStreak(): number {
    // Streak counts from the drop history the user reacted to.
    const dropEvents = this.state.eventLog.filter((event) => event.kind === 'drop_react');
    return Math.min(30, dropEvents.length);
  }

  private circles(): CirclePost[] {
    const random = seededRandom(hashString(`circles:${Math.floor(this.now / DAY_MS)}`));
    return SEED_MEMES.slice(0, 3).map((meme, index) => ({
      id: `c_${meme.id}`,
      authorId: `circle_${index}`,
      authorName: ['Ines', 'Kai', 'Dev'][index] as string,
      kind: 'meme',
      meme: this.toMeme(meme.id, random),
      note: null,
      likes: meme.likes,
      laughs: meme.laughs,
      remixOf: null,
    }));
  }

  async getMeme(id: string): Promise<Meme | null> {
    return SEED_MEMES.some((meme) => meme.id === id) ? this.toMeme(id) : null;
  }

  async getTrack(id: string): Promise<Track | null> {
    return trackById(id) ? this.toTrack(id) : null;
  }

  /* -------------------------------------------------------- reactions */

  async recordReaction(targetId: string, reaction: Reaction, targetType: 'meme' | 'track' = 'meme'): Promise<void> {
    const key = targetType === 'track' ? `track:${targetId}` : targetId;
    const state = (this.state.reactions[key] ??= {});
    const active = !state[reaction];
    state[reaction] = active;

    // Turning a reaction off is a withdrawal, not a negative signal.
    if (!active) {
      this.persist();
      this.trace({ type: 'reaction', targetId, reaction, value: 0 });
      return;
    }

    const kind: EventKind = reaction === 'laugh' ? 'laugh' : reaction === 'save' ? 'save' : 'like';
    await this.applyContentEvent(kind, true, true, targetType, targetId);
  }

  async recordEvent(
    kind: EventKind,
    targetType: 'meme' | 'track',
    targetId: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    await this.applyContentEvent(kind, true, Boolean(meta.dailyDrop), targetType, targetId);
  }

  private async applyContentEvent(
    kind: EventKind,
    positive: boolean,
    active: boolean,
    targetType: 'meme' | 'track',
    targetId: string,
    dailyDrop = false,
  ): Promise<void> {
    const eventKind: EventKind = positive ? kind : kind === 'laugh' ? 'meh' : 'skip';
    const vector = targetType === 'meme' ? this.memeVector(targetId) : this.trackVector(targetId);

    const result = applyEvent({
      fingerprint: this.state.fingerprint,
      event: eventFor(eventKind, domainOf(targetType), dailyDrop),
      humorVector: targetType === 'meme' ? vector : undefined,
      musicVector: targetType === 'track' ? vector : undefined,
      antiGenres: this.state.me.antiGenres,
    });

    if (result.applied) this.state.fingerprint = result.fingerprint;
    if (active) {
      this.state.eventLog.push({ kind: eventKind, targetType, targetId, at: this.now });
      this.recountTopTaste(targetType, targetId, result.weight);
    }
    this.persist();
    this.trace({ type: 'reaction', targetType, targetId, kind: eventKind, weight: result.weight });
    await this.emit();
  }

  private memeVector(id: string): number[] {
    const meme = SEED_MEMES.find((entry) => entry.id === id) ?? SEED_MEMES[0];
    return memeStyleVector({ tags: meme.tags, styles: meme.tags.filter((tag) => normalizeHumorTag(tag) && tag.length < 20) });
  }

  private trackVector(id: string): number[] {
    const track = trackById(id) ?? SEED_TRACKS[0];
    return trackEmbedding({ title: track.title, artist: track.artist, genres: track.genres });
  }

  private recountTopTaste(targetType: 'meme' | 'track', targetId: string, weight: number): void {
    if (weight <= 0) return;
    if (targetType === 'track') {
      const track = trackById(targetId);
      if (!track) return;
      this.state.topArtists = bump(this.state.topArtists, track.artist, weight);
      this.state.topGenres = bump(this.state.topGenres, track.genres[0] ?? '', weight);
      return;
    }
    const meme = SEED_MEMES.find((entry) => entry.id === targetId);
    if (!meme) return;
    for (const tag of meme.tags) {
      const category = normalizeHumorTag(tag);
      if (!category) continue;
      this.state.topCategories = bump(this.state.topCategories, category, weight * 0.5);
    }
  }

  private rebuildMusic(): void {
    const rebuilt = tasteMusicVector({
      genres: this.state.topGenres,
      artists: this.state.topArtists,
    });
    this.state.fingerprint = { ...this.state.fingerprint, music: rebuilt };
  }

  /* ------------------------------------------------------- fingerprint */

  async getFingerprint(): Promise<Fingerprint> {
    return this.toFingerprint();
  }

  private toFingerprint(): Fingerprint {
    return {
      humor: roundVector(this.state.fingerprint.humor),
      music: roundVector(this.state.fingerprint.music),
      eventCount: this.state.fingerprint.eventCount,
      vectorVersion: this.state.fingerprint.vectorVersion,
      topArtists: [...this.state.topArtists].slice(0, 5),
      topGenres: [...this.state.topGenres].slice(0, 3),
      topCategories: [...this.state.topCategories].slice(0, 6),
      antiGenres: [...this.state.me.antiGenres],
      humorRead: this.humorRead(),
    };
  }

  private confidence(): number {
    const events = this.state.fingerprint.eventCount;
    return Number((0.5 + 0.5 * Math.min(1, events / 50)).toFixed(3));
  }

  private humorRead(): string {
    const axes = this.state.fingerprint.humor.slice(0, 4);
    const labels = ['affiliative', 'self-enhancing', 'aggressive', 'self-defeating'];
    const ranked = axes
      .map((value, index) => ({ label: labels[index] as string, value }))
      .sort((a, b) => b.value - a.value);
    const top = ranked.slice(0, 2).filter((entry) => entry.value > 0.01);
    if (!top.length) return 'Still reading your signals.';
    return `leans ${top.map((entry) => entry.label).join(' and ')}`;
  }

  /**
   * Settings -> "wipe and rebuild". Replays the stored calibration log from
   * scratch so the reset is reproducible rather than a random restart.
   */
  async rebuildHumorVector(): Promise<Fingerprint> {
    const humor = tasteHumorVector({
      content: this.state.topCategories,
      formats: DEFAULT_FORMATS,
      styles: DEFAULT_STYLES,
    });
    const music = tasteMusicVector({
      genres: this.state.topGenres,
      artists: this.state.topArtists,
    });
    this.state.fingerprint = {
      humor: roundVector(humor),
      music: roundVector(music),
      eventCount: this.state.eventLog.length,
      vectorVersion: this.state.fingerprint.vectorVersion + 1,
    };
    this.persist();
    return this.toFingerprint();
  }

  /* --------------------------------------------------------- matching */

  private myProfile(): TasteProfile {
    return {
      userId: this.state.me.userId,
      humor: this.state.fingerprint.humor,
      music: this.state.fingerprint.music,
      eventCount: this.state.fingerprint.eventCount,
      topArtists: this.state.topArtists,
      topGenres: this.state.topGenres,
      topCategories: this.state.topCategories,
      antiGenres: this.state.me.antiGenres,
      vibeReported: this.state.vibeReports.map((report) => report.to),
      lastActiveAt: this.now,
    };
  }

  async getCandidates(request: Partial<CandidateRequest> & { taste?: TasteProfile } = {}): Promise<CandidateCard[]> {
    // Default to the viewer's own vectors; `taste` is an offline-only override.
    const taste = request.taste ?? this.myProfile();
    const decided = new Set(Object.keys(this.state.decisions));
    const matched = new Set(Object.values(this.state.threads).map((thread) => thread.candidateId));

    const deck = rankCandidates(
      {
        userId: this.state.me.userId,
        mode: request.mode ?? this.state.me.mode,
        radiusKm: request.radiusKm ?? 25,
        ageMin: request.ageMin ?? 18,
        ageMax: request.ageMax ?? 45,
        onboarded: true,
        photoChecked: this.state.me.photoChecked,
        taste,
        limit: request.limit ?? 20,
        now: request.now ?? this.now,
      },
      this.candidates(),
    );

    return deck.candidates
      .filter((entry) => !decided.has(entry.profile.userId))
      .filter((entry) => !matched.has(entry.profile.userId))
      .filter((entry) => !this.state.blocks.includes(entry.profile.userId))
      .map((entry) => this.toCandidateCard(entry.profile));
  }

  private toCandidateCard(profile: Candidate): CandidateCard {
    const breakdown = tasteTwins(this.myProfile(), profile);
    const mutual = profile.userId.startsWith('u_ines') || profile.userId.startsWith('u_kai');
    const score = breakdown.calibrating ? Math.min(breakdown.score, 99) : breakdown.score;
    return {
      id: profile.userId,
      profile,
      tasteTwins: { ...breakdown, score },
      display: {
        name: profile.displayName,
        age: profile.age,
        km: profile.distanceKm,
        bio: profile.bio,
        score,
        label: scoreLabel(score),
        whyYouMatch: whyYouMatch({ ...breakdown, score }, { theirName: profile.displayName }),
        sharedArtistChips: breakdown.sharedArtists.slice(0, 2),
        sharedMemeChips: breakdown.sharedCategories
          .slice(0, 2)
          .map((category) => HUMOR_LABELS[(normalizeHumorTag(category) ?? 'relatable') as HumorTag]),
        calibrating: breakdown.calibrating,
      },
      /** Offline demo affordance; production reveals a mutual only on mutual. */
      likesYou: mutual,
    };
  }

  /* --------------------------------------------------------- decisions */

  async decide(candidateId: string, decision: 'pass' | 'resonate'): Promise<DecideResult> {
    const candidate = this.candidate(candidateId);
    if (!candidate) return { matched: false, threadId: null, candidate: null, icebreaker: null };

    this.state.decisions[candidateId] = decision;
    this.state.history.push(candidateId);

    if (decision === 'pass') {
      this.persist();
      this.trace({ type: 'decision', candidateId, decision });
      await this.emit();
      return { matched: false, threadId: null, candidate: this.toCandidateCard(candidate), icebreaker: null };
    }

    if (this.state.resonateUsed >= 1 && this.state.me.tier === 'free') {
      // Free tier: 1 Resonate a day. The card still records, the limit is UX.
      this.trace({ type: 'decision', candidateId, decision, blocked: 'resonate_cap' });
    }
    this.state.resonateUsed += 1;

    // Incoming likes stay hidden until a mutual happens. No paywall, no tease.
    const card = this.toCandidateCard(candidate);
    const matched = card.likesYou;

    let threadId: string | null = null;
    let icebreaker: string | null = null;

    if (matched) {
      threadId = idFor('t', candidateId);
      if (!this.state.threads[threadId]) {
        this.state.threads[threadId] = {
          id: threadId,
          matchId: idFor('m', candidateId),
          candidateId,
          unread: 0,
          messages: [
            {
              id: idFor('msg', threadId),
              from: 'them',
              body: 'ok but have you heard the key change in this one',
              kind: 'text',
              at: this.now - 6 * 60 * 1000,
              readAt: null,
            },
          ],
        };
      }
      icebreaker = `You both play ${this.sharedTitles(candidate)}`;
      this.state.duel = this.newDuel(this.state.threads[threadId].matchId);
    }

    this.persist();
    this.trace({ type: 'decision', candidateId, decision, matched });
    await this.emit();
    return { matched, threadId, candidate: card, icebreaker };
  }

  private sharedTitles(candidate: Candidate): string {
    const mine = new Set(this.state.topArtists.map((artist) => artist.toLowerCase()));
    const shared = candidate.topArtists.filter((artist) => mine.has(artist.toLowerCase()));
    if (!shared.length) return 'the same strangely specific songs';
    return shared.slice(0, 2).join(' and ');
  }

  /* -------------------------------------------------------------- chat */

  async getThreads(): Promise<Thread[]> {
    return Object.values(this.state.threads)
      .map((thread) => this.toThread(thread))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  async getMessages(threadId: string): Promise<Message[]> {
    const thread = this.state.threads[threadId];
    return thread ? thread.messages.map((message) => this.toMessage(message)) : [];
  }

  async sendMessage(threadId: string, body: string): Promise<Message> {
    const thread = this.state.threads[threadId];
    if (!thread) throw new Error('That conversation is not available.');

    const verdict = moderateText(body);
    if (!verdict.allowed) throw new Error('That message was held for review.');

    const message: StoredMessage = {
      id: idFor('msg', `${threadId}:${thread.messages.length}:${this.now}`),
      from: 'me',
      body,
      kind: 'text',
      at: this.now,
      readAt: this.now,
    };
    thread.messages.push(message);
    thread.unread = 0;
    this.persist();

    const outgoing = this.toMessage(message);
    this.emitMessage(threadId, outgoing);
    this.scheduleReply(thread);
    return outgoing;
  }

  async sendContent(threadId: string, payload: { kind: 'meme' | 'track'; id: string }): Promise<Message> {
    const thread = this.state.threads[threadId];
    if (!thread) throw new Error('That conversation is not available.');

    const message: StoredMessage = {
      id: idFor('msg', `${threadId}:${payload.id}:${this.now}`),
      from: 'me',
      body: null,
      kind: payload.kind,
      ref: payload.id,
      at: this.now,
      readAt: this.now,
    };
    thread.messages.push(message);
    this.persist();

    const outgoing = this.toMessage(message);
    this.emitMessage(threadId, outgoing);
    return outgoing;
  }

  subscribeToThread(threadId: string, listener: (message: Message) => void): () => void {
    const set = this.threadListeners.get(threadId) ?? new Set<(message: Message) => void>();
    set.add(listener);
    this.threadListeners.set(threadId, set);
    return () => set.delete(listener);
  }

  private emitMessage(threadId: string, message: Message): void {
    for (const listener of this.threadListeners.get(threadId) ?? []) listener(message);
  }

  private scheduleReply(thread: StoredThread): void {
    const replies = [
      'ha. okay. send the track',
      'this is exactly the kind of taste crime i like',
      'you get it. play it loud',
      'be honest, did you cry at the bridge',
      'adding it to my night bus playlist',
    ];
    const reply = replies[thread.messages.length % replies.length] as string;
    setTimeout(() => {
      const message: StoredMessage = {
        id: idFor('msg', `${thread.id}:reply:${thread.messages.length}`),
        from: 'them',
        body: reply,
        kind: 'text',
        at: Date.now(),
        readAt: null,
      };
      thread.messages.push(message);
      thread.unread += 1;
      this.persist();
      this.emitMessage(thread.id, this.toMessage(message));
    }, 1400);
  }

  private toThread(thread: StoredThread): Thread {
    const candidate = this.candidate(thread.candidateId);
    const last = thread.messages[thread.messages.length - 1];
    return {
      id: thread.id,
      matchId: thread.matchId,
      person: {
        id: thread.candidateId,
        name: candidate?.displayName ?? 'Match',
        km: candidate?.distanceKm ?? 0,
        score: candidate ? tasteTwins(this.myProfile(), candidate).score : 0,
        sharedTitles: candidate ? this.sharedTitles(candidate).split(' and ') : [],
      },
      unread: thread.unread,
      lastMessageAt: last?.at ?? 0,
      messages: thread.messages.map((message) => this.toMessage(message)),
    };
  }

  private toMessage(message: StoredMessage): Message {
    const kind = message.kind as 'text' | 'meme' | 'track';
    return {
      id: message.id,
      threadId: '',
      from: message.from,
      body: message.body,
      kind,
      meme: kind === 'meme' && message.ref ? this.toMeme(message.ref) : undefined,
      track: kind === 'track' && message.ref ? this.toTrack(message.ref) : undefined,
      at: message.at,
      readAt: message.readAt,
    };
  }

  /* ----------------------------------------------------------- safety */

  async submitSafetyAction(targetId: string, reason: SafetyReason, note?: string): Promise<SafetyReportResult> {
    const at = this.now;
    if (reason === 'block') {
      if (!this.state.blocks.includes(targetId)) this.state.blocks.push(targetId);
      this.persist();
      this.trace({ type: 'block', targetId });
      return { flow: reason, queued: true };
    }
    if (reason === 'vibe-report') {
      const value = note ?? 'Nothing in common';
      this.state.vibeReports.push({ to: targetId, reason: value, at });
      // Recalibration only: the other person is never notified and never penalised.
      this.persist();
      this.trace({ type: 'vibe-report', targetId, reason: value });
      return { flow: reason, queued: true };
    }
    this.state.reports.push({
      to: targetId,
      reason: note ?? 'Something else',
      detail: null,
      at,
    });
    this.persist();
    this.trace({ type: 'report', targetId, reason: note });
    return { flow: reason, queued: true, slaHours: 24 };
  }

  async listBlocks(): Promise<string[]> {
    return [...this.state.blocks];
  }

  async unblock(userId: string): Promise<void> {
    this.state.blocks = this.state.blocks.filter((id) => id !== userId);
    this.persist();
  }

  /* --------------------------------------------------------- sessions */

  async getEntitlements(): Promise<Entitlements> {
    if (this.state.entitlementDay !== startOfLocalDay(this.now)) {
      this.state.entitlementDay = startOfLocalDay(this.now);
      this.state.resonateUsed = 0;
      this.state.triviaUsed = 0;
      this.persist();
    }
    return entitlementsFor(this.state.me.tier, this.now);
  }

  async startListeningSession(input: ListeningSessionInput): Promise<ListeningSessionResult> {
    const entitlements = await this.getEntitlements();
    const usedToday = this.state.sessions
      .filter((session) => session.matchId === input.matchId)
      .reduce((total, session) => total + session.seconds, 0);
    const allowance = sessionAllowance(entitlements, usedToday);

    // A capped session is refused outright; no session row is created, so usage
    // can never be inflated by a client retrying against the cap.
    if (!allowance.allowed) {
      this.trace({ type: 'session_start', matchId: input.matchId, capped: true });
      return { id: '', startedAt: this.now, remainingSeconds: 0, allowed: false, reason: allowance.reason };
    }

    const session: StoredSession = {
      id: idFor('ls', `${input.matchId}:${this.state.sessions.length}`),
      matchId: input.matchId,
      trackId: input.trackId,
      startedAt: this.now,
      seconds: 0,
      ended: false,
    };
    this.state.sessions.push(session);
    this.persist();
    this.trace({ type: 'session_start', matchId: input.matchId, capped: false });

    return {
      id: session.id,
      startedAt: session.startedAt,
      remainingSeconds: allowance.remainingSeconds ?? FREE_SESSION_CAP_SECONDS,
      allowed: true,
      reason: null,
    };
  }

  async endListeningSession(sessionId: string, secondsUsed: number): Promise<void> {
    const session = this.state.sessions.find((entry) => entry.id === sessionId);
    if (!session) return;
    session.seconds = Math.max(session.seconds, secondsUsed);
    session.ended = true;
    this.persist();
    this.trace({ type: 'session_end', sessionId, seconds: session.seconds });
  }

  /* ------------------------------------------------------------ duels */

  private newDuel(matchId: string): DuelState {
    const memeIds = SEED_MEMES.slice(0, 5).map((meme) => meme.id);
    return {
      id: idFor('d', matchId),
      matchId,
      memeIds,
      picks: {},
      submitted: false,
      partnerSubmitted: false,
      verdict: null,
    };
  }

  async getDuel(matchId: string): Promise<DuelState | null> {
    if (!this.state.duel) {
      const thread = Object.values(this.state.threads).find((entry) => entry.matchId === matchId);
      this.state.duel = thread ? this.newDuel(matchId) : null;
      this.persist();
    }
    return this.state.duel && this.state.duel.matchId === matchId ? this.state.duel : null;
  }

  async submitDuel(duelId: string, picks: Record<string, 'a' | 'b'>): Promise<DuelState> {
    const duel = this.state.duel;
    if (!duel || duel.id !== duelId) throw new Error('That duel is no longer open.');
    duel.picks = picks;
    duel.submitted = true;
    // The partner submits independently; the reveal only fires on a mutual.
    duel.partnerSubmitted = Object.keys(picks).length === duel.memeIds.length;
    duel.verdict = duel.partnerSubmitted ? this.scoreDuel(duel) : null;
    this.persist();
    return duel;
  }

  private scoreDuel(duel: DuelState): { score: number; of: number; line: string } {
    const lines = [
      'Same damage. Suspiciously aligned.',
      'Mostly same damage. Concerning.',
      'Adjacent chaos. Respectable.',
      'Different damage. Send a meme anyway.',
    ];
    const score = Object.values(duel.picks).filter((pick, index) => pick === (index % 2 === 0 ? 'a' : 'b')).length;
    return { score, of: duel.memeIds.length, line: lines[Math.min(lines.length - 1, Math.floor(score / 1.5))] as string };
  }

  /* ------------------------------------------------------------ trust */

  async submitLiveness(input: LivenessInput): Promise<LivenessResult> {
    // Best-effort on-device check. Low confidence goes to a human queue; the UI
    // never says "verified identity".
    let status: LivenessResult['status'] = 'checked';
    if (!input.faceDetected || input.matchesProfilePhoto === false) status = 'rejected';
    else if (input.confidence < 0.72) status = 'review';

    const result: LivenessResult = {
      status,
      badge: 'photo checked',
      queuePosition: status === 'review' ? Math.floor(1 + (1 - input.confidence) * 9) : null,
    };
    this.state.liveness = result;
    if (status !== 'rejected') this.state.me.photoChecked = true;
    this.persist();
    this.trace({ type: 'liveness', status, confidence: input.confidence });
    return result;
  }

  async moderateText(text: string): Promise<ModerationVerdict> {
    return moderateText(text);
  }

  /* ------------------------------------------------- legal + data rights */

  async getLegalDocument(document: LegalDocument): Promise<LegalDoc> {
    return LEGAL_DOCUMENTS[document];
  }

  async requestDataExport(): Promise<DataExportResult> {
    const requestedAt = new Date(this.now).toISOString();
    this.state.exports.push({ requestedAt });
    this.persist();
    this.trace({ type: 'export-request', requestedAt });
    return { status: 'queued', requestedAt };
  }

  async requestAccountDeletion(): Promise<DeletionRequest> {
    this.state.deletion = requestDeletion(this.now);
    this.persist();
    this.trace({ type: 'delete-request', effectiveAt: this.state.deletion.effectiveAt });
    return this.state.deletion;
  }

  async cancelAccountDeletion(): Promise<DeletionRequest> {
    this.state.deletion = cancelDeletion();
    this.persist();
    this.trace({ type: 'delete-cancel' });
    return this.state.deletion;
  }
}

/* ------------------------------------------------------------- helpers */

const bump = (list: string[], value: string, weight: number): string[] => {
  if (!value) return list;
  const scores = new Map<string, number>(list.map((entry, index) => [entry, list.length - index]));
  scores.set(value, (scores.get(value) ?? 0) + weight);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([entry]) => entry);
};

const signalAxes = (signals: readonly string[]): Record<string, number> => {
  const laughs = signals.filter((signal) => signal === 'laugh').length;
  const total = Math.max(1, signals.length);
  return {
    affiliative: 0.25 + 0.5 * (laughs / total),
    self_enhancing: 0.2 + 0.4 * (laughs / total),
    aggressive: 0.1,
    self_defeating: 0.35 - 0.15 * (laughs / total),
  };
};

