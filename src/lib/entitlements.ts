/**
 * Free-tier entitlements.
 *
 * The core loop is never gated: the Feed, the Matrix, unlimited messages and
 * the mutual-reveal of likes all stay free. Only these extras are capped, and
 * every cap matches PDF §10 exactly.
 */

export type Tier = 'free' | 'premium';
export type EntitlementKey = 'playlist_pass' | 'rewind_credit' | 'trivia_play' | 'resonate';

export interface Entitlements {
  tier: Tier;
  playlistPass: boolean;
  rewindCredits: number;
  /** Resonates left today; free tier gets 1, premium is unlimited. */
  resonateToday: number;
  /** Trivia plays left today; free tier gets 2. */
  triviaToday: number;
  day: string;
}

export const FREE_SESSION_CAP_SECONDS = 15 * 60;
export const FREE_RESONATE_PER_DAY = 1;
export const FREE_TRIVIA_PER_DAY = 2;
export const FREE_REWIND_CREDITS = 0;

export const startOfLocalDay = (now: number = Date.now()): string => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

export const entitlementsFor = (
  tier: Tier,
  now: number = Date.now(),
  playlistPass = false,
): Entitlements => ({
  tier,
  playlistPass,
  rewindCredits: tier === 'premium' ? Number.POSITIVE_INFINITY : FREE_REWIND_CREDITS,
  resonateToday: tier === 'premium' ? Number.POSITIVE_INFINITY : FREE_RESONATE_PER_DAY,
  triviaToday: tier === 'premium' ? Number.POSITIVE_INFINITY : FREE_TRIVIA_PER_DAY,
  day: startOfLocalDay(now),
});

export interface Allowance {
  allowed: boolean;
  /** Seconds remaining on a capped session; null when uncapped. */
  remainingSeconds: number | null;
  reason: string | null;
  upsell: string | null;
}

/** The 15-minute listening-session cap the prototype already showed. */
export const sessionAllowance = (
  entitlements: Entitlements,
  secondsUsed: number,
): Allowance => {
  if (entitlements.playlistPass || entitlements.tier === 'premium') {
    return { allowed: true, remainingSeconds: null, reason: null, upsell: null };
  }
  const remaining = Math.max(0, FREE_SESSION_CAP_SECONDS - secondsUsed);
  if (remaining <= 0) {
    return {
      allowed: false,
      remainingSeconds: 0,
      reason: 'session_cap',
      upsell: 'Playlist Pass removes the 15-minute cap without a subscription.',
    };
  }
  return { allowed: true, remainingSeconds: remaining, reason: null, upsell: null };
};

export const dailyAllowance = (
  entitlements: Entitlements,
  key: 'resonate' | 'trivia',
  usedToday: number,
): Allowance => {
  const limit = key === 'resonate' ? entitlements.resonateToday : entitlements.triviaToday;
  if (!Number.isFinite(limit)) {
    return { allowed: true, remainingSeconds: null, reason: null, upsell: null };
  }
  const remaining = Math.max(0, limit - usedToday);
  return {
    allowed: remaining > 0,
    remainingSeconds: null,
    reason: remaining > 0 ? null : `${key}_cap`,
    upsell:
      key === 'resonate'
        ? 'Premium unlocks unlimited Resonates.'
        : 'Premium unlocks unlimited music trivia.',
  };
};

export const rewindAllowance = (entitlements: Entitlements, creditsUsed: number): Allowance => {
  if (entitlements.rewindCredits === Number.POSITIVE_INFINITY || entitlements.rewindCredits > creditsUsed) {
    return { allowed: true, remainingSeconds: null, reason: null, upsell: null };
  }
  return {
    allowed: false,
    remainingSeconds: null,
    reason: 'rewind_cap',
    upsell: 'Rewind is a premium extra.',
  };
};

/** Read receipts stay opt-in for everyone, subscribers included. */
export const readReceiptsEnabled = (preference: boolean): boolean => preference === true;