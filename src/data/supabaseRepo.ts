/**
 * The production adapter.
 *
 * Every screen reads and writes through the same `Repo` interface the offline
 * adapter implements. This one talks to Supabase: PostgREST for reads, the
 * plpgsql RPCs in supabase/migrations/0004_rpc.sql for anything that must be
 * atomic with a vector update, and Realtime for chat delivery.
 *
 * Nothing here is allowed to trust the client. The 18+ check, the Taste Twins
 * score, the mutual-reveal rule and the session cap are all server-side; this
 * adapter only passes the user's id, which comes from the session.
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { rankCandidates, type CandidateRequest, type Mode } from '../lib/matching/candidates';
import type { TasteProfile } from '../lib/matching/tasteTwins';
import { moderateText, type DeletionRequest, type ModerationVerdict } from '../lib/safety';
import { startOfLocalDay, type Entitlements } from '../lib/entitlements';
import { LEGAL_DOCUMENTS } from '../content/legal';
import type {
  Candidate,
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
  Message,
  Me,
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
import { scoreLabel, whyYouMatch, tasteTwins } from '../lib/matching/tasteTwins';
import { HUMOR_LABELS, type HumorTag, normalizeHumorTag } from '../lib/matching/taxonomy';

/** Thrown when a Supabase error should surface as a user-visible failure. */
export class RepoError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RepoError';
  }
}

const asRows = <T>(result: { data: unknown; error: { message: string; code?: string } | null }): T[] => {
  if (result.error) throw new RepoError(result.error.message, result.error.code);
  return (result.data ?? []) as T[];
};

export class SupabaseRepo implements Repo {
  private readonly client: SupabaseClient;
  private readonly channels = new Map<string, RealtimeChannel>();

  constructor(url: string, anonKey: string) {
    if (!url || !anonKey) {
      throw new RepoError('Supabase is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
    }
    this.client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }

  /** Exposed for auth helpers and tests; the UI never touches the client. */
  get supabase(): SupabaseClient {
    return this.client;
  }

  /* ------------------------------------------------------------ session */

  async getSession(): Promise<Session> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new RepoError('Not signed in.', error?.message);
    const me = await this.getMe();
    return {
      userId: me.userId,
      onboarded: me.onboarded,
      adult: me.adult,
      authed: true,
      displayName: me.displayName,
      mode: me.mode,
      tier: me.tier,
    };
  }

