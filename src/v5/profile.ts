/**
 * Your profile, as a wall (build brief §6.3, design direction "The Gallery").
 *
 * Not a form. A gallery: the anthem on the top shelf, pinned memes hung in a
 * grid, pinned songs as a tracklist, and the Fingerprint — one Contour and the
 * archetype it resolves to — as the placard by the door.
 *
 * Editing is pinning. There is no "add content" button because there is nothing
 * to add: everything on the wall came from a reaction in the Deck. That is what
 * makes it a fingerprint rather than a bio.
 */

import { copy } from '../copy/index.ts';
import { archetypeFor, axisLabel, memeCategoryName } from '../copy/taxonomy.ts';
import { getStore } from '../store/index.ts';
import { PINK_CAPS, pinsByKind } from '../store/selectors.ts';
import { memeById, songById } from '../content/index.ts';
import type { ItemKind, StoreState } from '../store/index.ts';
import type { PinSlotKind } from '../store/types.ts';
import { axisAffinity } from './deck.ts';
import { axisVector } from './reactions.ts';
import { createContour } from './contour.ts';
import { getQuality } from './quality.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

/* ------------------------------------------------------------------- read */

export interface WallSlot {
  key: string;
  kind: ItemKind;
  id: string;
  title: string;
  subtitle: string;
  thumb: string | null;
  alt: string;
  slot: number;
}

export interface Wall {
  anthem: WallSlot | null;
  memes: WallSlot[];
  songs: WallSlot[];
  /** Slots still free per kind, so the UI can say "2 of 6" honestly. */
  room: Record<PinSlotKind, number>;
  /** The Fingerprint: archetype plus a ranked axis breakdown. */
  fingerprint: {
    archetype: { name: string; line: string } | null;
    axes: { label: string; share: number }[];
    /** 0..1 — how far the reactions concentrate on one axis. */
    clarity: number;
    /** Number of reactions the reading is based on. */
    sample: number;
  };
}

const slotFrom = (kind: PinSlotKind, itemId: string, slot: number): WallSlot | null => {
  const asItem = kind === 'anthem' ? 'song' : kind;
  if (asItem === 'meme') {
    const meme = memeById(itemId);
    if (!meme) return null;
    return {
      key: `meme:${itemId}`,
      kind: 'meme',
      id: itemId,
      title: meme.title,
      subtitle: memeCategoryName(meme.category),
      thumb: meme.variants.at(-1)?.webp ?? meme.src,
      alt: meme.alt,
      slot,
    };
  }
  const song = songById(itemId);
  if (!song) return null;
  return {
    key: `song:${itemId}`,
    kind: 'song',
    id: itemId,
    title: song.title,
    subtitle: song.artist,
    thumb: song.artworkUrl,
    alt: `${song.title} by ${song.artist}`,
    slot,
  };
};

/**
 * Reads the whole wall off the store. Pure, so the tests can pin it: the wall
 * is a projection of state, never a second copy of it.
 */
export const readWall = (state: StoreState): Wall => {
  const pins = pinsByKind(state);
  const map = (list: { itemId: string; slot: number }[], kind: PinSlotKind): WallSlot[] =>
    list.map((pin) => slotFrom(kind, pin.itemId, pin.slot)).filter((slot): slot is WallSlot => slot !== null);

  const vector = axisVector(state.reactions);
  const total = Object.values(vector).reduce((sum, value) => sum + (value ?? 0), 0);
  const axes = Object.entries(vector)
    .map(([axis, value]) => ({ label: axisLabel(axis), share: total ? (value ?? 0) / total : 0 }))
    .sort((a, b) => b.share - a.share);
  const found = archetypeFor(vector);

  return {
    anthem: pins.anthem.length ? slotFrom('anthem', pins.anthem[0]!.itemId, pins.anthem[0]!.slot) : null,
    memes: map(pins.meme, 'meme'),
    songs: map(pins.song, 'song'),
    room: {
      meme: PINK_CAPS.meme - pins.meme.length,
      song: PINK_CAPS.song - pins.song.length,
      anthem: PINK_CAPS.anthem - pins.anthem.length,
    },
    fingerprint: {
      archetype: found ? { name: found.archetype.name, line: found.archetype.line } : null,
      axes,
      clarity: axes[0]?.share ?? 0,
      sample: state.reactions.length,
    },
  };
};

/* ----------------------------------------------------------------- render */

export interface ProfileHandle {
  destroy(): void;
}

export interface ProfileOptions {
  onClose?: () => void;
  /** Opens a slot's source item in the Deck. */
  onOpenItem?: (kind: ItemKind, id: string) => void;
  /**
   * Mounted as the "You" tab inside `#s-you` rather than as a modal layer.
   * Drops the dialog semantics and the close button — there is nothing to
   * close back to when the wall *is* the screen.
   */
  embedded?: boolean;
}

const tile = (slot: WallSlot, editing: boolean) => `<button type="button" class="v5-wall-tile ${editing ? 'is-editing' : ''}" data-key="${esc(slot.key)}" data-kind="${slot.kind}" data-id="${esc(slot.id)}" aria-label="${esc(slot.alt)}">
  ${slot.thumb ? `<img src="${esc(slot.thumb)}" alt="${esc(slot.alt)}" loading="lazy" decoding="async">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
  <span class="v5-tile-title">${esc(slot.title)}</span>
