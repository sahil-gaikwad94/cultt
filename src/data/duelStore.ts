/**
 * The Duel store behind `MockRepo.duel`.
 *
 * Two-party state lives in its own localStorage key (`cultured2:duels`) rather
 * than in the per-repo state blob, because two tabs — one playing side a, one
 * playing side b — must see each other's writes. The seam's `cultured2:state`
 * blob would simply overwrite itself; this key is read-before-write on every
 * mutation, so both sides land. Cross-tab *notification* goes through
 * BroadcastChannel, with the `storage` event as the fallback when the channel
 * is unavailable (jsdom, older WebKit).
 *
 * That pairing is what lets the Playwright duel test drive both sides: one
 * browser context, two tabs, no server.
 */

import { DUEL_PROMPTS, duelVerdict } from './seed/duelPrompts';
import type { DuelPrompt, DuelRecord, DuelSide } from '../lib/types';

const DUELS_KEY = 'cultured2:duels';
const CHANNEL = 'cultured2:duels';
const DAY_MS = 86_400_000;
/** A duel link is a living-room moment, not a permanent record. */
export const DUEL_TTL_MS = 14 * DAY_MS;

export type StoredDuel = DuelRecord & { prompts: DuelPrompt[] };

const now = (): number => Date.now();

const readAll = (): Record<string, StoredDuel> => {
  try {
    const raw = localStorage.getItem(DUELS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredDuel>;
    // Expired duels die quietly: no verdict, no card, nothing to leak.
    const live: Record<string, StoredDuel> = {};
    for (const [id, rec] of Object.entries(parsed)) {
      if (rec && typeof rec === 'object' && now() - rec.createdAt < DUEL_TTL_MS) live[id] = rec;
    }
    return live;
  } catch {
    return {};
  }
};

const writeAll = (all: Record<string, StoredDuel>): void => {
  try {
    localStorage.setItem(DUELS_KEY, JSON.stringify(all));
  } catch {
    /* private mode: the duel stays in-memory through the caller */
  }
};

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newId = (): string => {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

export const findDuel = (id: string): StoredDuel | null => readAll()[id] ?? null;

export const putDuel = (rec: StoredDuel): StoredDuel => {
  const all = readAll();
  all[rec.id] = rec;
  writeAll(all);
  return rec;
};

export const createDuel = (displayName?: string): StoredDuel => {
  const rec: StoredDuel = {
    id: newId(),
    createdAt: now(),
    prompts: DUEL_PROMPTS.map((p) => ({ ...p, options: { a: { ...p.options.a }, b: { ...p.options.b } } })),
    a: { name: displayName?.trim().slice(0, 24) || null, picks: null, submittedAt: null },
    b: { name: null, picks: null, submittedAt: null, joinedAt: null },
    verdict: null,
  };
  return putDuel(rec);
};

export const joinDuel = (id: string, displayName?: string): StoredDuel | null => {
  const rec = findDuel(id);
  if (!rec) return null;
  if (!rec.b.joinedAt) {
    rec.b.joinedAt = now();
    // The name stays null unless the *creator* shared theirs; there is no
    // free-text field on the recipient flow, so the UI says "your friend".
    rec.b.name = displayName?.trim().slice(0, 24) || rec.b.name;
    putDuel(rec);
  }
  return rec;
};

const isSide = (side: 'a' | 'b'): side is 'a' | 'b' => side === 'a' || side === 'b';

export const submitPicks = (id: string, side: 'a' | 'b', picks: Record<string, 'a' | 'b'>): StoredDuel | null => {
  const rec = findDuel(id);
  if (!rec || !isSide(side)) return null;
  const complete = rec.prompts.every((p) => picks[p.id] === 'a' || picks[p.id] === 'b');
  if (!complete) throw new Error('A duel is only submitted with all five picks in.');
  const actor: DuelSide = { ...rec[side], picks: { ...picks }, submittedAt: now() };
  if (side === 'a') rec.a = actor;
  else rec.b = { ...actor, joinedAt: rec.b.joinedAt ?? now() };
  // The reveal only computes when both sides are genuinely in. Never partial.
  if (rec.a.submittedAt && rec.b.submittedAt) {
    const sharedPromptIds = rec.prompts
      .filter((p) => rec.a.picks?.[p.id] && rec.a.picks[p.id] === rec.b.picks?.[p.id])
      .map((p) => p.id);
    const score = sharedPromptIds.length;
    const of = rec.prompts.length;
    const v = duelVerdict(score, of);
    rec.verdict = { score, of, line: v.line, sharedPromptIds };
  }
  putDuel(rec);
  return rec;
};

/** Subscribe to duel updates: BroadcastChannel first, `storage` as fallback. */
export const watchDuel = (id: string, listener: (rec: StoredDuel | null) => void): (() => void) => {
  let channel: BroadcastChannel | null = null;
  const emit = (): void => listener(findDuel(id));
  const onStorage = (e: StorageEvent): void => {
    if (e.key === DUELS_KEY || e.key === null) emit();
  };
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent) => {
      if (e.data && (e.data as { id?: string }).id === id) emit();
    };
  }
  window.addEventListener('storage', onStorage);
  return () => {
    try {
      channel?.close();
    } catch {
      /* already closed */
    }
    window.removeEventListener('storage', onStorage);
  };
};

/** Called after every local mutation so same-tab watchers wake up too. */
export const announceDuel = (id: string): void => {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ id });
    ch.close();
  } catch {
    /* best effort; the storage event still fires in other tabs */
  }
};
