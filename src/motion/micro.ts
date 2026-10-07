/**
 * micro — one module for every tactile interaction in the app.
 *
 * Contract (the build brief calls these the "rules"):
 *   * every effect runs 120-400 ms, transform + opacity only;
 *   * particles remove themselves when they land;
 *   * one burst at a time per element;
 *   * the function never depends on the animation — the state change happens
 *     in the data-act handler, this layer only decorates it;
 *   * reduced motion and Calm Mode swap every effect for the instant final
 *     state (a class), and `aria-pressed` / live regions keep working because
 *     none of this owns state.
 *
 * Wiring: legacy templates mark buttons with `data-fx="…"`. A single delegated
 * click listener (registered after the seam's own, so it reads the settled
 * `aria-pressed`) plays the matching effect. The long-press "fan" for the heart
 * is the only gesture that intercepts, and it stops the click it replaces.
 */

import { DUR, EASE, shouldAnimate } from './reduce';
import { synth } from './audio';
/* Type-only: the ReactionTray + FX engine itself is pulled in lazily (below) so
   the tray and its particle canvas never sit on the first-paint path. */
import type { createFxLayer } from '../v5/reactions.ts';

/* ------------------------------------------------------------- bridge */

export interface MicroBridge {
  /** The seam's haptic(); the setting gate lives there, bypass is impossible. */
  haptic?: (pattern: number | number[]) => void;
  /** Current Sound setting; consulted per effect so a toggle lands instantly. */
  sound?: () => boolean;
  /** Where clones fly through. Falls back to document.body. */
  stage?: () => HTMLElement | null;
}

let bridge: MicroBridge = {};
const tick = (ms: number | number[]): void => {
  bridge.haptic?.(ms);
};
const soundOn = (): boolean => (bridge.sound ? bridge.sound() : true);
const blip = (kind: 'tick' | 'pop' | 'chime' = 'tick'): void => {
  if (soundOn()) synth.blip(kind);
};
const stage = (): HTMLElement => bridge.stage?.() ?? document.body;

const canWAAPI = (el: Element | null): el is HTMLElement =>
  !!el && typeof (el as HTMLElement).animate === 'function';

/** Animate-or-instant: the single choke point every effect runs through. */
const animate = (
  el: HTMLElement,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null => {
  if (!shouldAnimate() || !canWAAPI(el)) return null;
  const duration = Math.min(400, Math.max(120, options.duration as number ?? DUR.base));
  try {
    return el.animate(frames, { fill: 'none', ...options, duration });
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------ helpers */

export const pop = (el: HTMLElement | null, peak = 1.18): void => {
  if (!el) return;
  void animate(
    el,
    [
      { transform: 'scale(1)' },
      { transform: `scale(${Math.max(0.86, 1 - (peak - 1) * 0.6)})`, offset: 0.3 },
      { transform: `scale(${peak})`, offset: 0.62 },
      { transform: 'scale(1)' },
    ],
    { duration: DUR.base, easing: EASE.spring },
  );
};

/** The heart's own squash: 0.8 -> 1.25 -> 1, exactly as scripted in the brief. */
export const heartPop = (el: HTMLElement | null): void => {
  if (!el) return;
  void animate(
    el,
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.8)', offset: 0.25 },
      { transform: 'scale(1.25)', offset: 0.6 },
      { transform: 'scale(1)' },
    ],
    { duration: DUR.slow, easing: EASE.spring },
  );
};

export const deflate = (el: HTMLElement | null): void => {
  if (!el) return;
  void animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(0.92)' }, { transform: 'scale(1)' }], {
    duration: DUR.quick,
    easing: EASE.ease,
  });
};

const BURST_COLORS = ['var(--heart)', 'var(--sun)', 'var(--bone)'];
const bursting = new WeakSet<HTMLElement>();