  async getMe(): Promise<Me> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('me_view', { p_user: null }),
    );
    const row = rows[0];
    if (!row) throw new RepoError('Profile not found. Finish onboarding first.');
    return {
      userId: String(row.user_id),
      onboarded: Boolean(row.onboarded),
      // `adult` is computed by the database, never by this client.
      adult: Boolean(row.adult),
      authed: true,
      displayName: String(row.display_name ?? ''),
      bio: String(row.bio ?? ''),
      age: Number(row.age ?? 0),
      city: String(row.city ?? ''),
      mode: (row.mode_default as Mode) ?? 'dating',
      lookingFor: (row.looking_for as Mode[]) ?? ['dating'],
      photoChecked: Boolean(row.verified_photo),
      tier: (row.tier as Me['tier']) ?? 'free',
      fingerprintVisibility: (row.fingerprint_visibility as Me['fingerprintVisibility']) ?? 'matches',
      antiGenres: (row.anti_genres as string[]) ?? [],
    };
  }

  async updateProfile(patch: ProfilePatch): Promise<Me> {
    asRows(
      await this.client.rpc('update_profile', {
        p_display_name: patch.displayName ?? null,
        p_bio: patch.bio ?? null,
        p_prompts: patch.prompts ?? null,
        p_photos: patch.photos ?? null,
        p_visibility: patch.fingerprintVisibility ?? null,
        p_anti_genres: patch.antiGenres ?? null,
        p_mode: patch.mode ?? null,
      }),
    );
    return this.getMe();
  }

  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange(() => {
      void this.getSession()
        .then(listener)
        .catch(() => listener(null));
    });
    return () => data.subscription.unsubscribe();
  }

  /* --------------------------------------------------------- onboarding */

  async onboard(payload: OnboardingPayload): Promise<OnboardingResult> {
    // `onboarding_complete` re-checks the 18+ rule server-side, writes the
    // calibration events and builds the initial vectors in one transaction.
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('onboarding_complete', {
        p_dob: payload.dateOfBirth,
        p_display_name: payload.displayName,
        p_mode: payload.mode,
        p_city: payload.city,
        p_bio: payload.bio ?? null,
        p_music_source: payload.musicSource,
        p_lastfm_username: payload.lastfmUsername ?? null,
        p_picked_tastes: payload.pickedTastes,
        p_meme_signals: payload.memeSignals,
        p_audio_signals: payload.audioSignals,
        p_photo_checked: payload.photoChecked,
        p_anti_genres: payload.antiGenres,
      }),
    );
    const row = rows[0] ?? {};
    return {
      session: {
        userId: String(row.user_id ?? ''),
        onboarded: true,
        adult: true,
        authed: true,
        displayName: payload.displayName,
        mode: payload.mode,
        tier: 'free',
      },
      fingerprint: {
        humor: (row.humor_vec as number[]) ?? [],
        music: (row.music_vec as number[]) ?? [],
        eventCount: Number(row.event_count ?? 0),
        vectorVersion: Number(row.vector_version ?? 1),
        topArtists: (row.top_artists as string[]) ?? [],
        topGenres: (row.top_genres as string[]) ?? [],
        topCategories: (row.top_categories as string[]) ?? [],
        antiGenres: payload.antiGenres,
        humorRead: String(row.humor_read ?? ''),
      },
      confidence: Number(row.confidence ?? 0.5),
    };
  }

  /* -------------------------------------------------------------- feed */

  async getFeed(request: { cursor?: string | null; limit?: number } = {}): Promise<FeedPage> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('feed', {
        p_cursor: request.cursor ?? null,
        p_limit: request.limit ?? 12,
      }),
    );

    const memes: Meme[] = [];
    const tracks: Track[] = [];
    let drop: FeedPage['drop'] | null = null;

    for (const row of rows) {
      if (row.kind === 'meme') {
        const meme = toMeme(row);
        memes.push(meme);
        if (row.is_drop) drop = { ...(drop as FeedDropPlaceholder), meme } as FeedPage['drop'];
      } else if (row.kind === 'track') {
        tracks.push(toTrack(row));
      }
    }

    const circles = asRows<Record<string, unknown>>(await this.client.rpc('circle_feed', { p_limit: 6 })).map(
      toCirclePost,
    );

    const dropRows = asRows<Record<string, unknown>>(await this.client.rpc('today_drop', {}));
    if (dropRows[0]) {
      drop = {
        unlocksAt: String(dropRows[0].unlocks_at),
        meme: toMeme(dropRows[0].meme as Record<string, unknown>),
        track: toTrack(dropRows[0].track as Record<string, unknown>),
        streak: Number(dropRows[0].streak ?? 0),
        hint: (dropRows[0].hint as string | null) ?? null,
      };
    }

    return {
      drop: drop ?? fallbackDrop(),
      memes,
      tracks,
      circles,
      cursor: (rows[0]?.next_cursor as string | null) ?? null,
    };
  }

  async getMeme(id: string): Promise<Meme | null> {
    const row = asRows<Record<string, unknown>>(
      await this.client.from('memes').select('*').eq('id', id).limit(1),
    )[0];
    return row ? toMeme(row) : null;
  }

  async getTrack(id: string): Promise<Track | null> {
    const row = asRows<Record<string, unknown>>(
      await this.client.from('tracks').select('*').eq('id', id).limit(1),
    )[0];
    return row ? toTrack(row) : null;
  }

  async recordReaction(targetId: string, reaction: Reaction, targetType: 'meme' | 'track' = 'meme'): Promise<void> {
    // `react` writes the event and updates the vector in one transaction.
    await this.client.rpc('react', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_kind: reaction,
    });
  }

  async recordEvent(
    kind: Parameters<Repo['recordEvent']>[0],
    targetType: 'meme' | 'track',
    targetId: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    await this.client.rpc('react', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_kind: kind,
      p_meta: meta,
    });
  }

  /* ------------------------------------------------------- fingerprint */

  async getFingerprint(): Promise<Fingerprint> {
    const row = asRows<Record<string, unknown>>(await this.client.rpc('fingerprint_view', {}))[0];
    if (!row) throw new RepoError('No fingerprint yet. React to a few things first.');
    return {
      humor: (row.humor_vec as number[]) ?? [],
      music: (row.music_vec as number[]) ?? [],
      eventCount: Number(row.event_count ?? 0),
      vectorVersion: Number(row.vector_version ?? 1),
      topArtists: (row.top_artists as string[]) ?? [],
      topGenres: (row.top_genres as string[]) ?? [],
      topCategories: (row.top_categories as string[]) ?? [],
      antiGenres: (row.anti_genres as string[]) ?? [],
      humorRead: String(row.humor_read ?? ''),
    };
  }

  async rebuildHumorVector(): Promise<Fingerprint> {
    await this.client.rpc('rebuild_humor_vector', {});
    return this.getFingerprint();
  }

  async getCandidates(request: Partial<CandidateRequest> & { taste?: TasteProfile } = {}): Promise<CandidateCard[]> {
    // The score is computed in SQL against the caller's stored vectors, so it
    // cannot be tampered with client-side. A `taste` override is ignored here on
    // purpose: only the mock adapter honours it.
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('candidates', {
        p_mode: request.mode ?? 'dating',
        p_radius_km: request.radiusKm ?? 25,
        p_age_min: request.ageMin ?? 18,
        p_age_max: request.ageMax ?? 45,
        p_limit: request.limit ?? 20,
      }),
    );

    return rows.map((row) => {
      const profile = row.profile as unknown as Candidate;
      const sharedArtists = (row.shared_artists as string[]) ?? [];
      const sharedCategories = (row.shared_categories as string[]) ?? [];
      const score = Number(row.taste_twins ?? 0);
      const breakdown = {
        score,
        humor: Number(row.humor_similarity ?? 0),
        music: Number(row.music_similarity ?? 0),
        shared: Number(row.shared_artist_similarity ?? 0),
        confidence: Number(row.confidence ?? 0.5),
        antiGenrePenalty: Number(row.anti_genre_penalty ?? 0),
        vibeReportPenalty: 0,
        raw: Number(row.raw_score ?? 0),
        calibrating: Boolean(row.calibrating),
        sharedArtists,
        sharedGenres: (row.shared_genres as string[]) ?? [],
        sharedCategories,
      };
      return {
        id: profile.userId,
        profile,
        tasteTwins: breakdown,
        display: {
          name: profile.displayName,
          age: profile.age,
          km: profile.distanceKm,
          bio: profile.bio,
          score,
          label: scoreLabel(score),
          whyYouMatch: whyYouMatch(breakdown, { theirName: profile.displayName }),
          sharedArtistChips: sharedArtists.slice(0, 2),
          sharedMemeChips: sharedCategories
            .slice(0, 2)
            .map((category) => HUMOR_LABELS[(normalizeHumorTag(category) ?? 'relatable') as HumorTag]),
          calibrating: Boolean(row.calibrating),
        },
        likesYou: Boolean(row.likes_you),
      };
    });
  }

  /* --------------------------------------------------------- decisions */

  async decide(candidateId: string, decision: 'pass' | 'resonate'): Promise<DecideResult> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('decide', { p_candidate: candidateId, p_decision: decision }),
    );
    const row = rows[0] ?? {};
    return {
      matched: Boolean(row.matched),
      threadId: (row.thread_id as string | null) ?? null,
      candidate: null,
      icebreaker: (row.icebreaker as string | null) ?? null,
    };
  }

  /* -------------------------------------------------------------- chat */

  async getThreads(): Promise<Thread[]> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('thread_list', {}));
    return rows.map((row) => ({
      id: String(row.thread_id),
      matchId: String(row.match_id),
      person: {
        id: String(row.person_id),
        name: String(row.display_name),
        km: Number(row.distance_km ?? 0),
        score: Number(row.taste_twins ?? 0),
        sharedTitles: (row.shared_artists as string[]) ?? [],
      },
      unread: Number(row.unread ?? 0),
      lastMessageAt: Date.parse(String(row.last_msg_at ?? '')) || 0,
      messages: [],
    }));
  }

  async getMessages(threadId: string): Promise<Message[]> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.from('messages').select('*').eq('thread_id', threadId).order('created_at'),
    );
    const me = await this.currentUserId();
    return rows.map((row) => toMessage(row, me));
  }

  async sendMessage(threadId: string, body: string): Promise<Message> {
    const verdict = await this.moderateText(body);
    if (!verdict.allowed) throw new RepoError('That message was held for review.');
    const rows = asRows<Record<string, unknown>>(
      await this.client.from('messages').insert({ thread_id: threadId, kind: 'text', body }).select(),
    );
    const message = toMessage(rows[0] ?? {}, await this.currentUserId());
    this.channels.get(threadId)?.send({ type: 'broadcast', event: 'message', payload: message });
    return message;
  }

  async sendContent(threadId: string, payload: { kind: 'meme' | 'track'; id: string }): Promise<Message> {
    const rows = asRows<Record<string, unknown>>(
      await this.client
        .from('messages')
        .insert({
          thread_id: threadId,
          kind: payload.kind,
          meme_id: payload.kind === 'meme' ? payload.id : null,
          track_id: payload.kind === 'track' ? payload.id : null,
        })
        .select(),
    );
    const message = toMessage(rows[0] ?? {}, await this.currentUserId());
    this.channels.get(threadId)?.send({ type: 'broadcast', event: 'message', payload: message });
    return message;
  }

  subscribeToThread(threadId: string, listener: (message: Message) => void): () => void {
    let channel = this.channels.get(threadId);
    if (!channel) {
      channel = this.client.channel(`thread:${threadId}`, {
        config: { private: true, broadcast: { self: false } },
      });
      void channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
          (payload) => {
            void this.currentUserId().then((me) => listener(toMessage(payload.new as Record<string, unknown>, me)));
          },
        )
        .subscribe();
      this.channels.set(threadId, channel);
    }
    channel.on('broadcast', { event: 'message' }, (payload) => {
      listener(payload.payload as Message);
    });
    return () => {
      // Channels are shared across screens; only drop the listener, not the socket.
      this.listenersOf(threadId).delete(listener);
    };
  }

  private listeners = new Map<string, Set<(message: Message) => void>>();

  private listenersOf(threadId: string): Set<(message: Message) => void> {
    const set = this.listeners.get(threadId) ?? new Set<(message: Message) => void>();
    this.listeners.set(threadId, set);
    return set;
  }

  /* ------------------------------------------------------------ safety */

  async submitSafetyAction(targetId: string, reason: SafetyReason, note?: string): Promise<SafetyReportResult> {
    if (reason === 'block') {
      await this.client.rpc('block_user', { p_target: targetId });
      return { flow: reason, queued: true };
    }
    if (reason === 'vibe-report') {
      await this.client.rpc('vibe_report', { p_target: targetId, p_reason: note ?? 'Nothing in common' });
      return { flow: reason, queued: true };
    }
    await this.client.rpc('report_user', { p_target: targetId, p_reason: note ?? 'Something else', p_detail: null });
    return { flow: reason, queued: true, slaHours: 24 };
  }

  async listBlocks(): Promise<string[]> {
    return asRows<{ blocked: string }>(await this.client.rpc('block_list', {})).map((row) => row.blocked);
  }

  async unblock(userId: string): Promise<void> {
    await this.client.rpc('unblock_user', { p_target: userId });
  }

  /* ---------------------------------------------------------- sessions */

  async getEntitlements(): Promise<Entitlements> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('entitlements_view', {}));
    const row = rows[0] ?? {};
    return {
      tier: (row.tier as 'free' | 'premium') ?? 'free',
      playlistPass: Boolean(row.playlist_pass),
      rewindCredits: Number(row.rewind_credits ?? 0),
      resonateToday: Number(row.resonate_today ?? 1),
      triviaToday: Number(row.trivia_today ?? 2),
      day: (row.day as string) ?? startOfLocalDay(),
    };
  }

  async startListeningSession(input: ListeningSessionInput): Promise<ListeningSessionResult> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('session_start', { p_match: input.matchId, p_track: input.trackId, p_seats: input.seats }),
    );
    const row = rows[0] ?? {};
    return {
      id: String(row.session_id ?? ''),
      startedAt: Date.parse(String(row.started_at ?? '')) || Date.now(),
      remainingSeconds: row.remaining_seconds === null ? null : Number(row.remaining_seconds),
      allowed: Boolean(row.allowed),
      reason: (row.reason as string | null) ?? null,
    };
  }

  async endListeningSession(sessionId: string, secondsUsed: number): Promise<void> {
    await this.client.rpc('session_end', { p_session: sessionId, p_seconds: secondsUsed });
  }

  /* ------------------------------------------------------------- duels */

  async getDuel(matchId: string): Promise<DuelState | null> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('duel_open', { p_match: matchId }));
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      matchId: String(row.match_id),
      memeIds: (row.meme_set as string[]) ?? [],
      picks: (row.picks as Record<string, 'a' | 'b'>) ?? {},
      submitted: Boolean(row.submitted),
      partnerSubmitted: Boolean(row.partner_submitted),
      verdict: (row.verdict as DuelState['verdict']) ?? null,
    };
  }

  async submitDuel(duelId: string, picks: Record<string, 'a' | 'b'>): Promise<DuelState> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('duel_submit', { p_duel: duelId, p_picks: picks }));
    const row = rows[0] ?? {};
    return {
      id: duelId,
      matchId: String(row.match_id ?? ''),
      memeIds: (row.meme_set as string[]) ?? [],
      picks: picks,
      submitted: true,
      partnerSubmitted: Boolean(row.partner_submitted),
      verdict: (row.verdict as DuelState['verdict']) ?? null,
    };
  }

  /* ------------------------------------------------------------- trust */

  async submitLiveness(input: LivenessInput): Promise<LivenessResult> {
    const rows = asRows<Record<string, unknown>>(
      await this.client.rpc('verify_liveness', {
        p_face_detected: input.faceDetected,
        p_confidence: input.confidence,
        p_matches_photo: input.matchesProfilePhoto,
      }),
    );
    const row = rows[0] ?? {};
    return {
      status: (row.status as LivenessResult['status']) ?? 'review',
      badge: 'photo checked',
      queuePosition: row.queue_position === null || row.queue_position === undefined ? null : Number(row.queue_position),
    };
  }

  async moderateText(text: string): Promise<ModerationVerdict> {
    // The database is the authority; this is the offline first pass that keeps
    // an obviously abusive message from ever leaving the device.
    const local = moderateText(text);
    if (!local.allowed) return local;
    try {
      const rows = asRows<Record<string, unknown>>(await this.client.rpc('moderate_text', { p_text: text }));
      const row = rows[0];
      if (!row) return local;
      return {
        allowed: Boolean(row.allowed),
        score: Number(row.score ?? 0),
        flags: (row.flags as string[]) ?? [],
        provider: (row.provider as ModerationVerdict['provider']) ?? 'external',
      };
    } catch {
      return local;
    }
  }

  /* --------------------------------------------------- legal + rights */

  async getLegalDocument(document: LegalDocument): Promise<LegalDoc> {
    const row = asRows<Record<string, unknown>>(
      await this.client.from('legal_documents').select('*').eq('slug', document).limit(1),
    )[0];
    if (!row) return LEGAL_DOCUMENTS[document];
    return {
      title: String(row.title),
      body: String(row.body),
      status: (row.status as LegalDoc['status']) ?? 'needs_lawyer_review',
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  async requestDataExport(): Promise<DataExportResult> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('export_data', {}));
    const row = rows[0] ?? {};
    return { status: 'queued', requestedAt: String(row.requested_at ?? new Date().toISOString()) };
  }

  async requestAccountDeletion(): Promise<DeletionRequest> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('delete_account', { p_confirm: true }));
    const row = rows[0] ?? {};
    return {
      requestedAt: String(row.requested_at ?? new Date().toISOString()),
      effectiveAt: String(row.effective_at ?? ''),
      status: 'cooling-off',
    };
  }

  async cancelAccountDeletion(): Promise<DeletionRequest> {
    const rows = asRows<Record<string, unknown>>(await this.client.rpc('cancel_account_deletion', {}));
    const row = rows[0] ?? {};
    return {
      requestedAt: String(row.requested_at ?? new Date().toISOString()),
      effectiveAt: String(row.effective_at ?? ''),
      status: 'active',
    };
  }

  private async currentUserId(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    return data.user?.id ?? '';
  }
}

