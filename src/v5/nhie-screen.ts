/**
 * Never Have I Ever (build brief §8.2).
 *
 * Twelve cards, two answers each — Guilty or Clean, never free text. The bank
 * is the hand-written one in `src/content/nhie.manifest.json`; the round is
 * dealt by `pickRound`, which skips anything already asked and says so when the
 * filtered pool runs dry.
 *
 * The screen owns no state of its own beyond the round in flight. Every answer
 * goes straight to the store, so a reload mid-round still knows what was asked.
 */

import { copy, nhieRank } from '../copy/index.ts';
import { getStore } from '../store/index.ts';
import { nhie } from '../content/index.ts';
import { ROUND_SIZE, cardText, pickRound, spiceLabel } from '../content/nhie.ts';
import type { NhieQuestion } from '../content/types.ts';
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

export type Answer = 'guilty' | 'clean';

export interface NhieHandle {
  destroy(): void;
}

export interface NhieOptions {
  /** Friend mode: a shared seed deals the same twelve to both players. */
  seed?: number;
  categories?: string[];
  maxSpice?: number;
  onClose?: () => void;
}

export const mountNhie = (host: HTMLElement, options: NhieOptions = {}): NhieHandle => {
  const store = getStore();

  const round = pickRound(nhie, {
    asked: store.getState().progress.nhieAsked,
    categories: options.categories,
    maxSpice: options.maxSpice,
    seed: options.seed,
  });

  const answers: Record<string, Answer> = {};
  let index = 0;

  const root = el<HTMLDivElement>('div', 'v5-nhie');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Never Have I Ever');

  const paintCard = () => {
    const question = round.questions[index] as NhieQuestion | undefined;

    if (!question) {
      const guilty = Object.values(answers).filter((a) => a === 'guilty').length;
      root.innerHTML = `
        <header class="v5-nhie-head">
          <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <h2>Round complete</h2>
          <span class="v5-nhie-count">${ROUND_SIZE}/${ROUND_SIZE}</span>
        </header>
        <div class="v5-nhie-result">
          <p class="v5-nhie-rank">${esc(nhieRank(guilty))}</p>
          <p class="v5-nhie-tally">${guilty} of ${ROUND_SIZE} guilty</p>
          ${
            round.bankExhausted
              ? `<p class="v5-nhie-note">That was the last of the bank — the next round starts it over.</p>`
              : ''
          }
          <button type="button" class="v5-btn" data-again>Another round</button>
          <button type="button" class="v5-btn v5-btn-ghost" data-close>Done</button>
        </div>`;
      return;
    }

    const spice = spiceLabel(question);
    root.innerHTML = `
      <header class="v5-nhie-head">
        <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2>Never Have I Ever</h2>
        <span class="v5-nhie-count">${index + 1}/${ROUND_SIZE}</span>
      </header>
      <div class="v5-nhie-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${ROUND_SIZE}" aria-valuenow="${index + 1}">
        <i style="transform:scaleX(${(index + 1) / ROUND_SIZE})"></i>
      </div>
      <article class="v5-nhie-card" data-card>
        <span class="v5-nhie-emoji" aria-hidden="true">${esc(question.emoji)}</span>
        <p class="v5-nhie-text">${esc(cardText(question))}</p>
        <p class="v5-nhie-sub">${esc(question.sub)}</p>
        ${spice ? `<span class="v5-nhie-spice">${esc(spice)}</span>` : ''}
      </article>
      <div class="v5-nhie-actions">
        <button type="button" class="v5-nhie-btn is-clean" data-answer="clean">${esc(copy.arena.nhie.clean)}</button>
        <button type="button" class="v5-nhie-btn is-guilty" data-answer="guilty">${esc(copy.arena.nhie.guilty)}</button>
      </div>`;

    const card = root.querySelector<HTMLElement>('[data-card]');
    animate(card, [{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], {
      duration: 260,
      easing: 'cubic-bezier(.22,.61,.36,1)',
    });
  };

  paintCard();
  host.appendChild(root);
  animate(root, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    easing: 'cubic-bezier(.22,.61,.36,1)',
  });

  const close = () => {
    handle.destroy();
    options.onClose?.();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-close]')) {
      close();
      return;
    }

    if (target.closest('[data-again]')) {
      // Restart the round from the same filtered pool, minus this round.
      index = 0;
      for (const key of Object.keys(answers)) delete answers[key];
      const next = pickRound(nhie, {
        asked: store.getState().progress.nhieAsked,
        categories: options.categories,
        maxSpice: options.maxSpice,
        seed: options.seed,
      });
      round.questions = next.questions;
      round.bankExhausted = next.bankExhausted;
      paintCard();
      return;
    }

    const button = target.closest<HTMLElement>('[data-answer]');
    if (!button?.dataset.answer) return;

    const question = round.questions[index];
    if (!question) return;

    const answer = button.dataset.answer as Answer;
    answers[question.id] = answer;
    store.markNhieAsked([question.id]);
    haptics.play(answer === 'guilty' ? 'thud' : 'tick');

    // Stamp, then advance — the stamp is the feedback, not a blocking modal.
    const card = root.querySelector<HTMLElement>('[data-card]');
    if (card) {
      const stamp = el<HTMLSpanElement>(
        'span',
        `v5-nhie-stamp ${answer === 'guilty' ? 'is-guilty' : 'is-clean'}`,
        esc(answer === 'guilty' ? copy.arena.nhie.stampGuilty : copy.arena.nhie.stampClean),
      );
      card.appendChild(stamp);
      animate(card, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], {
        duration: 180,
        easing: 'ease-out',
      });
    }

    window.setTimeout(() => {
      index += 1;
      paintCard();
    }, 260);
  });

  const handle: NhieHandle = {
    destroy() {
      root.remove();
    },
  };

  return handle;
};
