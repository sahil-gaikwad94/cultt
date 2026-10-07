/**
 * v5 store types.
 *
 * Shapes follow §12 of the build brief, adapted to the existing `Repo`
 * contract in `src/lib/types.ts` (which uses `like | laugh | save` and
 * `meme | track`). The one deliberate divergence: the store keys items by
 * `kind: 'meme' | 'song'` because that is the vocabulary the v5 UI, the Vault
 * tabs and the copy deck all use. `toRepoKind()` bridges back to the adapter.
 */

export type ItemKind = 'meme' | 'song';

export interface ItemRef {
  kind: ItemKind;
  id: string;
}

/** Where a reaction was picked. Kept so the fingerprint can weight sources. */
export type ReactionSurface = 'deck' | 'pin' | 'story' | 'chat' | 'onboarding' | 'vault' | 'link';

export interface Reaction {
  itemId: string;
  kind: ItemKind;
  /** One of the tray emoji, or the legacy `❤️` carried over by the migration. */
  emoji: string;
  ts: number;
  surface: ReactionSurface;
}

export interface Save {
  itemId: string;
  kind: ItemKind;
  ts: number;
}

export type PinSlotKind = ItemKind | 'anthem';

export interface Pin {
  itemId: string;
  kind: PinSlotKind;
  /** 0-based position inside its slot kind. */
  slot: number;
  ts: number;
}

/** Local `YYYY-MM-DD`. Two independent counters, both reset at local midnight. */
export interface Limits {
  day: string;
  laughsUsed: number;
  resonatesUsed: number;
  /** Highest timestamp ever observed, so a rolled-back clock cannot mint budget. */
  lastObservedTs: number;
}

export interface Story {
  id: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
  /** Composition only: layers reference meme/song ids, never licensed bytes. */
  layers: unknown[];
  audience: 'everyone' | 'matches' | 'circle';
  hideFrom: string[];
  replyRule: 'react' | 'matches' | 'off';
}

/** Streak + game persistence. */
export interface Progress {
  /** Consecutive local days with at least one laugh. */
  laughStreak: number;
  /** Local `YYYY-MM-DD` of the last day a laugh was recorded. */
  lastLaughDay: string | null;
  /** NHIE ids already asked, so a round never repeats until the bank runs out. */
  nhieAsked: string[];
}

export interface StoreState {
  schemaVersion: number;
  reactions: Reaction[];
  saves: Save[];
  pins: Pin[];
  /** Item ids the Deck has already shown; persists across sessions. */
  seen: string[];
  /**
   * Item keys (`kind:id`) that have already consumed one of the day's laughs.
   * Removing a reaction does not refund it, so a laugh cannot be farmed by
   * toggling the same item on and off.
   */
  laughSpend: string[];
  limits: Limits;
  stories: Story[];
  progress: Progress;
}

/** The whole persisted payload, including anything from a newer schema. */
export interface PersistedState extends StoreState {
  /** Preserved verbatim when a newer build wrote this record. */
  future?: Record<string, unknown>;
}

export const emptyLimits = (): Limits => ({
  day: '',
  laughsUsed: 0,
  resonatesUsed: 0,
  lastObservedTs: 0,
});

export const emptyState = (schemaVersion: number): StoreState => ({
  schemaVersion,
  reactions: [],
  saves: [],
  pins: [],
  seen: [],
  laughSpend: [],
  limits: emptyLimits(),
  stories: [],
  progress: { laughStreak: 0, lastLaughDay: null, nhieAsked: [] },
});

/** `meme|song` → the adapter's `meme|track`. */
export const toRepoKind = (kind: ItemKind): 'meme' | 'track' => (kind === 'song' ? 'track' : 'meme');

/** Stable composite key for anything keyed by an item. */
export const itemKey = (kind: ItemKind, id: string): string => `${kind}:${id}`;

export const parseItemKey = (key: string): ItemRef | null => {
  const i = key.indexOf(':');
  if (i <= 0) return null;
  const kind = key.slice(0, i);
  if (kind !== 'meme' && kind !== 'song') return null;
  return { kind, id: key.slice(i + 1) };
};
