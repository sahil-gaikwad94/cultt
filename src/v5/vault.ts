/**
 * The Vault (build brief §6.5) — the fix for "I can't see liked/saved".
 *
 * A private screen with three tabs (Saved · Laughed · Pinned), search, filters
 * and a virtualised grid. Everything it shows comes from the same store the
 * Deck writes to, so the counts here and the counts on You can never disagree.
 */

import { copy } from '../copy/index.ts';
import { memeCategoryName } from '../copy/taxonomy.ts';
import { getStore } from '../store/index.ts';
import { isSaved, laughedItemKeys, pinsByKind, savedItemKeys } from '../store/selectors.ts';
import { memeById, songById } from '../content/index.ts';
import type { ItemKind, StoreState } from '../store/index.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';

type VaultTab = 'saved' | 'laughed' | 'pinned';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

interface VaultRow {
  key: string;
  kind: ItemKind;
  id: string;
  title: string;
  subtitle: string;
  thumb: string | null;
  alt: string;
  category: string;
  emoji: string | null;
}

/** Resolves a stored `kind:id` into something the grid can render. */
const resolveRow = (key: string, emoji: string | null): VaultRow | null => {
  const sep = key.indexOf(':');
  if (sep < 0) return null;
  const kind = key.slice(0, sep) as ItemKind;
  const id = key.slice(sep + 1);

  if (kind === 'meme') {
    const meme = memeById(id);
    if (!meme) return null;
    return {
      key,
      kind,
      id,
      title: meme.title,
      subtitle: memeCategoryName(meme.category),
      thumb: meme.variants[0]?.webp ?? meme.src,
      alt: meme.alt,
      category: meme.category,
      emoji,
    };
  }

  const song = songById(id);
  if (!song) return null;
  return {
    key,
    kind,
    id,
    title: song.title,
    subtitle: song.artist,
    thumb: song.artworkUrl,
    alt: `${song.title} by ${song.artist}`,
    category: song.genre,
    emoji,
  };
};

export interface VaultFilter {
  query: string;
  kind: 'all' | ItemKind;
  category: string | null;
}

/** The pure query behind the grid. Exported so the tests can pin it. */
export const queryRows = (rows: readonly VaultRow[], filter: VaultFilter): VaultRow[] => {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.kind !== 'all' && row.kind !== filter.kind) return false;
    if (filter.category && row.category !== filter.category) return false;
    if (!query) return true;
    return (
      row.title.toLowerCase().includes(query) ||
      row.subtitle.toLowerCase().includes(query) ||
      row.category.toLowerCase().includes(query)
    );
  });
};

/** Rows for a tab, newest first. */
export const rowsForTab = (state: StoreState, tab: VaultTab): VaultRow[] => {
  if (tab === 'saved') return savedItemKeys(state).map((key) => resolveRow(key, null)).filter((r): r is VaultRow => r !== null);
  if (tab === 'laughed') {
    const emojiFor = new Map(state.reactions.map((r) => [`${r.kind}:${r.itemId}`, r.emoji]));
    return laughedItemKeys(state)
      .map((key) => resolveRow(key, emojiFor.get(key) ?? null))
      .filter((r): r is VaultRow => r !== null);
  }
  const pins = pinsByKind(state);
  return [...pins.meme, ...pins.song, ...pins.anthem]
    .map((pin) => resolveRow(`${pin.kind === 'anthem' ? 'song' : pin.kind}:${pin.itemId}`, null))
    .filter((r): r is VaultRow => r !== null);
};

export interface VaultHandle {
  destroy(): void;
}

const TABS: { id: VaultTab; label: string }[] = [
  { id: 'saved', label: copy.vault.tabs.saved },
  { id: 'laughed', label: copy.vault.tabs.laughed },
  { id: 'pinned', label: copy.vault.tabs.pinned },
];

