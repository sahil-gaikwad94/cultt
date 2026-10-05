/**
 * The Repo contract.
 *
 * Screens never talk to a backend SDK directly; they talk to this interface.
 * Two adapters implement it: `MockRepo` (offline, runs the real matching engine
 * against local state) and `SupabaseRepo` (RPCs + realtime). Swapping backends
 * is a one-line change in src/data/index.ts.
 */

import type { Candidate, CandidateRequest, CandidateResult, Mode } from './matching/candidates';
import type { TasteProfile } from './matching/tasteTwins';
import type { HumorVector, MusicVector } from './matching/vector';
import type { EventKind } from './matching/update';
import type { DeletionRequest, ModerationVerdict } from './safety';
import type { Entitlements } from './entitlements';

export type Reaction = 'like' | 'laugh' | 'save';
export type Decision = 'pass' | 'resonate';
export type SafetyReason = 'report' | 'vibe-report' | 'block';
export type LegalDocument = 'privacy' | 'terms' | 'guidelines';

export type Tier = 'free' | 'premium';
export type FingerprintVisibility = 'everyone' | 'matches' | 'me';

export interface Session {
  userId: string;
  onboarded: boolean;
  /** Server-verified 18+ result. Never trusted from the client alone. */
  adult: boolean;
  authed: boolean;
  displayName: string;
  mode: Mode;
  tier: Tier;
}

export interface Me extends Session {
  bio: string;
  age: number;
  city: string;
  lookingFor: readonly Mode[];
  photoChecked: boolean;
  fingerprintVisibility: FingerprintVisibility;
  antiGenres: readonly string[];
}

export interface Meme {
  id: string;
  topic: string;
  text: string;
  alt: string;
  tags: readonly string[];
  bg: string;
  fg: string;
  ac: string;
  likes: number;
  laughs: number;
  liked: boolean;
  laughed: boolean;
  saved: boolean;
  /** Local Discovery card: how many people near you reacted to this. */
  nearbyCount: number | null;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  genres: readonly string[];
  previewUrl: string | null;
  previewSource: 'itunes' | 'deezer' | 'provider' | null;
  attribution: string | null;
  saved: boolean;
}

export interface FeedDrop {
  /** Local time the drop unlocks: 9:00 AM. */
  unlocksAt: string;
  meme: Meme;
  track: Track;
  streak: number;
  hint: string | null;
}

export interface CirclePost {
  id: string;
  authorId: string;
  authorName: string;
  kind: 'meme' | 'track';
  meme?: Meme;
  track?: Track;
  note: string | null;
  likes: number;
  laughs: number;
  remixOf: string | null;
}

export interface FeedPage {
  drop: FeedDrop;
  memes: Meme[];
  tracks: Track[];
  circles: CirclePost[];
  cursor: string | null;
}

export interface Fingerprint {
  humor: HumorVector;
  music: MusicVector;
  eventCount: number;
  vectorVersion: number;
  topArtists: string[];
  topGenres: string[];
  topCategories: string[];
  antiGenres: string[];
  /** Plain-language read of the humor axes. */
  humorRead: string;
}

export interface CandidateCard extends CandidateResult {
  /** Display payload the Match Matrix card renders. */
  display: {
    name: string;
    age: number;
    km: number;
    bio: string;
    score: number;
    label: string;
    whyYouMatch: string;
    sharedArtistChips: string[];
    sharedMemeChips: string[];
    calibrating: boolean;
  };
  /**
   * Whether this person has already Resonated with you.
   *
   * This is the *only* way a match is ever revealed: no paywall, no counter,
   * no "3 people liked you". Production reads it from a mutual-only server
   * projection, never from the other person's sent likes.
   */
  likesYou: boolean;
}

export interface DecideResult {
  matched: boolean;
  threadId: string | null;
  candidate: CandidateCard | null;
  icebreaker: string | null;
}

export interface Message {
  id: string;
  threadId: string;
  from: 'me' | 'them';
  body: string | null;
  kind: 'text' | 'meme' | 'track';
  meme?: Meme;
  track?: Track;
  at: number;
  readAt: number | null;
}

export interface Thread {
  id: string;
  matchId: string;
  person: {
    id: string;
    name: string;
    km: number;
    score: number;
    sharedTitles: string[];
  };
  unread: number;
  lastMessageAt: number;
  messages: Message[];
}

export interface SafetyReportResult {
  flow: SafetyReason;
  queued: boolean;
  /** Report only: the moderation SLA. */
  slaHours?: number;
}

export interface OnboardingPayload {
  dateOfBirth: string;
  displayName: string;
  mode: Mode;
  city: string;
  bio?: string;
  musicSource: 'manual' | 'lastfm' | 'apple' | 'spotify';
  lastfmUsername?: string;
  pickedTastes: string[];
  memeSignals: Array<{ memeId: string; kind: 'laugh' | 'meh' | 'skip' }>;
  audioSignals: Array<{ trackId: string; kind: 'react' | 'skip' }>;
  photoChecked: boolean;
  antiGenres: string[];
}

export interface OnboardingResult {
  session: Session;
  fingerprint: Fingerprint;
  /** Confidence after calibration; the Matrix shows "calibrating" below 10 events. */
  confidence: number;
}

