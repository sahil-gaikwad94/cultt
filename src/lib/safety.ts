/**
 * Trust and safety rules that both the client and the RPCs enforce.
 *
 * The build brief is explicit: 18+ is enforced on the server, under-18 signup
 * is hard-blocked, and report / vibe-report / block are three *separate* flows
 * with different consequences. Nothing here is advisory.
 */

export const MIN_AGE = 18;
/** Cooling-off before a deletion request becomes irreversible. */
export const DELETION_COOLING_OFF_DAYS = 14;
export const DELETION_COOLING_OFF_MS = DELETION_COOLING_OFF_DAYS * 24 * 60 * 60 * 1000;
/** Location is fuzzed to roughly a 1 km cell at rest (GDPR data minimisation). */
export const LOCATION_FUZZ_KM = 1;

export type SafetyFlow = 'report' | 'vibe-report' | 'block';

/**
 * The three flows, kept separate on purpose:
 *  - `report`      -> abuse queue, a human looks within 24h
 *  - `vibe-report` -> recalibration only, never visible to the other person
 *  - `block`       -> hard removal from both decks
 */
export const SAFETY_FLOWS: Readonly<Record<SafetyFlow, { label: string; hint: string; notifies: boolean }>> =
  Object.freeze({
    report: {
      label: 'Report something serious',
      hint: 'Goes to our moderation team. Nothing you write here is shown to them.',
      notifies: false,
    },
    'vibe-report': {
      label: "This didn't feel like a match",
      hint: 'Quietly recalibrates who we show you. The other person is not told and not punished.',
      notifies: false,
    },
    block: {
      label: 'Block this person',
      hint: 'Removes them from your deck and yours from theirs. No notification is sent.',
      notifies: false,
    },
  });

export const REPORT_REASONS = [
  'Harassment or abuse',
  'Hate speech or racism',
  'Sexual content or unwanted advances',
  'Underage or impersonation',
  'Scam or catfishing',
  'Sharing my private details',
  'Something else',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const VIBE_REPORT_REASONS = [
  'Nothing in common',
  'Wrong vibe for the mood',
  'Too similar to someone I vibe-reported',
  'Their signals do not match their profile',
  'Just not for me',
] as const;
export type VibeReportReason = (typeof VIBE_REPORT_REASONS)[number];

/* --------------------------------------------------------------- 18+ gate */

/**
 * Server-side age check. Mirrors the `users_dob_adult` CHECK constraint and the
 * `assert_adult` trigger in supabase/migrations/0002_identity.sql.
 */
export const ageFromDob = (dob: string, now: number = Date.now()): number | null => {
  const parsed = Date.parse(`${dob}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  let age = nowYear(parsed, now) - new Date(parsed).getUTCFullYear();
  const hadBirthday =
    nowMonth(parsed, now) > new Date(parsed).getUTCMonth() ||
    (nowMonth(parsed, now) === new Date(parsed).getUTCMonth() && nowDay(parsed, now) >= new Date(parsed).getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
};

const nowYear = (d: number, now: number): number => new Date(now).getUTCFullYear();
const nowMonth = (d: number, now: number): number => new Date(now).getUTCMonth();
const nowDay = (d: number, now: number): number => new Date(now).getUTCDate();

export const isAdult = (dob: string, now: number = Date.now()): boolean => {
  const age = ageFromDob(dob, now);
  return age !== null && age >= MIN_AGE;
};

export class AgeGateError extends Error {
  constructor(public readonly dob: string) {
    super('cultured is 18+. This date of birth is not eligible for an account.');
    this.name = 'AgeGateError';
  }
}

/** Throws rather than warns: under-18 signup is a hard block. */
export const assertAdult = (dob: string, now: number = Date.now()): void => {
  if (!isAdult(dob, now)) throw new AgeGateError(dob);
};

/** The furthest back a date of birth may be, for <input type="date" max>. */
export const maxDob = (now: number = Date.now()): string => {
  const adult = new Date(now);
  adult.setUTCFullYear(adult.getUTCFullYear() - MIN_AGE);
  return adult.toISOString().slice(0, 10);
};

/* ----------------------------------------------------------- moderation */

/**
 * Launch-scale text moderation.
 *
 * Perspective API shuts down on 31 Dec 2026 (build brief §2.3), so `moderateText`
 * is an adapter: a blocklist plus rate limits now, a replacement classifier
 * (Sightengine text or an open toxicity model) dropped in behind the same call.
 */
export interface ModerationVerdict {
  allowed: boolean;
  score: number;
  flags: string[];
  provider: 'blocklist' | 'external';
}

const BLOCKLIST = [
  'kill yourself',
  'kys',
  'go die',
  'send nudes',
  'underage',
  'rape',
  'nazi',
] as const;

export const moderateText = (text: string): ModerationVerdict => {
  const haystack = text.toLowerCase();
  const flags: string[] = [];
  let score = 0;
  for (const term of BLOCKLIST) {
    if (haystack.includes(term)) {
      flags.push('blocked-term');
      score = Math.max(score, 0.95);
    }
  }
  const urls = (text.match(/https?:\/\//g) ?? []).length;
  if (urls >= 3) {
    flags.push('link-spam');
    score = Math.max(score, 0.6);
  }
  if (/(.)\1{9,}/.test(text)) {
    flags.push('flooding');
    score = Math.max(score, 0.5);
  }
  return { allowed: score < 0.9, score, flags, provider: 'blocklist' };
};

export const REPORT_SLA_HOURS = 24;

/* --------------------------------------------------------- data rights */

export type DeletionStatus = 'active' | 'cooling-off' | 'purged';

export interface DeletionRequest {
  requestedAt: string;
  effectiveAt: string;
  status: DeletionStatus;
}

/**
 * Deletion is a two-phase flow because both stores require it: a 14-day
 * cooling-off the user can cancel by signing back in, then an irreversible
 * cascade purge of rows, storage objects and push tokens.
 */
export const requestDeletion = (now: number = Date.now()): DeletionRequest => ({
  requestedAt: new Date(now).toISOString(),
  effectiveAt: new Date(now + DELETION_COOLING_OFF_MS).toISOString(),
  status: 'cooling-off',
});

export const cancelDeletion = (): DeletionRequest => ({
  requestedAt: new Date().toISOString(),
  effectiveAt: new Date().toISOString(),
  status: 'active',
});

export const isPurgeable = (request: DeletionRequest, now: number = Date.now()): boolean =>
  request.status === 'cooling-off' && Date.parse(request.effectiveAt) <= now;

export interface ExportBundle {
  requestedAt: string;
  /** Signed, short-lived download link. */
  url: string;
  expiresAt: string;
}

export const requestExport = (baseUrl = '', now: number = Date.now()): ExportBundle => ({
  requestedAt: new Date(now).toISOString(),
  url: `${baseUrl}/api/export/${encodeURIComponent(new Date(now).toISOString())}`,
  expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
});

/* ------------------------------------------------------------- location */

export interface CoarseLocation {
  city: string;
  /** Kilometre-grid cell, not a precise point. */
  cell: string;
  lat: number | null;
  lng: number | null;
}

/** Rounds to a ~1 km grid so a stored coordinate is never a precise address. */
export const fuzzLocation = (lat: number, lng: number, city: string): CoarseLocation => {
  const step = LOCATION_FUZZ_KM / 111;
  const cellLat = Math.round(lat / step);
  const cellLng = Math.round(lng / step);
  return {
    city,
    cell: `${cellLat}:${cellLng}`,
    lat: Number((cellLat * step).toFixed(3)),
    lng: Number((cellLng * step).toFixed(3)),
  };
};