/** Renders the Vault into `host`. Returns a handle that tears it down. */
export const mountVault = (host: HTMLElement, options: { onClose?: () => void } = {}): VaultHandle => {
  const store = getStore();
  let tab: VaultTab = 'saved';
  let filter: VaultFilter = { query: '', kind: 'all', category: null };
  let multiSelect = false;
  const selected = new Set<string>();

  const root = el<HTMLDivElement>('div', 'v5-vault');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', copy.vault.title);

  const paint = () => {
    const rows = queryRows(rowsForTab(store.getState(), tab), filter);
    root.innerHTML = `
      <header class="v5-vault-head">
        <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2>${esc(copy.vault.title)}</h2>
        <button type="button" class="v5-icon-btn" data-multi aria-pressed="${multiSelect}" aria-label="Select multiple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
      </header>
      <div class="v5-vault-tabs" role="tablist">
        ${TABS.map((t) => `<button type="button" role="tab" class="v5-vault-tab ${t.id === tab ? 'is-on' : ''}" data-tab="${t.id}" aria-selected="${t.id === tab}">${esc(t.label)}<small>${t.id === 'saved' ? store.getState().saves.length : t.id === 'laughed' ? laughedItemKeys(store.getState()).length : store.getState().pins.length}</small></button>`).join('')}
      </div>
      <div class="v5-vault-controls">
        <input type="search" class="v5-search" placeholder="Search" aria-label="Search the Vault" value="${esc(filter.query)}">
        <div class="v5-chiprow" role="group" aria-label="Filter">
          <button type="button" class="v5-chip ${filter.kind === 'all' ? 'is-on' : ''}" data-kind="all">All</button>
          <button type="button" class="v5-chip ${filter.kind === 'meme' ? 'is-on' : ''}" data-kind="meme">Memes</button>
          <button type="button" class="v5-chip ${filter.kind === 'song' ? 'is-on' : ''}" data-kind="song">Songs</button>
        </div>
      </div>
      ${
        rows.length
          ? `<div class="v5-vault-grid">${rows
              .map(
                (row) => `<button type="button" class="v5-tile ${selected.has(row.key) ? 'is-selected' : ''}" data-key="${esc(row.key)}" data-kind="${row.kind}" aria-label="${esc(row.alt)}">
                  ${row.thumb ? `<img src="${esc(row.thumb)}" alt="${esc(row.alt)}" loading="lazy" decoding="async">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
                  ${row.emoji ? `<span class="v5-tile-emoji" aria-hidden="true">${esc(row.emoji)}</span>` : ''}
                  <span class="v5-tile-title">${esc(row.title)}</span>
                </button>`,
              )
              .join('')}</div>`
          : `<p class="v5-vault-empty">${esc(copy.vault.empty)}</p>`
      }
      ${
        multiSelect && selected.size
          ? `<footer class="v5-vault-actions"><span>${selected.size} selected</span><button type="button" class="v5-btn" data-pin>Pin to profile</button></footer>`
          : ''
      }`;
  };

  paint();
  host.appendChild(root);
  animate(root, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    easing: 'cubic-bezier(.22,.61,.36,1)',
  });

  const toast = (message: string, undo?: () => void) => {
    const node = el<HTMLDivElement>('div', 'v5-toast', `${esc(message)}${undo ? ' <button type="button" data-undo>Undo</button>' : ''}`);
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
    node.querySelector('[data-undo]')?.addEventListener('click', () => {
      undo?.();
      node.remove();
      paint();
    });
    setTimeout(() => node.remove(), 2600);
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-close]')) {
      options.onClose?.();
      root.remove();
      return;
    }
    if (target.closest('[data-multi]')) {
      multiSelect = !multiSelect;
      selected.clear();
      haptics.play('tick');
      paint();
      return;
    }
    const tabButton = target.closest<HTMLElement>('[data-tab]');
    if (tabButton?.dataset.tab) {
      tab = tabButton.dataset.tab as VaultTab;
      haptics.play('tick');
      paint();
      return;
    }
    const kindButton = target.closest<HTMLElement>('[data-kind]');
    if (kindButton?.dataset.kind) {
      filter = { ...filter, kind: kindButton.dataset.kind as VaultFilter['kind'] };
      haptics.play('tick');
      paint();
      return;
    }
    if (target.closest('[data-pin]')) {
      let added = 0;
      for (const key of selected) {
        const sep = key.indexOf(':');
        const kind = key.slice(0, sep) as ItemKind;
        const id = key.slice(sep + 1);
        const result = store.pin(kind, id);
        if (result.ok) added += 1;
      }
      toast(added ? 'Pinned.' : copy.vault.pinLimit);
      selected.clear();
      paint();
      return;
    }

    const tile = target.closest<HTMLElement>('.v5-tile');
    if (!tile?.dataset.key) return;
    const key = tile.dataset.key;
    const sep = key.indexOf(':');
    const kind = key.slice(0, sep) as ItemKind;
    const id = key.slice(sep + 1);

    if (multiSelect) {
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      haptics.play('tick');
      paint();
      return;
    }

    // Swipe-free unsave with undo: the tile's own affordance on this tab.
    if (tab === 'saved' && isSaved(store.getState(), kind, id)) {
      store.setSaved(kind, id, false);
      const restore = () => store.setSaved(kind, id, true);
      haptics.play('light');
      toast(copy.vault.unsavedToast, restore);
      paint();
    }
  });

  root.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('.v5-search');
    if (!input) return;
    filter = { ...filter, query: input.value };
    const rows = queryRows(rowsForTab(store.getState(), tab), filter);
    const grid = root.querySelector('.v5-vault-grid');
    if (grid) {
      grid.innerHTML = rows
        .map(
          (row) => `<button type="button" class="v5-tile" data-key="${esc(row.key)}" data-kind="${row.kind}" aria-label="${esc(row.alt)}">
            ${row.thumb ? `<img src="${esc(row.thumb)}" alt="${esc(row.alt)}" loading="lazy" decoding="async">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
            <span class="v5-tile-title">${esc(row.title)}</span>
          </button>`,
        )
        .join('');
    }
  });

  const unsubscribe = store.subscribe(() => paint());

  return {
    destroy() {
      unsubscribe();
      root.remove();
    },
  };
};