/* ------------------------------------------------------------ row mappers */

type FeedDropPlaceholder = { meme: Meme };

const toMeme = (row: Record<string, unknown>): Meme => ({
  id: String(row.id ?? row.meme_id ?? ''),
  topic: String(row.topic ?? 'all'),
  text: String(row.caption_text ?? ''),
  alt: String(row.alt_text ?? row.caption_text ?? ''),
  tags: (row.categories as string[]) ?? [],
  bg: String(row.bg ?? '#EFE9DA'),
  fg: String(row.fg ?? '#141413'),
  ac: String(row.ac ?? '#F26B4E'),
  likes: Number(row.likes ?? 0),
  laughs: Number(row.laughs ?? 0),
  liked: Boolean(row.liked),
  laughed: Boolean(row.laughed),
  saved: Boolean(row.saved),
  nearbyCount: row.nearby_count === null || row.nearby_count === undefined ? null : Number(row.nearby_count),
});

const toTrack = (row: Record<string, unknown>): Track => ({
  id: String(row.id ?? row.track_id ?? ''),
  title: String(row.title ?? ''),
  artist: String(row.artist ?? ''),
  genres: (row.genres as string[]) ?? [],
  previewUrl: (row.preview_url as string | null) ?? null,
  previewSource: (row.preview_source as Track['previewSource']) ?? null,
  attribution: (row.preview_attribution as string | null) ?? null,
  saved: Boolean(row.saved),
});

