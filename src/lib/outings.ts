/**
 * Outings — the plans a user has saved from Concerts and Dine-in.
 *
 * Deliberately *not* part of `src/store`: the store is the fingerprint (what you
 * laugh at), and mixing "tickets I want" into it would change the matching
 * signal. This is a small, separate, persisted list under the same
 * `cultured2:` namespace, so "reset local data" still clears it and nothing
 * else in the app has to know about it.
 *
 * A record is a snapshot, not a reference to live inventory: it stores what the
 * user saved, at the moment they saved it.
 */

export type OutingKind = 'concert' | 'dine';

export interface Outing {
  /** Stable id: `${kind}:${refId}:${dateKey}` — one plan per event per day. */
  id: string;
  kind: OutingKind;
  /** The catalogue entry this came from. */
  refId: string;
  title: string;
  subtitle: string;
  /** Local `YYYY-MM-DD` of the plan, or `''` for "someday". */
  date: string;
  /** Local `HH:MM`, or `''` when the partner owns the slot. */
  time: string;
  /** Partner id the user chose, or null for "just remind me". */
  partner: string | null;
  city: string;
  createdAt: number;
}

const KEY = 'cultured2:outings';
const listeners = new Set<() => void>();

const isOuting = (value: unknown): boolean => {
  const o = value as Partial<Outing> | null;
  return !!o && (o.kind === 'concert' || o.kind === 'dine') && typeof o.refId === 'string';
};

/** Normalises a stored record: an id is derived when a build forgot to write one. */
const asOuting = (value: unknown): Outing => {
  const o = value as Outing;
  return { ...o, date: o.date ?? '', time: o.time ?? '', id: o.id ?? outingId(o.kind, o.refId, o.date ?? ''), createdAt: o.createdAt ?? 0 };
};

const read = (): Outing[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isOuting).map(asOuting) : [];
  } catch {
    return [];
  }
};

const write = (list: Outing[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Private mode: the plan still works for this session. */
  }
  listeners.forEach((fn) => fn());
};

export const outingId = (kind: OutingKind, refId: string, date = ''): string => `${kind}:${refId}:${date}`;

export const listOutings = (): Outing[] => read().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.createdAt - a.createdAt));

export const outingFor = (kind: OutingKind, refId: string): Outing | null =>
  read().find((outing) => outing.kind === kind && outing.refId === refId) ?? null;

export const isSaved = (kind: OutingKind, refId: string): boolean => outingFor(kind, refId) !== null;

/** Saves (or replaces) a plan. Returns the stored record. */
export const saveOuting = (outing: Omit<Outing, 'id' | 'createdAt'> & { createdAt?: number }): Outing => {
  const record: Outing = {
    ...outing,
    id: outingId(outing.kind, outing.refId, outing.date),
    createdAt: outing.createdAt ?? Date.now(),
  };
  const rest = read().filter((existing) => existing.id !== record.id);
  write([record, ...rest].slice(0, 60));
  return record;
};

export const removeOuting = (id: string): void => write(read().filter((outing) => outing.id !== id));

export const toggleOuting = (outing: Omit<Outing, 'id' | 'createdAt'>): { saved: boolean; record: Outing | null } => {
  const existing = read().find((o) => o.kind === outing.kind && o.refId === outing.refId);
  if (existing) {
    removeOuting(existing.id);
    return { saved: false, record: null };
  }
  return { saved: true, record: saveOuting(outing) };
};

export const clearOutings = (): void => write([]);

/** One subscription for every surface that shows a plan. */
export const subscribeOutings = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
