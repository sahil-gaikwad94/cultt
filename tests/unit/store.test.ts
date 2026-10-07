/**
 * Regression tests for the v5 store — and specifically for build-brief bug
 * §4.1.1: "After liking and saving items, `You` shows Resonances/Saved/Laughs
 * given = 0 and 'Saved culture: Nothing saved yet'."
 *
 * Root cause (see docs/v5/DECISIONS.md D-03): two incompatible reaction stores.
 * `S.react[postId]` covered only the 10 hard-coded POSTS ids; the 122-card meme
 * corpus wrote to `S.mm = {l,s}` instead. `renderYou()` filtered
 * `S.react` down to ids present in `POSTS`, so every corpus like/save was
 * invisible. These tests pin the migrated behaviour: both shapes land in one
 * store, and the You-tab selectors see all of it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/store';
import {
  LEGACY_LIKE,
  laughBudget,
  laughedItemKeys,
  laughsGivenCount,
  pinsByKind,
  resonateBudget,
  savedItemKeys,
  savedCount,
} from '../../src/store/selectors';
import { LEGACY_KEY, SCHEMA_VERSION, migrateLegacyState, reconcile } from '../../src/store/migrate';
import type { LegacyState } from '../../src/store/migrate';
import { readV5Config } from '../../src/store/config';

const T0 = Date.parse('2026-10-06T12:00:00.000Z');

/** The exact bug scenario, in the legacy on-disk shape. */
const legacyBlob: LegacyState = {
  onboarded: true,
  // Likes/laughs/saves on the Daily Drop + circle posts (POSTS ids).
  react: {
    d1a: { l: 1, h: 1, s: 1 },
    d2b: { l: 0, h: 1, s: 0 },
    c2: { l: 1, h: 0, s: 1 },
  },
  // The same three intents on the 122-card corpus, which the old You tab dropped.
  mm: {
    l: { x1: 1, x4: 1, mk007: 1 },
    s: { x4: 1, mk007: 1 },
  },
  shelf: ['m:x4', 't:route9', 'm:mk007'],
};

/** A store whose clock the test controls. */
const timed = (
  start: number,
  config = readV5Config({ laughsPerDay: 15, resonatesPerDay: 15 }),
) => {
  let clock = start;
  const store = createStore({ storage: null, legacy: null, now: () => clock, config });
  return { store, at: (t: number) => (clock = t) };
};

describe('migration: the two legacy shapes collapse into one store', () => {
  it('folds POSTS reactions and corpus reactions into one reactions list', () => {
    const { state, imported } = migrateLegacyState(legacyBlob, T0);
    // d1a carries BOTH a heart and a laugh in the legacy shape; the laugh wins,
    // because v5 gives an item exactly one reaction.
    expect(imported.reactions).toBe(6);
    expect(state.reactions.map((r) => `${r.kind}:${r.itemId}:${r.emoji}`).sort()).toEqual(
      ['meme:c2:❤️', 'meme:d2b:🔥', 'meme:x1:❤️', 'meme:x4:❤️', 'meme:mk007:❤️', 'song:d1a:🔥'].sort(),
    );
  });

  it('maps the POSTS id table to the right item kind', () => {
    const { state } = migrateLegacyState(legacyBlob, T0);
    expect(state.reactions.find((r) => r.itemId === 'd1a')?.kind).toBe('song');
    expect(state.reactions.find((r) => r.itemId === 'd2b')?.kind).toBe('meme');
    expect(state.reactions.find((r) => r.itemId === 'c2')?.kind).toBe('meme');
  });

  it('folds saves from BOTH shapes — this is the bug', () => {
    const { state } = migrateLegacyState(legacyBlob, T0);
    // d1a + c2 from S.react, x4 + mk007 from S.mm
    expect(savedCount(state)).toBe(4);
    expect(savedItemKeys(state).sort()).toEqual(['meme:c2', 'meme:mk007', 'meme:x4', 'song:d1a'].sort());
  });

  it('counts laughs the way the You tab does, including corpus items', () => {
    const { state } = migrateLegacyState(legacyBlob, T0);
    // Only real laughs (🔥) count; the legacy hearts do not.
    expect(laughsGivenCount(state)).toBe(2);
    expect(laughedItemKeys(state).sort()).toEqual(['meme:d2b', 'song:d1a']);
  });

  it('imports the pin board in shelf order', () => {
    const { state } = migrateLegacyState(legacyBlob, T0);
    const pins = pinsByKind(state);
    expect(pins.meme.map((p) => p.itemId)).toEqual(['x4', 'mk007']);
    expect(pins.song.map((p) => p.itemId)).toEqual(['route9']);
    expect(pins.meme.map((p) => p.slot)).toEqual([0, 1]);
  });

  it('never resurrects a migrated laugh as a new spend', () => {
    const { state } = migrateLegacyState(legacyBlob, T0);
    expect(state.laughSpend.sort()).toEqual(['meme:d2b', 'song:d1a']);
  });

  it('tolerates a blob with nothing in it', () => {
    const { state, imported } = migrateLegacyState({}, T0);
    expect(state.reactions).toEqual([]);
    expect(state.saves).toEqual([]);
    expect(state.pins).toEqual([]);
    expect(imported).toEqual({ reactions: 0, saves: 0, pins: 0 });
  });

  it('ignores shelf entries it cannot parse', () => {
    const { state } = migrateLegacyState({ shelf: ['nonsense', 'm:', ':x', 'q:x1', 'm:x1'] }, T0);
    expect(state.pins).toHaveLength(1);
    expect(state.pins[0]).toMatchObject({ itemId: 'x1', kind: 'meme', slot: 0 });
  });
});