/** At most 10 particles, in brand tokens only, removed when they land. */
export const burst = (el: HTMLElement | null, _color?: string, count = 10): void => {
  if (!el || !shouldAnimate() || bursting.has(el)) return;
  bursting.add(el);
  const rect = el.getBoundingClientRect();
  const host = stage();
  const hostRect = host.getBoundingClientRect();
  const cx = rect.left - hostRect.left + rect.width / 2;
  const cy = rect.top - hostRect.top + rect.height / 2;
  const n = Math.min(10, count);
  let alive = n;
  for (let i = 0; i < n; i++) {
    const dot = document.createElement('i');
    dot.className = 'bp fx-particle';
    dot.style.left = `${cx - 3}px`;
    dot.style.top = `${cy - 3}px`;
    dot.style.background = BURST_COLORS[i % 3] as string;
    host.appendChild(dot);
    const angle = (i / n) * Math.PI * 2 + 0.4;
    const dist = 22 + (i % 3) * 8;
    const anim = animate(
      dot,
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(0)`, opacity: 0 },
      ],
      { duration: DUR.slow, easing: EASE.ease },
    );
    const done = (): void => {
      dot.remove();
      if (--alive <= 0) bursting.delete(el);
    };
    if (anim) anim.finished.then(done, done);
    else done();
  }
};

/** FLIP arc between two elements. The clone is removed on landing. */
export const flyTo = (
  from: HTMLElement | null,
  to: HTMLElement | null,
  opts: { duration?: number; shrink?: number; tilt?: number; onLand?: () => void } = {},
): void => {
  if (!from || !to) {
    opts.onLand?.();
    return;
  }
  if (!shouldAnimate()) {
    opts.onLand?.();
    return;
  }
  const host = stage();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const clone = from.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-act');
  clone.removeAttribute('data-fx');
  clone.setAttribute('aria-hidden', 'true');
  clone.style.cssText = `position:absolute;pointer-events:none;z-index:80;margin:0;left:${a.left - hr.left}px;top:${a.top - hr.top}px;width:${a.width}px;height:${a.height}px;transition:none;`;
  host.appendChild(clone);
  const dx = b.left - a.left;
  const dy = b.top - a.top;
  const shrink = opts.shrink ?? 0.42;
  const tilt = opts.tilt ?? 9;
  const anim = animate(
    clone,
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      {
        transform: `translate(${dx * 0.55}px,${dy * 0.55 - 46}px) scale(${(1 + shrink) / 2}) rotate(${-tilt}deg)`,
        offset: 0.55,
      },
      { transform: `translate(${dx}px,${dy}px) scale(${shrink}) rotate(0deg)`, opacity: 0.15 },
    ],
    { duration: Math.min(400, opts.duration ?? 380), easing: EASE.ease },
  );
  const done = (): void => {
    clone.remove();
    opts.onLand?.();
  };
  if (anim) anim.finished.then(done, done);
  else window.setTimeout(done, 400);
};

/**
 * Odometer count. Digits roll vertically; unchanged digits never move. With
 * motion off the number is simply set — the count is the function, the roll is
 * decoration.
 */
export const countTo = (el: HTMLElement | null, to: number): void => {
  if (!el) return;
  const next = String(to);
  const prev = el.textContent ?? '';
  el.textContent = next;
  if (!shouldAnimate() || prev === next || prev.length !== next.length) return;
  const wrap = document.createElement('span');
  wrap.className = 'odo';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.textContent = next;
  el.textContent = '';
  for (let i = 0; i < next.length; i++) {
    const cell = document.createElement('i');
    const from = prev[i] ?? next[i];
    if (from === next[i]) {
      cell.className = 'odo-c';
      cell.textContent = next[i] ?? '';
    } else {
      cell.className = 'odo-c roll';
      const inner = document.createElement('b');
      inner.textContent = next[i] ?? '';
      const old = document.createElement('u');
      old.textContent = from;
      cell.append(old, inner);
    }
    wrap.appendChild(cell);
  }
  el.appendChild(wrap);
  window.setTimeout(() => {
    el.textContent = next;
  }, 420);
};

/** A checkmark that draws itself (stroke-dashoffset), brand-bone colored. */
export const drawCheck = (el: HTMLElement | null): void => {
  if (!el) return;
  if (el.querySelector('.fx-check')) return;
  const span = document.createElement('span');
  span.className = 'fx-check';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>';
  el.appendChild(span);
  const path = span.querySelector('path');
  if (path && shouldAnimate() && typeof (path as SVGPathElement).animate === 'function') {
    (path as SVGPathElement).animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: DUR.base,
      easing: EASE.ease,
      fill: 'forwards',
    });
  } else if (path) {
    path.setAttribute('stroke-dashoffset', '0');
  }
};

/** Ripple ring from a button — used by Resonate. */
export const ringFrom = (el: HTMLElement | null, color = 'var(--bone)'): void => {
  if (!el || !shouldAnimate()) return;
  const ring = document.createElement('i');
  ring.className = 'fx-ring';
  ring.style.borderColor = color;
  el.appendChild(ring);
  const anim = animate(ring, [{ transform: 'scale(0.2)', opacity: 0.8 }, { transform: 'scale(2.4)', opacity: 0 }], {
    duration: DUR.slow,
    easing: EASE.ease,
  });
  const done = (): void => ring.remove();
  if (anim) anim.finished.then(done, done);
  else window.setTimeout(done, 400);
};

const settle = (el: HTMLElement, cls: string, ms = 420): void => {
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
};

/* ------------------------------------------------------- press handling */

const holdable = new WeakMap<HTMLElement, { timer: number; fired: boolean; x: number; y: number }>();
let pendingSkip: HTMLElement | null = null;

/* The full ReactionTray (brief §6.3) — long-press opens an 8-emoji tray, the
   finger drags a fisheye, the pick flies to the chip and a signature FX plays.
   It lives in v5/reactions and is imported lazily; one shared particle canvas
   serves every surface. The seam owns state: this only reports the pick via a
   `micro:react` event, so the tray never writes to the store itself. */
type FxLayer = ReturnType<typeof createFxLayer>;
let fxLayer: FxLayer | null = null;
let rxnPromise: Promise<typeof import('../v5/reactions.ts')> | null = null;
const loadRxn = (): Promise<typeof import('../v5/reactions.ts')> =>
  rxnPromise ?? (rxnPromise = import('../v5/reactions.ts'));

const fanFor = (btn: HTMLElement): void => {
  const card =
    (btn.closest('[data-rxn-kind], [data-m], [data-id], article, .dcard') as HTMLElement | null) ?? null;
  const kind: 'meme' | 'song' = card?.dataset?.rxnKind === 'song' ? 'song' : 'meme';
  const rect = btn.getBoundingClientRect();
  const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  void loadRxn()
    .then((mod) => {
      if (!fxLayer) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText =
          'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:120';
        document.body.appendChild(canvas);
        fxLayer = mod.createFxLayer({ canvas });
      }
      return mod.openReactionTray({ kind, anchor, target: card ?? btn });
    })
    .then((res) => {
      if (!res.emoji) return;
      void fxLayer?.play(res.emoji, res.at);
      btn.dispatchEvent(
        new CustomEvent('micro:react', { detail: { emoji: res.emoji, at: res.at, kind }, bubbles: true }),
      );
    })
    .catch(() => {
      /* The tray is decoration; if the chunk fails to load the like button
         still works as a plain tap. */
    });
};

/* ------------------------------------------------------- delegated fx */

const fxHandlers: Record<string, (btn: HTMLElement) => void> = {
  like: (btn) => {
    const on = btn.getAttribute('aria-pressed') === 'true';
    const icon = btn.querySelector('.ri, svg, .mm-e') as HTMLElement | null;
    if (on) {
      heartPop(icon ?? btn);
      burst(btn);
      blip('pop');
      tick(10);
    } else {
      deflate(icon ?? btn);
      tick(6);
    }
  },
  save: (btn) => {
    const on = btn.getAttribute('aria-pressed') === 'true';
    const icon = btn.querySelector('.ri, svg') as HTMLElement | null;
    if (on && icon) {
      void animate(
        icon,
        [
          { transform: 'translateY(-12px) scale(.7)', opacity: 0 },
          { transform: 'translateY(2px) scale(1.06)', offset: 0.7 },
          { transform: 'translateY(0) scale(1)' },
        ],
        { duration: DUR.slow, easing: EASE.spring },
      );
      blip('tick');
      tick(8);
      const shelf = document.querySelector('.nv[data-t="you"]') as HTMLElement | null;
      if (shelf) {
        flyTo(icon, shelf, {
          onLand: () => {
            pop(shelf, 1.14);
            const badge = shelf.querySelector('.badge') as HTMLElement | null;
            if (badge) pop(badge, 1.3);
          },
        });
      }
    } else {
      deflate(icon ?? btn);
    }
  },
  share: (btn) => {
    const icon = btn.querySelector('.ri, svg') as HTMLElement | null;
    void animate(
      icon ?? btn,
      [
        { transform: 'rotate(0deg) translate(0,0) scale(1)', opacity: 1 },
        { transform: 'rotate(-14deg) translate(-6px,8px) scale(.8)', opacity: 0.6, offset: 0.3 },
        { transform: 'rotate(10deg) translate(46px,-58px) scale(.5)', opacity: 0 },
      ],
      { duration: DUR.slow, easing: EASE.ease },
    );
    blip('tick');
    tick(8);
  },
  sharego: (btn) => {
    drawCheck(btn);
    pop(btn, 1.05);
    blip('pop');
    tick(10);
  },
  pin: (btn) => {
    const on = btn.getAttribute('aria-pressed') === 'true';
    if (on) {
      const card = btn.closest('article, .gt, .mm-card, .dcard') as HTMLElement | null;
      const visual = (card?.querySelector('.mm-visual, .art, .mm-mini') ?? btn) as HTMLElement | null;
      if (visual) {
        void animate(
          visual,
          [
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
            { transform: 'translateY(-14px) rotate(-3deg) scale(1.05)', offset: 0.4 },
            { transform: 'translateY(0) rotate(0.6deg) scale(.98)', offset: 0.85 },
            { transform: 'translateY(0) rotate(0deg) scale(1)' },
          ],
          { duration: 400, easing: EASE.spring },
        );
      }
      // A tape/pin sticker snaps onto the card.
      if (card && !card.querySelector('.pin-stk')) {
        const stk = document.createElement('span');
        stk.className = 'pin-stk';
        stk.setAttribute('aria-hidden', 'true');
        stk.textContent = '📌';
        card.appendChild(stk);
        pop(stk, 1.3);
      }
      const shelf = document.querySelector('.mm-shelf') as HTMLElement | null;
      if (shelf) settle(shelf, 'fx-nudge', 700);
      const fp = document.querySelector('#fpb, .fp-bleed') as HTMLElement | null;
      if (fp) settle(fp, 'fx-pulse', 800);
      burst(btn);
      blip('pop');
      tick([10, 24, 10]);
    } else {
      const card = btn.closest('article, .gt, .mm-card, .dcard') as HTMLElement | null;
      card?.querySelector('.pin-stk')?.remove();
      deflate(btn);
    }
  },
  chip: (btn) => {
    const on = btn.classList.contains('on');
    pop(btn, 1.1);
    if (on) drawCheck(btn);
    blip('tick');
    tick(6);
  },
  toggle: (btn) => {
    const row = btn.closest('.row');
    if (row) settle(row as HTMLElement, 'fx-flash', 320);
    blip('tick');
    tick(6);
  },
  tab: (btn) => {
    const icon = btn.querySelector('svg') as HTMLElement | null;
    void animate(
      icon ?? btn,
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
      { duration: DUR.base, easing: EASE.spring },
    );
  },
  play: (btn) => {
    pop(btn, 1.1);
    const card = btn.closest('[data-id]') as HTMLElement | null;
    if (card) settle(card, 'fx-spin-up', 520);
  },
  'duel-pick': (btn) => {
    void animate(
      btn,
      [
        { transform: 'perspective(600px) rotateY(0deg)' },
        { transform: 'perspective(600px) rotateY(9deg)', offset: 0.35 },
        { transform: 'perspective(600px) rotateY(0deg)' },
      ],
      { duration: DUR.slow, easing: EASE.spring },
    );
    settle(btn, 'fx-locked', 2000);
    burst(btn, undefined, 6);
    blip('pop');
    tick(12);
  },
  send: (btn) => {
    void animate(
      btn,
      [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: 'translate(6px,-14px) rotate(12deg) scale(.85)', opacity: 0.6, offset: 0.5 },
        { transform: 'translate(0,0) rotate(0deg) scale(1)' },
      ],
      { duration: DUR.base, easing: EASE.ease },
    );
    tick(6);
  },
  spin: (btn) => {
    const svg = btn.querySelector('svg') as HTMLElement | null;
    if (svg) {
      void animate(svg, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: 400,
        easing: EASE.spring,
      });
    }
  },
  react: (btn) => {
    pop(btn, 1.22);
    blip('tick');
    tick(6);
  },
};

/* ------------------------------------------------------ toast observer */

const watchToast = (): void => {
  const toastEl = document.getElementById('toast');
  if (!toastEl || toastEl.dataset.fx === 'watched') return;
  toastEl.dataset.fx = 'watched';
  const line = document.createElement('i');
  line.className = 'toast-line';
  line.setAttribute('aria-hidden', 'true');
  toastEl.appendChild(line);
  /* Guard by message identity: an observer that re-touches the very attribute
     it watches would re-enter itself — a MutationObserver feedback loop that
     starves the microtask queue for as long as the toast is up. Decorations
     run once per *new message*, which is the actual event that matters. */
  let last = '';
  const mo = new MutationObserver(() => {
    if (!toastEl.classList.contains('on')) return;
    const msg = toastEl.textContent ?? '';
    if (msg === last) return;
    last = msg;
    toastEl.classList.remove('fx-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('fx-in');
    line.classList.remove('run');
    void line.offsetWidth;
    if (shouldAnimate()) line.classList.add('run');
  });
  mo.observe(toastEl, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
};

/* ---------------------------------------------------- badge tick watch */

const watchBadges = (): void => {
  const nav = document.getElementById('nav');
  if (!nav || nav.dataset.fx === 'watched') return;
  nav.dataset.fx = 'watched';
  const seen = new WeakMap<HTMLElement, string>();
  const mo = new MutationObserver(() => {
    nav.querySelectorAll('.badge').forEach((b) => {
      const el = b as HTMLElement;
      if (seen.get(el) === el.textContent) return;
      const had = seen.has(el);
      seen.set(el, el.textContent ?? '');
      if (had) pop(el, 1.35);
    });
  });
  mo.observe(nav, { childList: true, subtree: true, characterData: true });
};

/* --------------------------------------------------------------- init */

export const installMicro = (b: MicroBridge): (() => void) => {
  bridge = b;

  const onClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const btn = (target?.closest?.('[data-fx]') as HTMLElement | null) ?? null;
    if (!btn) return;
    const handler = fxHandlers[btn.dataset.fx ?? ''];
    if (handler) handler(btn);
  };

  // Suppression runs in capture so the seam's delegated data-act listener
  // (registered earlier, on bubble) never sees the click the fan replaced.
  const onCapture = (e: MouseEvent): void => {
    if (!pendingSkip) return;
    const target = e.target as Node | null;
    if (target && pendingSkip.contains(target)) {
      pendingSkip = null;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.('[data-fx="like"]') as HTMLElement | null;
    if (!btn) return;
    void loadRxn(); // warm the tray chunk so the 380 ms hold never waits on it
    const timer = window.setTimeout(() => {
      const held = holdable.get(btn);
      if (held) held.fired = true;
      fanFor(btn);
    }, 380);
    holdable.set(btn, { timer, fired: false, x: e.clientX, y: e.clientY });
  };

  // A scroll or swipe must never be mistaken for a reaction: moving more than
  // 10 px cancels the hold before the tray can open.
  const onPointerMove = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.('[data-fx="like"]') as HTMLElement | null;
    const held = btn ? holdable.get(btn) : undefined;
    if (!held) return;
    if (Math.hypot(e.clientX - held.x, e.clientY - held.y) > 10) {
      window.clearTimeout(held.timer);
      holdable.delete(btn as HTMLElement);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.('[data-fx="like"]') as HTMLElement | null;
    if (!btn) return;
    const held = holdable.get(btn);
    if (!held) return;
    window.clearTimeout(held.timer);
    if (held.fired) pendingSkip = btn;
    holdable.delete(btn);
  };

  const onPointerCancel = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.('[data-fx="like"]') as HTMLElement | null;
    const held = btn ? holdable.get(btn) : undefined;
    if (held) {
      window.clearTimeout(held.timer);
      holdable.delete(btn as HTMLElement);
    }
  };

  // The fan emitted `micro:fan` on the button it replaced; translate it into a
  // laugh for surfaces that know what to do with one, without importing state.
  const onFan = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    const btn = e.target as HTMLElement | null;
    if (!btn || typeof detail !== 'string') return;
    if (detail !== 'laugh') {
      burst(btn);
      heartPop(btn);
      return;
    }
    btn.dispatchEvent(new CustomEvent('micro:laugh', { bubbles: true }));
  };

  document.addEventListener('click', onClick);
  document.addEventListener('click', onCapture, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
  document.addEventListener('micro:fan', onFan);
  watchToast();
  watchBadges();

  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('click', onCapture, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerCancel, true);
    document.removeEventListener('micro:fan', onFan);
  };
};

/** Exposed for the seam (ts-nocheck world) so markup can trigger effects too. */
export const microPublic = {
  pop,
  burst,
  flyTo,
  countTo,
  heartPop,
  deflate,
  drawCheck,
  ringFrom,
  animate,
  shouldAnimate,
  setSound: (v: boolean): void => synth.setEnabled(v),
};

export type MicroPublic = typeof microPublic;