const toCirclePost = (row: Record<string, unknown>): CirclePost => ({
  id: String(row.id),
  authorId: String(row.user_id),
  authorName: String(row.display_name ?? ''),
  kind: row.meme_id ? 'meme' : 'track',
  meme: row.meme ? toMeme(row.meme as Record<string, unknown>) : undefined,
  track: row.track ? toTrack(row.track as Record<string, unknown>) : undefined,
  note: (row.caption as string | null) ?? null,
  likes: Number(row.likes ?? 0),
  laughs: Number(row.laughs ?? 0),
  remixOf: (row.remix_of as string | null) ?? null,
});

const toMessage = (row: Record<string, unknown>, me: string): Message => {
  const sender = String(row.sender_id ?? '');
  const kind = (row.kind as Message['kind']) ?? 'text';
  return {
    id: String(row.id ?? ''),
    threadId: String(row.thread_id ?? ''),
    from: sender === me ? 'me' : 'them',
    body: (row.body as string | null) ?? null,
    kind,
    meme: kind === 'meme' ? toMeme({ id: row.meme_id }) : undefined,
    track: kind === 'track' ? toTrack({ id: row.track_id }) : undefined,
    at: Date.parse(String(row.created_at ?? '')) || Date.now(),
    readAt: row.read_at ? Date.parse(String(row.read_at)) : null,
  };
};

