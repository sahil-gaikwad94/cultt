/**
 * The People screen (brief §6.4), driven through jsdom.
 *
 * Same invariant as the Matrix: since D-27 the invented population is gated off,
 * so `getThreads()` returns an empty list in production and the empty state is
 * the common case. It must read as an honest "nobody yet", never as a broken
 * list, and a failed fetch must not be mistaken for having no friends.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agoLabel, mountPeople, peopleStateFor } from '../../src/v5/people';
import type { Thread } from '../../src/lib/types';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');

const thread = (over: Partial<Thread> & { id: string }): Thread =>
  ({
    matchId: `match-${over.id}`,
    person: { id: over.id, name: 'Real Person', km: 3, score: 82, sharedTitles: ['Choirlift'] },
    unread: 0,
    lastMessageAt: T0 - 120_000,
    messages: [{ id: 'm1', threadId: over.id, from: 'them', body: 'that outro though', kind: 'text', at: T0 - 120_000, readAt: null }],
    ...over,
  }) as Thread;

let host: HTMLElement | null = null;
let handle: { destroy(): void } | null = null;

const withRepo = (threads: Thread[] | 'reject') => {
  const getThreads = threads === 'reject' ? () => Promise.reject(new Error('offline')) : () => Promise.resolve(threads);
  (window as unknown as { Cultured?: unknown }).Cultured = { repo: { getThreads } };
};

const mount = async (options: Parameters<typeof mountPeople>[1] = {}) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  handle = mountPeople(host, options);
  await Promise.resolve();
  await Promise.resolve();
  return host;
};

describe('peopleStateFor', () => {
  it('is loading before the fetch resolves', () => {
    expect(peopleStateFor(null)).toEqual({ kind: 'loading' });
  });

  it('is empty — not broken — when there are no threads', () => {
    expect(peopleStateFor([])).toEqual({ kind: 'empty' });
  });

  it('reports an error separately from having no friends', () => {
    expect(peopleStateFor(null, true)).toEqual({ kind: 'error' });
  });

  it('puts unread above read, then newest first', () => {
    const state = peopleStateFor([
      thread({ id: 'a', lastMessageAt: T0 - 1000, unread: 0 }),
      thread({ id: 'b', lastMessageAt: T0 - 9000, unread: 2 }),
      thread({ id: 'c', lastMessageAt: T0 - 5000, unread: 0 }),
    ]);
    expect(state.kind).toBe('ready');
    if (state.kind !== 'ready') return;
    // a is 1s old, c is 5s old: unread b first, then newest-to-oldest a, c.
    expect(state.threads.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('agoLabel', () => {
  it('never reports a future time as negative', () => {
    expect(agoLabel(T0 + 60_000, T0)).toBe('now');
  });

  it('steps minutes, hours, days', () => {
    expect(agoLabel(T0 - 30_000, T0)).toBe('now');
    expect(agoLabel(T0 - 5 * 60_000, T0)).toBe('5m');
    expect(agoLabel(T0 - 3 * 3600_000, T0)).toBe('3h');
    expect(agoLabel(T0 - 2 * 86400_000, T0)).toBe('2d');
  });
});

describe('the People screen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    delete (window as unknown as { Cultured?: unknown }).Cultured;
  });

  afterEach(() => {
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it('shows the honest empty state and a way to the Matrix', async () => {
    withRepo([]);
    const root = await mount();
    expect(root.querySelector('.v5-people-empty')).not.toBeNull();
    expect(root.textContent).toContain('No threads yet');
    expect(root.querySelector('[data-matrix]')).not.toBeNull();
    expect(root.querySelectorAll('.v5-people-row')).toHaveLength(0);
  });

  it('renders real threads with their preview', async () => {
    withRepo([thread({ id: 'a' })]);
    const root = await mount();
    expect(root.textContent).toContain('Real Person');
    expect(root.textContent).toContain('that outro though');
    expect(root.textContent).toContain('1 thread');
  });

  it('pluralises the count', async () => {
    withRepo([thread({ id: 'a' }), thread({ id: 'b' })]);
    const root = await mount();
    expect(root.textContent).toContain('2 threads');
  });

  it('does not report an error as having no friends', async () => {
    withRepo('reject');
    const root = await mount();
    expect(root.textContent).not.toContain('No threads yet');
    expect(root.querySelector('.v5-people-empty')).not.toBeNull();
  });

  it('does not render "null" for a content-only message', async () => {
    withRepo([
      thread({
        id: 'a',
        messages: [{ id: 'm1', threadId: 'a', from: 'me', body: null, kind: 'meme', at: T0, readAt: null }],
      }),
    ]);
    const root = await mount();
    expect(root.textContent).toContain('Sent a meme');
    expect(root.textContent).not.toContain('null');
  });

  it('calls onOpenThread with the tapped thread id', async () => {
    withRepo([thread({ id: 'a' })]);
    const onOpenThread = vi.fn();
    const root = await mount({ onOpenThread });
    root.querySelector<HTMLElement>('[data-thread]')!.click();
    expect(onOpenThread).toHaveBeenCalledWith('a');
  });

  it('calls onGoToMatrix from the empty state', async () => {
    withRepo([]);
    const onGoToMatrix = vi.fn();
    const root = await mount({ onGoToMatrix });
    root.querySelector<HTMLElement>('[data-matrix]')!.click();
    expect(onGoToMatrix).toHaveBeenCalledOnce();
  });

  it('renders the empty state when there is no repo at all', async () => {
    const root = await mount();
    expect(root.textContent).toContain('No threads yet');
  });

  it('tears down cleanly', async () => {
    withRepo([thread({ id: 'a' })]);
    await mount();
    handle?.destroy();
    handle = null;
    expect(document.querySelector('.v5-people')).toBeNull();
  });
});