describe('reconcile: versioned, never destructive', () => {
  it('starts fresh when there is nothing on disk', () => {
    const result = reconcile(null, null, T0);
    expect(result.outcome).toBe('fresh');
    expect(result.state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('uses the legacy blob when there is no v5 record', () => {
    const result = reconcile(null, legacyBlob, T0);
    expect(result.outcome).toBe('legacy-only');
    expect(result.imported.saves).toBe(4);
  });

  it('does not re-import the legacy blob over a v5 record that already has data', () => {
    const first = reconcile(null, legacyBlob, T0).state;
    // The user then removed every save.
    const second = reconcile({ ...first, saves: [] }, legacyBlob, T0 + 1000);
    expect(second.outcome).toBe('current');
    expect(second.state.saves).toEqual([]);
    expect(second.imported.saves).toBe(0);
  });

  it('preserves unknown keys written by a newer build', () => {
    const result = reconcile(
      { schemaVersion: 99, reactions: [], saves: [], mixtapes: [{ id: 'm1' }] } as never,
      null,
      T0,
    );
    expect(result.outcome).toBe('newer-preserved');
    expect(result.preservedKeys).toContain('mixtapes');
    expect(result.state.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('store: reads and writes go through one place', () => {
  beforeEach(() => localStorage.clear());

  it('a corpus meme save shows up in the same selector a drop save does', async () => {
    const store = createStore({ storage: localStorage, legacy: null, now: () => T0 });
    await store.ready;

    store.setSaved('meme', 'x4', true); // "Today's memes"
    store.setSaved('song', 'd1a', true); // the Daily Drop

    expect(savedItemKeys(store.getState()).sort()).toEqual(['meme:x4', 'song:d1a']);
    expect(savedCount(store.getState())).toBe(2);
  });

  it('survives a reload from the same storage', async () => {
    const first = createStore({ storage: localStorage, legacy: null, now: () => T0 });
    await first.ready;
    first.react({ kind: 'meme', itemId: 'x1', emoji: '💀' });
    first.setSaved('meme', 'x1', true);
    await first.flush();

    const second = createStore({ storage: localStorage, legacy: null, now: () => T0 });
    await second.ready;
    expect(savedItemKeys(second.getState())).toEqual(['meme:x1']);
    expect(laughsGivenCount(second.getState())).toBe(1);
  });

  it('migrates a legacy blob on first boot, then persists the result', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyBlob));
    const store = createStore({ storage: localStorage, now: () => T0 });
    const result = await store.ready;

    expect(result.imported.saves).toBe(4);
    expect(laughsGivenCount(store.getState())).toBe(2);
    expect(savedItemKeys(store.getState())).toHaveLength(4);

    // Second boot reads the v5 record, not the legacy blob.
    const again = createStore({ storage: localStorage, now: () => T0 });
    const result2 = await again.ready;
    expect(result2.outcome).toBe('current');
    expect(result2.imported.saves).toBe(0);
    expect(savedItemKeys(again.getState())).toHaveLength(4);
  });

  it('leaves the legacy blob on disk so a rollback cannot lose data', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyBlob));
    const store = createStore({ storage: localStorage, now: () => T0 });
    await store.ready;
    store.setSaved('meme', 'x9', true);
    await store.flush();
    expect(JSON.parse(localStorage.getItem(LEGACY_KEY) as string).shelf).toEqual(legacyBlob.shelf);
  });

  it('notifies subscribers synchronously on an optimistic write', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    const listener = vi.fn();
    store.subscribe(listener);
    store.setSaved('meme', 'x1', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(savedCount(listener.mock.calls[0][0])).toBe(1);
  });
});

describe('limits: 15 laughs a day, reset at local midnight', () => {
  const at = (iso: string) => Date.parse(iso);

  const storeAt = (now: number, laughs = 15) =>
    createStore({
      storage: null,
      legacy: null,
      now: () => now,
      config: readV5Config({ laughsPerDay: laughs, resonatesPerDay: 15 }),
    });

  it('spends one laugh on the first reaction to an item', async () => {
    const store = storeAt(at('2026-10-06T09:00:00.000Z'));
    await store.ready;
    const result = store.react({ kind: 'meme', itemId: 'x1', emoji: '💀' });
    expect(result.ok).toBe(true);
    expect(store.getState().limits.laughsUsed).toBe(1);
  });

  it('changing the reaction on the same item is free', async () => {
    const store = storeAt(at('2026-10-06T09:00:00.000Z'));
    await store.ready;
    store.react({ kind: 'meme', itemId: 'x1', emoji: '💀' });
    store.react({ kind: 'meme', itemId: 'x1', emoji: '🗿' });
    store.react({ kind: 'meme', itemId: 'x1', emoji: '🔥' });
    expect(store.getState().limits.laughsUsed).toBe(1);
  });

  it('removing a reaction does not refund the laugh, so it cannot be farmed', async () => {
    const store = storeAt(at('2026-10-06T09:00:00.000Z'), 2);
    await store.ready;
    store.react({ kind: 'meme', itemId: 'x1', emoji: '💀' });
    expect(store.getState().limits.laughsUsed).toBe(1);

    store.removeReaction('meme', 'x1');
    // Putting it back is free — the item is in the spend ledger already.
    expect(store.react({ kind: 'meme', itemId: 'x1', emoji: '💀' }).ok).toBe(true);
    expect(store.getState().limits.laughsUsed).toBe(1);

    // A genuinely new item still costs one, and the cap still holds.
    expect(store.react({ kind: 'meme', itemId: 'x2', emoji: '💀' }).ok).toBe(true);
    expect(store.getState().limits.laughsUsed).toBe(2);
    expect(store.react({ kind: 'meme', itemId: 'x3', emoji: '💀' })).toMatchObject({ ok: false, reason: 'budget' });
  });

  it('the legacy heart never spends a laugh', async () => {
    const store = storeAt(at('2026-10-06T09:00:00.000Z'));
    await store.ready;
    store.react({ kind: 'meme', itemId: 'x1', emoji: LEGACY_LIKE });
    expect(store.getState().limits.laughsUsed).toBe(0);
    expect(laughsGivenCount(store.getState())).toBe(0);
  });

  it('refuses at the cap and reports how long until midnight', async () => {
    const now = at('2026-10-06T23:30:00.000Z');
    const store = storeAt(now, 2);
    await store.ready;
    store.react({ kind: 'meme', itemId: 'a', emoji: '💀' });
    store.react({ kind: 'meme', itemId: 'b', emoji: '💀' });
    const blocked = store.react({ kind: 'meme', itemId: 'c', emoji: '💀' });
    expect(blocked.ok).toBe(false);

    const budget = laughBudget(store.getState(), 2, now);
    expect(budget.left).toBe(0);
    expect(budget.used).toBe(2);
    // 23:30 UTC → 30 minutes to the next local midnight (container is UTC).
    expect(budget.msUntilReset).toBe(30 * 60 * 1000);
  });

  it('resets at local midnight', async () => {
    const before = at('2026-10-06T23:59:00.000Z');
    const after = at('2026-10-07T00:01:00.000Z');
    const { store, at: setClock } = timed(before, readV5Config({ laughsPerDay: 1 }));
    await store.ready;

    store.react({ kind: 'meme', itemId: 'a', emoji: '💀' });
    expect(laughBudget(store.getState(), 1, before).left).toBe(0);

    setClock(after);
    // The next reaction on a new item succeeds: the day rolled over.
    expect(store.react({ kind: 'meme', itemId: 'b', emoji: '💀' }).ok).toBe(true);
    expect(store.getState().limits.laughsUsed).toBe(1);
    expect(store.getState().limits.day).not.toBe(new Date(before).toISOString().slice(0, 10));
  });

  it('a rolled-back clock cannot mint a second budget', async () => {
    const late = at('2026-10-06T23:00:00.000Z');
    const store = createStore({
      storage: null,
      legacy: null,
      now: () => late,
      config: readV5Config({ laughsPerDay: 1 }),
    });
    await store.ready;
    store.react({ kind: 'meme', itemId: 'a', emoji: '💀' });
    expect(store.getState().limits.lastObservedTs).toBe(late);

    const earlier = at('2026-10-06T08:00:00.000Z');
    const budget = laughBudget(store.getState(), 1, earlier);
    // Same day, still spent — the monotonic guard wins over the earlier clock.
    expect(budget.used).toBe(1);
    expect(budget.left).toBe(0);
  });

  it('resonates are a separate counter', async () => {
    const store = createStore({
      storage: null,
      legacy: null,
      now: () => T0,
      config: readV5Config({ laughsPerDay: 15, resonatesPerDay: 2 }),
    });
    await store.ready;
    expect(store.spendResonate()).toEqual({ ok: true, left: 1 });
    expect(store.spendResonate()).toEqual({ ok: true, left: 0 });
    expect(store.spendResonate()).toEqual({ ok: false, reason: 'budget', left: 0 });
    expect(store.getState().limits.laughsUsed).toBe(0);
    store.refundResonate();
    expect(resonateBudget(store.getState(), 2, T0).left).toBe(1);
  });

  it('both caps come from remote config', () => {
    const config = readV5Config({ laughsPerDay: 7, resonatesPerDay: 3 });
    expect(config.laughsPerDay).toBe(7);
    expect(config.resonatesPerDay).toBe(3);
    expect(readV5Config({ laughsPerDay: -1 }).laughsPerDay).toBe(15);
    expect(readV5Config(null).resonatesPerDay).toBe(15);
  });
});

describe('store: pins, seen, stories, NHIE', () => {
  it('caps the pin board at 6 memes / 6 songs / 1 anthem', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    for (let i = 0; i < 7; i += 1) store.pin('meme', `m${i}`);
    expect(pinsByKind(store.getState()).meme).toHaveLength(6);
    store.pin('song', 's0');
    expect(store.pin('song', 's1').ok).toBe(true);
    store.pin('anthem', 's0');
    expect(store.pin('anthem', 's1').ok).toBe(false);
  });

  it('re-slots on unpin and never resurrects on reorder', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    ['a', 'b', 'c'].forEach((id) => store.pin('meme', id));
    store.unpin('meme', 'b');
    expect(pinsByKind(store.getState()).meme.map((p) => [p.itemId, p.slot])).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
    store.reorderPins('meme', ['c', 'a']);
    expect(pinsByKind(store.getState()).meme.map((p) => p.itemId)).toEqual(['c', 'a']);
  });

  it('markSeen is idempotent and append-only', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    store.markSeen(['a', 'b']);
    store.markSeen(['b', 'c']);
    expect(store.getState().seen).toEqual(['a', 'b', 'c']);
  });

  it('expires stories at createdAt + 12h', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    store.putStory({
      id: 's1',
      ownerId: 'me',
      createdAt: T0,
      expiresAt: T0 + 12 * 3600 * 1000,
      layers: [],
      audience: 'everyone',
      hideFrom: [],
      replyRule: 'react',
    });
    expect(store.expireStories()).toBe(0);

    const later = createStore({ storage: null, legacy: null, now: () => T0 + 12 * 3600 * 1000 + 1 });
    await later.ready;
    later.putStory({
      id: 's1',
      ownerId: 'me',
      createdAt: T0,
      expiresAt: T0 + 12 * 3600 * 1000,
      layers: [],
      audience: 'everyone',
      hideFrom: [],
      replyRule: 'react',
    });
    expect(later.expireStories()).toBe(1);
    expect(later.getState().stories).toEqual([]);
  });

  it('tracks asked NHIE ids so a round never repeats', async () => {
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    await store.ready;
    store.markNhieAsked(['nhie-001', 'nhie-002']);
    store.markNhieAsked(['nhie-002', 'nhie-003']);
    expect(store.getState().progress.nhieAsked).toEqual(['nhie-001', 'nhie-002', 'nhie-003']);
    store.resetNhieAsked();
    expect(store.getState().progress.nhieAsked).toEqual([]);
  });

  it('clearLocalData empties the store and the disk', async () => {
    const store = createStore({ storage: localStorage, legacy: null, now: () => T0 });
    await store.ready;
    store.setSaved('meme', 'x1', true);
    await store.flush();
    await store.clearLocalData();
    expect(savedCount(store.getState())).toBe(0);
    expect(localStorage.getItem('cultured@v5')).toBeNull();
  });
});

describe('boot path: the singleton the app actually uses', () => {
  it('boots with no options against the ambient localStorage', async () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyBlob));
    const { getStore, setStoreForTests } = await import('../../src/store');
    const store = getStore();
    const result = await store.ready;

    // jsdom has no IndexedDB, so the local adapter is the one that ran.
    expect(store.persistenceName).toBe('local');
    expect(result.imported.saves).toBe(4);
    expect(savedItemKeys(store.getState())).toHaveLength(4);
    expect(laughsGivenCount(store.getState())).toBe(2);

    // The store is reachable from the same bridge main.ts installs.
    store.setSaved('meme', 'x42', true);
    await store.flush();
    expect(JSON.parse(localStorage.getItem('cultured@v5') as string).saves).toHaveLength(5);

    setStoreForTests(null);
  });
});