export interface ProfilePatch {
  displayName?: string;
  bio?: string;
  prompts?: Array<{ promptId: string; answer: string }>;
  photos?: string[];
  fingerprintVisibility?: FingerprintVisibility;
  antiGenres?: string[];
  mode?: Mode;
}

export interface ListeningSessionInput {
  matchId: string;
  trackId: string;
  seats: number;
}

export interface ListeningSessionResult {
  id: string;
  startedAt: number;
  /** null when uncapped (premium or Playlist Pass). */
  remainingSeconds: number | null;
  allowed: boolean;
  reason: string | null;
}

export interface DuelState {
  id: string;
  matchId: string;
  memeIds: string[];
  picks: Record<string, 'a' | 'b'>;
  submitted: boolean;
  partnerSubmitted: boolean;
  verdict: { score: number; of: number; line: string } | null;
}

export interface LivenessInput {
  /** On-device result from ML Kit-style detection. */
  faceDetected: boolean;
  /** 0-1 confidence from the on-device liveness heuristic. */
  confidence: number;
  /** Whether the captured face matches a profile photo on device. */
  matchesProfilePhoto: boolean | null;
}

/** Anything a low-confidence or mismatched capture needs a human to review. */
export interface LivenessResult {
  status: 'checked' | 'review' | 'rejected';
  /** UI copy says "photo checked", never "verified identity". */
  badge: string;
  queuePosition: number | null;
}

export interface LegalDoc {
  title: string;
  body: string;
  /** Every legal page ships flagged until counsel signs off. */
  status: 'needs_lawyer_review' | 'approved';
  updatedAt: string;
}

export interface DataExportResult {
  status: 'queued';
  requestedAt: string;
}

export interface Repo {
  /* ---- session + profile ------------------------------------------- */
  getSession(): Promise<Session>;
  getMe(): Promise<Me>;
  updateProfile(patch: ProfilePatch): Promise<Me>;
  onAuthStateChange(listener: (session: Session | null) => void): () => void;

  /* ---- onboarding ---------------------------------------------------- */
  onboard(payload: OnboardingPayload): Promise<OnboardingResult>;

  /* ---- content ------------------------------------------------------- */
  getFeed(request?: { cursor?: string | null; limit?: number }): Promise<FeedPage>;
  getMeme(id: string): Promise<Meme | null>;
  getTrack(id: string): Promise<Track | null>;
  recordReaction(targetId: string, reaction: Reaction, targetType?: 'meme' | 'track'): Promise<void>;
  recordEvent(kind: EventKind, targetType: 'meme' | 'track', targetId: string, meta?: Record<string, unknown>): Promise<void>;

  /* ---- fingerprint + matching --------------------------------------- */
  getFingerprint(): Promise<Fingerprint>;
  /** Wipe-and-rebuild: replays stored calibration events onto a fresh vector. */
  rebuildHumorVector(): Promise<Fingerprint>;
  getCandidates(request: Partial<CandidateRequest> & Pick<CandidateRequest, 'taste'>): Promise<CandidateCard[]>;

  /* ---- decisions + chat --------------------------------------------- */
  decide(candidateId: string, decision: Decision): Promise<DecideResult>;
  getThreads(): Promise<Thread[]>;
  getMessages(threadId: string): Promise<Message[]>;
  sendMessage(threadId: string, body: string): Promise<Message>;
  sendContent(threadId: string, payload: { kind: 'meme' | 'track'; id: string }): Promise<Message>;
  /** Realtime message delivery. Returns an unsubscribe function. */
  subscribeToThread(threadId: string, listener: (message: Message) => void): () => void;

  /* ---- safety -------------------------------------------------------- */
  /**
 * The three flows are separate on purpose. `note` is the flow's own reason
 * string: a Report uses REPORT_REASONS, a vibe-report uses VIBE_REPORT_REASONS
 * (both from src/lib/safety.ts), and the server validates it against the flow.
 */
submitSafetyAction(targetId: string, reason: SafetyReason, note?: string): Promise<SafetyReportResult>;
  listBlocks(): Promise<string[]>;
  unblock(userId: string): Promise<void>;

  /* ---- sessions + duels --------------------------------------------- */
  startListeningSession(input: ListeningSessionInput): Promise<ListeningSessionResult>;
  endListeningSession(sessionId: string, secondsUsed: number): Promise<void>;
  getDuel(matchId: string): Promise<DuelState | null>;
  submitDuel(duelId: string, picks: Record<string, 'a' | 'b'>): Promise<DuelState>;

  /* ---- trust --------------------------------------------------------- */
  submitLiveness(input: LivenessInput): Promise<LivenessResult>;
  moderateText(text: string): Promise<ModerationVerdict>;
  getEntitlements(): Promise<Entitlements>;

  /* ---- legal + data rights ------------------------------------------- */
  getLegalDocument(document: LegalDocument): Promise<LegalDoc>;
  requestDataExport(): Promise<DataExportResult>;
  requestAccountDeletion(): Promise<DeletionRequest>;
  cancelAccountDeletion(): Promise<DeletionRequest>;
}

/** Shared adapter config, read once from the seam. */
export interface RepoConfig {
  backend: 'mock' | 'supabase';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  flags: {
    spotify: boolean;
    lastfm: boolean;
    appleMusic: boolean;
    phoneOtp: boolean;
    ugc: boolean;
    sound: boolean;
  };
}

export type { Candidate, CandidateRequest, TasteProfile };