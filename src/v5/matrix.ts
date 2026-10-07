/**
 * The Match Matrix (build brief §6.2), as one card at a time.
 *
 * The rule this screen has to hold is honesty about population. Since D-27 the
 * invented people are gated off, so in a production build `getCandidates()`
 * returns an empty list — and that is the *common* case, not an edge case. The
 * empty state is therefore the primary path, written first, and it explains the
 * density gate rather than apologising for a bug.
 *
 * A number is only shown when there is signal behind it. `tasteTwins.calibrating`
 * is the backend's own admission that the score is not yet meaningful, and it is
 * surfaced instead of being papered over with a percentage.
 */

import { compatLabel, copy } from '../copy/index.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import type { CandidateCard } from '../lib/types.ts';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

/** Reads the repo the app installed at boot. Absent in unit tests. */
const repo = (): { getCandidates(): Promise<CandidateCard[]> } | null => {
  const bridge = (window as unknown as { Cultured?: { repo?: { getCandidates(): Promise<CandidateCard[]> } } }).Cultured;
  return bridge?.repo ?? null;
};

export interface MatrixHandle {
  destroy(): void;
}

export interface MatrixOptions {
  onClose?: () => void;
  /** Opens a mutual match's thread. */
  onOpenThread?: (id: string) => void;
}

/* ------------------------------------------------------------------ states */

/**
 * Which state the Matrix is in, decided from data rather than guessed.
 *
 * Kept pure and exported so the density gate can be tested without a DOM: the
 * failure this guards against is a screen that shows an empty queue when the
 * real reason is that nobody has been calibrated yet.
 */
export type MatrixState =
  | { kind: 'loading' }
  | { kind: 'no-backend' }
  | { kind: 'empty' }
  | { kind: 'calibrating'; cards: CandidateCard[] }
  | { kind: 'ready'; cards: CandidateCard[] };

export const matrixStateFor = (
  cards: CandidateCard[] | null,
): MatrixState => {
  if (cards === null) return { kind: 'loading' };
  if (cards.length === 0) return { kind: 'empty' };
  /* Everyone still calibrating is its own state: there are people here, but no
     score is honest yet, and showing one would be the lie D-27 removed. */
  if (cards.every((card) => card.tasteTwins.calibrating)) return { kind: 'calibrating', cards };
  return { kind: 'ready', cards };
};

/** The compat line, or nothing when the score is not trustworthy yet. */
export const compatLine = (card: CandidateCard): string | null =>
  card.tasteTwins.calibrating ? null : compatLabel(card.tasteTwins.score);

const chipsFor = (card: CandidateCard): string[] => {
  const twins = card.tasteTwins;
  return [...twins.sharedArtists, ...twins.sharedGenres, ...twins.sharedCategories].slice(0, 4);
};

/* -------------------------------------------------------------------- view */

const emptyView = () => `
  <div class="v5-matrix-empty">
    <span class="v5-matrix-glyph" aria-hidden="true">◎</span>
    <h2>${esc('Nobody here yet')}</h2>
    <p>${esc('cultured opens a city when enough of it is here. A deck with three people in it is a lie with a nice layout, so until then there is no queue to show you — and no invented faces to fill it.')}</p>
    <p class="v5-matrix-hint">${esc('Your Fingerprint keeps sharpening in the meantime. React in the Deck and the Matrix has something to work with the moment anyone else arrives.')}</p>
  </div>`;

const calibratingView = (cards: CandidateCard[]) => `
  <div class="v5-matrix-empty">
    <span class="v5-matrix-glyph" aria-hidden="true">◌</span>
    <h2>${esc('Still calibrating')}</h2>
    <p>${esc('There are people here, but nobody has enough signal for an honest number yet. A percentage before the math means anything would itself be a lie.')}</p>
    <p class="v5-matrix-hint">${esc(`${cards.length} in range · react to a few more memes and songs`)}</p>
  </div>`;