const fallbackDrop = (): FeedPage['drop'] => ({
  unlocksAt: new Date().toISOString(),
  meme: {
    id: '',
    topic: 'all',
    text: '',
    alt: '',
    tags: [],
    bg: '#EFE9DA',
    fg: '#141413',
    ac: '#F26B4E',
    likes: 0,
    laughs: 0,
    liked: false,
    laughed: false,
    saved: false,
    nearbyCount: null,
  },
  track: {
    id: '',
    title: '',
    artist: '',
    genres: [],
    previewUrl: null,
    previewSource: null,
    attribution: null,
    saved: false,
  },
  streak: 0,
  hint: null,
});

/**
 * Offline fallback: when the RPC is unreachable the same ranking runs on the
 * vectors already in memory, so the Matrix never shows an empty deck because of
 * a network blip.
 */
export const rankLocally = (
  taste: TasteProfile,
  pool: readonly Candidate[],
  request: Partial<CandidateRequest>,
): Candidate[] => {
  const deck = rankCandidates({
    userId: taste.userId,
    mode: request.mode ?? 'dating',
    radiusKm: request.radiusKm ?? 25,
    ageMin: request.ageMin ?? 18,
    ageMax: request.ageMax ?? 45,
    onboarded: true,
    photoChecked: true,
    taste,
    limit: request.limit ?? 20,
    now: request.now,
  }, pool);
  return deck.candidates.map((entry) => entry.profile);
};

export { tasteTwins };