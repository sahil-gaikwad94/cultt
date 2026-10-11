/**
 * Feel — the like/save choreography, version 2.
 *
 * `src/motion/micro.ts` is the dispatcher: it reads `data-fx` off whatever was
 * tapped. This module is what a like or a save *does* once dispatched, so the
 * upgrade lands on every surface at once (feed deck, meme gallery, chat, the v5
 * card rail, the vault) instead of being re-implemented per screen.
 *
 * The rules are the same as the rest of the app's motion:
 *  - transform + opacity only, 150–420 ms, nothing that triggers layout;
 *  - particles clean themselves up (one layer per tap, one timeout);
 *  - `prefers-reduced-motion` collapses every effect to the instant final state
 *    — the state change never lives here, so it is never lost;
 *  - a like never blocks the tap: the effect is fire-and-forget.
 */

import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import './feel.css';

const reduce = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** Brand tokens only — the same three the original burst used. */
const SPARK_COLORS = ['var(--heart)', 'var(--sun)', 'var(--bone)'] as const;

const HEART_PATH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 20.2s-7.6-4.7-7.6-10.4A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.5C19.6 15.5 12 20.2 12 20.2z" pathLength="1"/></svg>';

/** Removes every layer this module added, once it has played. */
const clean = (btn: HTMLElement, selector: string, ms: number): void => {
  window.setTimeout(() => btn.querySelectorAll(selector).forEach((node) => node.remove()), ms);
};

/**
 * A ring of sparks around the control. 10 particles max (§6.4's ceiling), each
 * one a transform-only keyframe driven by CSS custom properties.
 */
export const sparkRing = (btn: HTMLElement, count = 10): void => {
  if (reduce() || btn.querySelector('.fx2-ring')) return;
  const ring = document.createElement('span');
  ring.className = 'fx2-ring';
  ring.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < Math.min(10, count); i += 1) {
    const dot = document.createElement('i');
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const distance = 24 + (i % 3) * 7;
    dot.style.setProperty('--tx', `${(Math.cos(angle) * distance).toFixed(1)}px`);
    dot.style.setProperty('--ty', `${(Math.sin(angle) * distance).toFixed(1)}px`);
    dot.style.setProperty('--dl', `${i * 12}ms`);
    dot.style.setProperty('--c', SPARK_COLORS[i % 3] as string);
    ring.appendChild(dot);
  }
  btn.appendChild(ring);
  clean(btn, '.fx2-ring', 640);
};

/** The heart outline draws itself, scales up and dissolves. */
export const heartDraw = (btn: HTMLElement): void => {
  if (reduce() || btn.querySelector('.fx2-heart')) return;
  const wrap = document.createElement('span');
  wrap.className = 'fx2-heart';
  wrap.innerHTML = HEART_PATH;
  btn.appendChild(wrap);
  const path = wrap.querySelector('path');
  if (path && typeof (path as SVGPathElement).animate === 'function') {
    (path as SVGPathElement).animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 300,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards',
    });
  }
  clean(btn, '.fx2-heart', 620);
};

/** The squash-and-stretch on the icon itself. */
export const heartSquash = (target: HTMLElement | null): void => {
  if (!target) return;
  void animate(
    target,
    [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(.78) rotate(-6deg)', offset: 0.22 },
      { transform: 'scale(1.32) rotate(4deg)', offset: 0.58 },
      { transform: 'scale(.96) rotate(-1deg)', offset: 0.82 },
      { transform: 'scale(1) rotate(0deg)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.34,1.3,.5,1)' },
  );
};

/** A count next to the control ticks instead of jumping. */
export const countPop = (btn: HTMLElement): void => {
  const count = btn.querySelector('.n, .mm-n, [data-count]') as HTMLElement | null;
  if (!count) return;
  void animate(count, [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], {
    duration: 260,
    easing: 'cubic-bezier(.34,1.3,.5,1)',
  });
};

/**
 * A like, on or off.
 *
 * On: squash → spark ring → the heart draws itself → the count pops, with the
 * laugh haptic. Off: a single deflate, quiet on purpose — un-liking should feel
 * like taking something back, not like winning.
 */
export const likeFx = (btn: HTMLElement, on: boolean): void => {
  const icon = (btn.querySelector('.ri, svg, .mm-e') as HTMLElement | null) ?? btn;
  if (!on) {
    void animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(.86)' }, { transform: 'scale(1)' }], {
      duration: 200,
      easing: 'cubic-bezier(.22,.61,.36,1)',
    });
    haptics.play('tick');
    return;
  }
  heartSquash(icon);
  sparkRing(btn, 10);
  heartDraw(btn);
  countPop(btn);
  haptics.play('laugh');
};