const cardView = (card: CandidateCard, index: number, total: number) => {
  const compat = compatLine(card);
  const chips = chipsFor(card);
  const p = card.profile;
  return `
  <article class="v5-matrix-card" data-id="${esc(card.id)}" aria-label="${esc(p.displayName)}">
    <header class="v5-matrix-card-head">
      <span class="v5-kicker">${esc(copy.matrix.cardKicker(`${Math.round(p.distanceKm)} km`, p.lookingFor.join(' · ')))}</span>
      <span class="v5-matrix-count">${index + 1} / ${total}</span>
    </header>
    <h3>${esc(p.displayName)}<span class="v5-matrix-age">${esc(String(p.age))}</span></h3>
    ${compat ? `<p class="v5-matrix-compat">${esc(compat)} · ${esc(String(Math.round(card.tasteTwins.score)))}%</p>` : '<p class="v5-matrix-compat is-calibrating">Calibrating — no honest number yet</p>'}
    <p class="v5-matrix-bio">${esc(p.bio)}</p>
    ${chips.length ? `<ul class="v5-matrix-chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${card.likesYou ? `<p class="v5-matrix-mutual">${esc(copy.matrix.mutual.headline)} ${esc(copy.matrix.mutual.sub)}</p>` : ''}
  </article>`;
};

export const mountMatrix = (host: HTMLElement, options: MatrixOptions = {}): MatrixHandle => {
  let cards: CandidateCard[] | null = null;
  let index = 0;
  let disposed = false;

  const root = el<HTMLDivElement>('div', 'v5-matrix');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', copy.nav.matrix);

  const paint = () => {
    if (disposed) return;
    const state = matrixStateFor(cards);

    if (state.kind === 'loading' || state.kind === 'no-backend') {
      root.innerHTML = `
        <header class="v5-matrix-head">
          <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <h2>${esc(copy.nav.matrix)}</h2>
        </header>
        <div class="v5-matrix-empty"><p>${esc(copy.status.loading[0])}</p></div>`;
      return;
    }

    const body =
      state.kind === 'empty'
        ? emptyView()
        : state.kind === 'calibrating'
          ? calibratingView(state.cards)
          : cardView(state.cards[index] ?? state.cards[0], index, state.cards.length);

    root.innerHTML = `
      <header class="v5-matrix-head">
        <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2>${esc(copy.nav.matrix)}</h2>
      </header>
      ${body}
      ${state.kind === 'ready' ? `
        <footer class="v5-matrix-actions">
          <button type="button" class="v5-btn v5-btn-ghost" data-pass>${esc(copy.matrix.pass)}</button>
          <button type="button" class="v5-btn" data-resonate>${esc(copy.matrix.resonate)}</button>
        </footer>` : ''}`;
  };

  const advance = (by: number) => {
    if (!cards || !cards.length) return;
    index = (index + by + cards.length) % cards.length;
    paint();
    const card = root.querySelector<HTMLElement>('.v5-matrix-card');
    if (card) void animate(card, [{ opacity: 0.4, transform: `translateX(${by > 0 ? 18 : -18}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22,.61,.36,1)' });
  };

  const decide = (resonate: boolean) => {
    if (!cards || !cards.length) return;
    const card = cards[index];
    haptics.play('light');
    /* A mutual is the only reveal path: the backend sets likesYou from a
       mutual-only projection, never from someone else's sent likes. */
    if (resonate && card.likesYou) {
      options.onOpenThread?.(card.id);
      options.onClose?.();
      return;
    }
    advance(1);
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-close]')) {
      options.onClose?.();
      return;
    }
    if (target.closest('[data-pass]')) decide(false);
    if (target.closest('[data-resonate]')) decide(true);
  });

  host.textContent = '';
  host.appendChild(root);
  paint();

  const adapter = repo();
  if (adapter) {
    void adapter
      .getCandidates()
      .then((result) => {
        if (disposed) return;
        cards = result;
        paint();
      })
      .catch(() => {
        /* A failed fetch must not read as an empty city. Say so instead. */
        if (disposed) return;
        root.innerHTML = `
          <header class="v5-matrix-head">
            <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            <h2>${esc(copy.nav.matrix)}</h2>
          </header>
          <div class="v5-matrix-empty"><p>${esc(copy.status.error)}</p></div>`;
      });
  } else {
    cards = [];
    paint();
  }

  return {
    destroy() {
      disposed = true;
      root.remove();
    },
  };
};
