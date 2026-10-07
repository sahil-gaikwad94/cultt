/**
 * People (build brief §6.4): the threads you actually have.
 *
 * The same rule as the Matrix applies here. Since D-27 the invented population
 * is gated off, so in a production build `getThreads()` returns an empty list —
 * and `copy.people.emptyChats` already says the right thing about it. The empty
 * state is the primary path, not a fallback.
 *
 * Nothing here fabricates a conversation. A thread only exists because two
 * people resonated, and the screen says how many there are rather than padding
 * the list.
 */

import { copy } from '../copy/index.ts';
import { haptics } from '../lib/haptics.ts';
import type { Thread } from '../lib/types.ts';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

/** Reads the repo the app installed at boot. Absent in unit tests. */
const repo = (): { getThreads(): Promise<Thread[]> } | null => {
  const bridge = (window as unknown as { Cultured?: { repo?: { getThreads(): Promise<Thread[]> } } }).Cultured;
  return bridge?.repo ?? null;
};

export interface PeopleHandle {
  destroy(): void;
}

export interface PeopleOptions {
  /** Opens one thread. */
  onOpenThread?: (id: string) => void;
  /** Sends the user to the Matrix to start one. */
  onGoToMatrix?: () => void;
}

/* ------------------------------------------------------------------ states */

export type PeopleState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'ready'; threads: Thread[] };

/**
 * Pure, so the ordering contract is testable without a DOM.
 *
 * Newest first, unread first within a tie — a thread you have not read should
 * not sit below one you have.
 */
export const peopleStateFor = (threads: Thread[] | null, failed = false): PeopleState => {
  if (failed) return { kind: 'error' };
  if (threads === null) return { kind: 'loading' };
  if (threads.length === 0) return { kind: 'empty' };
  const sorted = [...threads].sort((a, b) => {
    if (Boolean(a.unread) !== Boolean(b.unread)) return a.unread ? -1 : 1;
    return b.lastMessageAt - a.lastMessageAt;
  });
  return { kind: 'ready', threads: sorted };
};

/** "2m" / "3h" / "4d" — no locale machinery for a relative time. */
export const agoLabel = (ts: number, now: number): string => {
  const secs = Math.max(0, Math.round((now - ts) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const preview = (thread: Thread): string => {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return copy.people.systemMatch;
  /* Key off the declared `kind`, not the hydrated payload: a content-only
     message can arrive with `kind: 'meme'` and no `meme` object attached, and
     falling through to the system-match line would misdescribe it as the match
     banner. `body` is nullable for the same reason. */
  if (last.kind === 'meme') return 'Sent a meme';
  if (last.kind === 'track') return `Sent a song: ${last.track?.title ?? 'a song'}`;
  return last.body ?? copy.people.systemMatch;
};

/* -------------------------------------------------------------------- view */

const rowView = (thread: Thread, now: number) => `
  <li>
    <button type="button" class="v5-people-row" data-thread="${esc(thread.id)}">
      <span class="v5-people-avatar" aria-hidden="true">${esc(thread.person.name.slice(0, 1).toUpperCase())}</span>
      <span class="v5-people-text">
        <span class="v5-people-name">${esc(thread.person.name)}<time>${esc(agoLabel(thread.lastMessageAt, now))}</time></span>
        <span class="v5-people-preview">${esc(preview(thread))}</span>
        ${thread.person.sharedTitles.length ? `<span class="v5-people-shared">${esc(thread.person.sharedTitles.slice(0, 2).join(' · '))}</span>` : ''}
      </span>
      ${thread.unread ? `<span class="v5-people-unread">${esc(String(thread.unread))}</span>` : ''}
    </button>
  </li>`;

export const mountPeople = (host: HTMLElement, options: PeopleOptions = {}): PeopleHandle => {
  let threads: Thread[] | null = null;
  let failed = false;
  let disposed = false;

  const root = el<HTMLDivElement>('div', 'v5-people');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', copy.people.title);

  const now = () => Date.now();

  const paint = () => {
    if (disposed) return;
    const state = peopleStateFor(threads, failed);

    const head = `<header class="v5-people-head"><h2>${esc(copy.people.title)}</h2></header>`;

    if (state.kind === 'loading') {
      root.innerHTML = `${head}<div class="v5-people-empty"><p>${esc(copy.status.loading[0])}</p></div>`;
      return;
    }

    if (state.kind === 'error') {
      /* A failed fetch must not read as having no friends. */
      root.innerHTML = `${head}<div class="v5-people-empty"><p>${esc(copy.status.error)}</p></div>`;
      return;
    }

    if (state.kind === 'empty') {
      root.innerHTML = `${head}
        <div class="v5-people-empty">
          <span class="v5-people-glyph" aria-hidden="true">◌</span>
          <p>${esc(copy.people.emptyChats.body)}</p>
          <button type="button" class="v5-btn" data-matrix>${esc(copy.people.emptyChats.cta)}</button>
        </div>`;
      return;
    }

    root.innerHTML = `${head}
      <p class="v5-people-count">${esc(`${state.threads.length} ${state.threads.length === 1 ? 'thread' : 'threads'}`)}</p>
      <ul class="v5-people-list">${state.threads.map((t) => rowView(t, now())).join('')}</ul>`;
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-matrix]')) {
      haptics.play('light');
      options.onGoToMatrix?.();
      return;
    }
    const row = target.closest<HTMLElement>('[data-thread]');
    if (row) {
      haptics.play('light');
      options.onOpenThread?.(row.dataset.thread ?? '');
    }
  });

  host.textContent = '';
  host.appendChild(root);
  paint();

  const adapter = repo();
  if (adapter) {
    void adapter
      .getThreads()
      .then((result) => {
        if (disposed) return;
        threads = result;
        paint();
      })
      .catch(() => {
        if (disposed) return;
        failed = true;
        paint();
      });
  } else {
    threads = [];
    paint();
  }

  return {
    destroy() {
      disposed = true;
      root.remove();
    },
  };
};