/**
 * A save, on or off.
 *
 * On: the bookmark drops in elastically, a shine sweeps across it and — when the
 * caller knows where the Vault lives — a ghost bookmark arcs into the tab. Off:
 * it slides out and settles.
 */
export const saveFx = (btn: HTMLElement, on: boolean, target?: HTMLElement | null): void => {
  const icon = (btn.querySelector('.ri, svg, .mm-e') as HTMLElement | null) ?? btn;
  if (!on) {
    void animate(
      icon,
      [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(4px) scale(.86)', opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 240, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    haptics.play('tick');
    return;
  }

  void animate(
    icon,
    [
      { transform: 'translateY(-16px) scale(.68)', opacity: 0 },
      { transform: 'translateY(3px) scale(1.14)', opacity: 1, offset: 0.62 },
      { transform: 'translateY(-1px) scale(.97)', offset: 0.82 },
      { transform: 'translateY(0) scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.34,1.3,.5,1)' },
  );

  if (!reduce() && !btn.querySelector('.fx2-shine')) {
    const shine = document.createElement('span');
    shine.className = 'fx2-shine';
    shine.setAttribute('aria-hidden', 'true');
    btn.appendChild(shine);
    clean(btn, '.fx2-shine', 620);
  }

  /* The arc into the Vault. The caller resolves the target (the nav tab),
     because only the shell knows where the Vault lives. */
  if (target && !reduce()) {
    const from = btn.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const ghost = document.createElement('span');
    ghost.className = 'fx2-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4h11v16.5L12 16.8 6.5 20.5z"/></svg>';
    ghost.style.left = `${from.left + from.width / 2}px`;
    ghost.style.top = `${from.top + from.height / 2}px`;
    document.body.appendChild(ghost);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const flight = animate(
      ghost,
      [
        { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0.9 },
        {
          transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 42}px)) scale(.9)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.32)`, opacity: 0 },
      ],
      { duration: 460, easing: 'cubic-bezier(.3,.6,.3,1)' },
    );
    const land = (): void => {
      ghost.remove();
      void animate(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], {
        duration: 300,
        easing: 'cubic-bezier(.34,1.3,.5,1)',
      });
    };
    flight.finished.then(land, land);
  }

  haptics.play('success');
};

/**
 * A reaction from the tray landing on a card: the emoji drops in and the card
 * takes a small hit. Used by the v5 deck and the tray's host surface.
 */
export const reactionLand = (card: HTMLElement | null, emoji: string, at?: { x: number; y: number }): void => {
  if (!card) return;
  const chip = document.createElement('span');
  chip.className = 'fx2-emoji';
  chip.setAttribute('aria-hidden', 'true');
  chip.textContent = emoji;
  if (at) {
    const rect = card.getBoundingClientRect();
    chip.style.left = `${at.x - rect.left}px`;
    chip.style.top = `${at.y - rect.top}px`;
  }
  card.appendChild(chip);
  clean(card, '.fx2-emoji', 760);
  if (!reduce()) {
    void animate(
      card,
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
      { duration: 260, easing: 'cubic-bezier(.34,1.3,.5,1)' },
    );
  }
};

export const feel = { likeFx, saveFx, sparkRing, heartDraw, heartSquash, countPop, reactionLand };

