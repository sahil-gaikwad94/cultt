/**
 * Duel link growth engine — the parts that must be true no matter what the
 * UI does: two-party state, the both-submit reveal rule, quiet expiry, and the
 * watermark policy that only applies on the way out of the app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDuel,
  DUEL_TTL_MS,
  findDuel,
  joinDuel,
  submitPicks,
  watchDuel,
} from '../../src/data/duelStore';
import { DUEL_PROMPTS, duelVerdict } from '../../src/data/seed/duelPrompts';
import { renderDuelCard } from '../../src/duel/card';
import { fetchPreview, rememberPreview } from '../../src/lib/preview';
import type { DuelRecord } from '../../src/lib/types';

const allPicks = (pattern: ('a' | 'b')[]): Record<string, 'a' | 'b'> =>
  Object.fromEntries(DUEL_PROMPTS.map((p, i) => [p.id, pattern[i]]));

describe('duelStore — the two-party record', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('starts open with no verdict and an unguessable-but-short id', () => {
    const rec = createDuel('Alex');
    expect(rec.id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
    expect(rec.a.name).toBe('Alex');
    expect(rec.a.submittedAt).toBeNull();
    expect(rec.b.joinedAt).toBeNull();
    expect(rec.verdict).toBeNull();
    // each duel gets its own copy of the prompts: nobody mutates the seed
    expect(rec.prompts).not.toBe(DUEL_PROMPTS);
    expect(rec.prompts.length).toBe(5);
  });

  it('locks the creator side without revealing anything one-sided', () => {
    const rec = createDuel();
    const after = submitPicks(rec.id, 'a', allPicks(['a', 'a', 'b', 'a', 'b']));
    expect(after?.a.submittedAt).not.toBeNull();
    expect(after?.verdict).toBeNull(); // the reveal never happens alone
  });

  it('refuses a partial submission instead of half-revealing', () => {
    const rec = createDuel();
    const partial = { [DUEL_PROMPTS[0].id]: 'a' as const };
    expect(() => submitPicks(rec.id, 'a', partial)).toThrowError(/all five/i);
    expect(findDuel(rec.id)?.a.submittedAt).toBeNull();
  });

  it('computes the verdict only once both sides are in', () => {
    const rec = createDuel('Alex');
    submitPicks(rec.id, 'a', allPicks(['a', 'a', 'b', 'b', 'a']));
    const finished = joinDuel(rec.id, 'friend')!;
    const done = submitPicks(finished.id, 'b', allPicks(['a', 'a', 'a', 'b', 'a']))!;
    expect(done.verdict).not.toBeNull();
    expect(done.verdict?.score).toBe(4); // d1, d2, d4, d5 were picked identically
    expect(done.verdict?.of).toBe(5);
    // shared ids name only genuinely-equal prompts
    expect(done.verdict?.sharedPromptIds.sort()).toEqual(['d1', 'd2', 'd4', 'd5'].sort());
    // the joiner never types free text; their name stays what the flow allows
    expect(done.b.name).toBe('friend');
  });

  it('expires quietly after the TTL instead of nagging', () => {
    const rec = createDuel();
    submitPicks(rec.id, 'a', allPicks(['a', 'a', 'a', 'a', 'a']));
    expect(findDuel(rec.id)).not.toBeNull();
    vi.useFakeTimers({ now: Date.now() + DUEL_TTL_MS + 1_000 });
    expect(findDuel(rec.id)).toBeNull();
  });

  it('notifies watchers through the storage fallback', () => {
    const rec = createDuel();
    const seen: (DuelRecord | null)[] = [];
    const off = watchDuel(rec.id, (r) => seen.push(r));
    submitPicks(rec.id, 'a', allPicks(['b', 'b', 'b', 'b', 'b']));
    const ev = new Event('storage') as StorageEvent;
    Object.defineProperty(ev, 'key', { value: 'cultured2:duels' });
    window.dispatchEvent(ev);
    off();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]?.a.submittedAt).not.toBeNull();
  });

  it('verdict copy stays honest at every score', () => {
    expect(duelVerdict(5, 5).line).toBe('Same damage. Suspiciously aligned.');
    expect(duelVerdict(0, 5).line.startsWith('Different damage')).toBe(true);
    // no fake encouragement at zero — and no loss framing either
    expect(duelVerdict(0, 5).line).not.toMatch(/unfortunately|try again|missed/i);
  });
});

describe('duel card — watermark policy', () => {
  beforeEach(() => localStorage.clear());

  const record = (): DuelRecord => ({
    id: 'test01',
    createdAt: Date.now(),
    prompts: DUEL_PROMPTS,
    a: { name: 'Alex', picks: allPicks(['a', 'a', 'a', 'a', 'a']), submittedAt: Date.now() },
    b: { name: 'friend', picks: allPicks(['a', 'b', 'a', 'b', 'a']), submittedAt: Date.now(), joinedAt: Date.now() },
    verdict: { score: 2, of: 5, line: 'Adjacent chaos. Respectable.', sharedPromptIds: ['d1', 'd3'] },
  });

  const textsWith = (external: boolean): string[] => {
    const drawn: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === 'fillText') return (text: string): void => void drawn.push(String(text));
          if (prop === 'measureText') return (): { width: number } => ({ width: 10 });
          return typeof prop === 'string' ? (): void => undefined : undefined;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    renderDuelCard(canvas, record(), { size: 'story', external });
    return drawn;
  };

  it('never carries the share CTA inside the app', () => {
    const texts = textsWith(false);
    expect(texts.some((t) => /duel your friends/i.test(t))).toBe(false);
  });

  it('carries the CTA watermark when the card leaves the app', () => {
    const texts = textsWith(true);
    expect(texts.some((t) => /duel your friends/i.test(t))).toBe(true);
  });

  it('enforces its own pixel size on the canvas', () => {
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop: string) =>
          prop === 'measureText' ? (): { width: number } => ({ width: 10 }) : (): void => undefined,
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    renderDuelCard(canvas, record(), { size: 'story' });
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
  });
});

describe('preview provider stub', () => {
  beforeEach(() => localStorage.clear());

  it('answers with the honest status line instead of a broken player', async () => {
    const r = await fetchPreview('s1', { artist: 'Odessa Vale', title: 'Night Bus Choir', seconds: 7 });
    expect(r.ok).toBe(false);
    expect(r.url).toBeNull();
    expect(r.source).toBe('none');
    expect(r.status).toMatch(/no audio source connected/i);
    expect(r.status).toContain('7-second');
  });

  it('serves cached results with attribution when an adapter has stored one', async () => {
    rememberPreview('s2', 'https://example.test/clip.mp3', 'iTunes');
    const r = await fetchPreview('s2', { artist: 'a', title: 'b' });
    expect(r.ok).toBe(true);
    expect(r.source).toBe('cache');
    expect(r.attribution).toBe('iTunes');
    expect(r.seconds).toBe(7); // calibration default
  });
});
