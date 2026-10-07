/**
 * The Arena (build brief §8): three games, and the honest state of each.
 *
 * The Arena's job is to route into games that already exist — Meme Duel, NHIE,
 * Icebreaker — not to invent a fourth. So the screen is a launcher, and every
 * tile reports real state read from the duel record rather than a placeholder.
 *
 * The rule carried over from the honesty audit (D-30): no tile claims something
 * happened that did not. A duel that is waiting says it is waiting. There is no
 * "refresh for new signals" here, because there is nothing to fetch.
 */

import { copy } from '../copy/index.ts';
import { haptics } from '../lib/haptics.ts';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

/**
 * The live duel state, from the legacy store's `S.duelLink` via the bridge
 * seam. It is a function, not a value: the legacy side reassigns `S.duelLink`
 * when a duel is created and when its verdict lands, so reading a snapshot at
 * mount time would report a revealed duel as still waiting.
 *
 * The bridge shape is narrower than `DuelRecord` — legacy stores only the id and
 * the verdict — so this adapts it rather than pretending the full record is
 * there.
 */
interface BridgeDuel {
  id?: string;
  verdict?: { score: number; of: number; line?: string } | null;
}

const duelOf = (): BridgeDuel | null => {
  const bridge = (window as unknown as { Cultured?: { duelState?: () => BridgeDuel | null } }).Cultured;
  return bridge?.duelState?.() ?? null;
};

export interface ArenaHandle {
  destroy(): void;
}

export interface ArenaOptions {
  onOpenGame?: (game: 'duel' | 'nhie' | 'icebreaker') => void;
}

/* ------------------------------------------------------------------ states */

export type DuelState =
  | { kind: 'none' }
  | { kind: 'waiting'; id: string }
  | { kind: 'revealed'; id: string; score: number; of: number; line: string };

/**
 * Pure, so the three duel states are testable without a DOM.
 *
 * The distinction that matters: `verdict` is only ever present once both sides
 * have submitted, so a non-null verdict is the only honest "revealed". Anything
 * else with an id is still waiting, and must not show a score.
 */
export const duelStateFor = (record: BridgeDuel | null): DuelState => {
  if (!record?.id) return { kind: 'none' };
  if (record.verdict) {
    return {
      kind: 'revealed',
      id: record.id,
      score: record.verdict.score,
      of: record.verdict.of,
      line: record.verdict.line ?? '',
    };
  }
  return { kind: 'waiting', id: record.id };
};

/** The CTA label for the duel tile, from real state only. */
export const duelCta = (state: DuelState): string => {
  if (state.kind === 'revealed') return `Revealed · ${state.score}/${state.of}`;
  if (state.kind === 'waiting') return 'Duel live · waiting';
  return 'Enter the duel';
};

/* -------------------------------------------------------------------- view */

const tile = (game: string, glyph: string, kicker: string, title: string, body: string, cta: string, done: boolean) => `
  <button type="button" class="v5-arena-tile" data-game="${esc(game)}">
    <span class="v5-arena-glyph" aria-hidden="true">${esc(glyph)}</span>
    <span class="v5-arena-copy">
      <span class="v5-kicker">${esc(kicker)}</span>
      <strong>${esc(title)}</strong>
      <span class="v5-arena-body">${esc(body)}</span>
      <span class="v5-arena-cta ${done ? 'is-done' : ''}">${esc(cta)}</span>
    </span>
  </button>`;

export const mountArena = (host: HTMLElement, options: ArenaOptions = {}): ArenaHandle => {
  let disposed = false;

  const root = el<HTMLDivElement>('div', 'v5-arena');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', copy.nav.arena);

  const paint = () => {
    if (disposed) return;
    const state = duelStateFor(duelOf());

    root.innerHTML = `
      <header class="v5-arena-head">
        <h2>${esc(copy.nav.arena)}</h2>
        <p>${esc(copy.arena.header)}</p>
      </header>
      <div class="v5-arena-list">
        ${tile('duel', '⚔', 'MEME DUEL · REAL LINK', copy.arena.duelTile, 'Caption five prompts, send the link. The verdict opens only once both sides are in.', duelCta(state), state.kind !== 'none')}
        ${tile('nhie', '🙈', 'NEVER HAVE I EVER · 2 MIN', copy.arena.nhieTile, 'Twelve cards, two answers. Your picks redraw your Fingerprint and stay on this device.', 'Play a round', false)}
        ${tile('icebreaker', '💬', 'ICEBREAKER', copy.arena.rouletteTile, 'A question built from what you two actually share.', 'Spin the wheel', false)}
      </div>
      ${state.kind === 'revealed' ? `<p class="v5-arena-verdict">${esc(state.line)}</p>` : ''}
      ${state.kind === 'waiting' ? `<p class="v5-arena-waiting">${esc('Waiting on the other side. Nothing to refresh — the verdict opens when they finish.')}</p>` : ''}
      <p class="v5-arena-note">${esc(copy.arena.roulettePractice)}</p>`;
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-game]');
    if (!button) return;
    const game = button.dataset.game as 'duel' | 'nhie' | 'icebreaker';
    haptics.play('light');
    options.onOpenGame?.(game);
  });

  host.textContent = '';
  host.appendChild(root);
  paint();

  return {
    destroy() {
      disposed = true;
      root.remove();
    },
  };
};