</button>`;

export const mountProfile = (host: HTMLElement, options: ProfileOptions = {}): ProfileHandle => {
  const store = getStore();
  let editing = false;

  const embedded = options.embedded === true;
  const root = el<HTMLDivElement>('div', 'v5-profile');
  if (embedded) {
    root.setAttribute('role', 'region');
  } else {
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
  }
  root.setAttribute('aria-label', 'Your profile');

  /* The Fingerprint canvas is recreated on every repaint, so the previous
     contour has to be torn down first or the loops pile up. */
  const contours: { stop(): void; destroy(): void }[] = [];

  const paint = () => {
    const wall = readWall(store.getState());

    root.innerHTML = `
      <header class="v5-profile-head">
        ${
          embedded
            ? ''
            : '<button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
        }
        <h2>Your wall</h2>
        <button type="button" class="v5-icon-btn" data-edit aria-pressed="${editing}" aria-label="Edit the wall"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z"/></svg></button>
      </header>

      <section class="v5-fingerprint">
        <canvas class="v5-fp-canvas" aria-hidden="true"></canvas>
        <div class="v5-fp-text">
          <span class="v5-kicker">${esc(copy.fingerprintClarity)}</span>
          <h3>${esc(wall.fingerprint.archetype?.name ?? 'Developing')}</h3>
          <p>${esc(wall.fingerprint.archetype?.line ?? 'React to a few more and this resolves.')}</p>
          <p class="v5-fp-axes">${wall.fingerprint.axes.slice(0, 3).map((axis) => `${esc(axis.label)} ${Math.round(axis.share * 100)}%`).join(' · ') || 'Nothing yet'}</p>
        </div>
      </section>

      <section class="v5-wall-section">
        <h4>Anthem <small>${wall.anthem ? '1/1' : '0/1'}</small></h4>
        ${
          wall.anthem
            ? `<div class="v5-anthem">
                ${wall.anthem.thumb ? `<img src="${esc(wall.anthem.thumb)}" alt="">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
                <div><b>${esc(wall.anthem.title)}</b><span>${esc(wall.anthem.subtitle)}</span></div>
              </div>`
            : `<p class="v5-wall-empty">Pin a song as your anthem. One only — that is the point.</p>`
        }
      </section>

      <section class="v5-wall-section">
        <h4>The wall <small>${wall.memes.length}/${PINK_CAPS.meme}</small></h4>
        ${
          wall.memes.length
            ? `<div class="v5-wall-grid">${wall.memes.map((slot) => tile(slot, editing)).join('')}</div>`
            : `<p class="v5-wall-empty">Nothing hung yet. Long-press a meme in the Deck and pin it.</p>`
        }
      </section>

      <section class="v5-wall-section">
        <h4>On repeat <small>${wall.songs.length}/${PINK_CAPS.song}</small></h4>
        ${
          wall.songs.length
            ? `<div class="v5-wall-list">${wall.songs
                .map(
                  (slot) => `<button type="button" class="v5-wall-track ${editing ? 'is-editing' : ''}" data-key="${esc(slot.key)}" data-kind="song" data-id="${esc(slot.id)}">
                    ${slot.thumb ? `<img src="${esc(slot.thumb)}" alt="">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
                    <span><b>${esc(slot.title)}</b><small>${esc(slot.subtitle)}</small></span>
                  </button>`,
                )
                .join('')}</div>`
            : `<p class="v5-wall-empty">No tracks pinned.</p>`
        }
      </section>`;

    for (const contour of contours.splice(0)) contour.destroy();

    const canvas = root.querySelector<HTMLCanvasElement>('.v5-fp-canvas');
    if (canvas) {
      const staticMode = getQuality().tier === 'C';
      const contour = createContour({
        canvas,
        // Seeded off the user's own axis mix, so the shape is theirs.
        params: { seed: Math.round(wall.fingerprint.clarity * 1000) + wall.fingerprint.sample, rings: 6, wobble: 0.3, stroke: '#EFE9DA', accent: '#E8C77E' },
        static: staticMode,
      });
      if (!staticMode) contour.start();
      contours.push(contour);
    }
  };

  paint();
  host.appendChild(root);
  animate(root, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    easing: 'cubic-bezier(.22,.61,.36,1)',
  });

  const toast = (message: string) => {
    const node = el<HTMLDivElement>('div', 'v5-toast', esc(message));
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-close]')) {
      options.onClose?.();
      handle.destroy();
      return;
    }
    if (target.closest('[data-edit]')) {
      editing = !editing;
      haptics.play('tick');
      paint();
      return;
    }

    const button = target.closest<HTMLElement>('[data-key]');
    if (!button?.dataset.key) return;
    const kind = button.dataset.kind as ItemKind;
    const id = button.dataset.id as string;

    if (editing) {
      // Editing means unpinning; re-pinning happens from the Deck.
      const result = store.unpin(kind, id);
      haptics.play('light');
      if (!result.ok) toast(result.reason);
      paint();
      return;
    }
    options.onOpenItem?.(kind, id);
  });

  const unsubscribe = store.subscribe(() => paint());

  const handle: ProfileHandle = {
    destroy() {
      unsubscribe();
      for (const contour of contours.splice(0)) contour.destroy();
      root.remove();
    },
  };

  return handle;
};

/** Exposed for the Deck rail: can this item still be pinned? */
export const canPinMore = (state: StoreState, kind: PinSlotKind): boolean =>
  readWall(state).room[kind] > 0;

/** The axis mix behind the Fingerprint, so callers can share it. */
export const fingerprintVector = (state: StoreState) => axisAffinity(state);
