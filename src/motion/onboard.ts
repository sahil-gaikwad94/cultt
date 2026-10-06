/**
 * Onboarding is a sequence of scenes, not a stack of forms.
 *
 * Everything here is presentation wired to callbacks: the seam still owns the
 * state, the callbacks still run with or without the animations, and reduced
 * motion / Calm Mode swap each scene for its settled final frame.
 *
 *  * `stepTransition` — shared-element page change via the View Transitions
 *    API where supported, a crossfade fallback everywhere else.
 *  * `physicsStack`   — the meme calibration deck: drag, tilt, haptic ticks at
 *    the decision threshold, a spring fly-off. Buttons stay the primary path.
 *  * `waveList`       — the audio calibration list: each row plays a 7-second
 *    clip through the PreviewProvider (simulated here); a live waveform draws
 *    the progress while it runs.
 *  * `fpGrow` / `confidence` — the Fingerprint builds itself as answers land:
 *    contours appear one per few signals and the confidence number counts up.
 */

import { DUR, EASE, shouldAnimate, whileVisible } from './reduce';

/* ------------------------------------------------------------ shared bits */

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

const rngFor = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const canAnimate = (el: HTMLElement | null): el is HTMLElement => !!el && typeof el.animate === 'function';

const animate = (el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null => {
  if (!shouldAnimate() || !canAnimate(el)) return null;
  try {
    return el.animate(frames, { fill: 'none', ...opts });
  } catch {
    return null;
  }
};

/** The View Transitions API when the browser has it; a crossfade when not. */
let vtBusy = false;
export const stepTransition = async (host: HTMLElement | null, mutate: () => void): Promise<void> => {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => {
      finished: Promise<void>;
      ready?: Promise<void>;
      updateCallbackDone?: Promise<void>;
    };
  };
  // Chrome aborts a transition that begins while another is mid-flight
  // ("invalid state"), and the abort surfaces as a page error. One at a time;
  // a caller that arrives mid-transition simply mutates directly.
  if (vtBusy) {
    mutate();
    return;
  }
  if (!host || !shouldAnimate() || typeof doc.startViewTransition !== 'function') {
    mutate();
    if (host) {
      host.classList.remove('vt-fallback');
      void host.offsetWidth;
      animate(host, [{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: DUR.base,
        easing: EASE.ease,
      });
    }
    return;
  }
  vtBusy = true;
  try {
    const transition = doc.startViewTransition(() => mutate());
    /* Snapshot capture can fail on its own terms (canvas-heavy surfaces, some
       headless contexts) and Chrome rejects `ready` on nobody's watch. Keep
       every promise of the transition handled, so a failure degrades to the
       crossfade rather than an uncaught error in the console. */
    void transition.ready?.catch(() => undefined);
    void transition.updateCallbackDone?.catch(() => undefined);
    try {
      await transition.finished;
    } catch {
      /* the transition was skipped — the DOM swap already happened */
    }
  } finally {
    vtBusy = false;
  }
};

/* ------------------------------------------------------------ meme deck */

export interface StackItem {
  id: string;
  emoji: string;
  text: string;
  bg: string;
  fg: string;
}

export interface StackOptions {
  onDecide: (id: string, kind: 'laugh' | 'meh' | 'skip') => void;
  haptic?: (pattern: number | number[]) => void;
  /** Re-render when the deck empties; the seam appends the next five cards. */
  onDone?: () => void;
}

export interface StackHandle {
  render: () => void;
  /** Force the top card out (the visible buttons use the same path). */
  decide: (id: string, kind: 'laugh' | 'meh' | 'skip') => void;
  destroy: () => void;
}

/**
 * A physics-ish card stack: the top card tracks the pointer with tilt and
 * rotation, ticks once as it crosses the decision threshold (and again on the
 * way back), springs out on release, or settles with a spring if not.
 */
export const physicsStack = (host: HTMLElement, items: StackItem[], opts: StackOptions): StackHandle => {
  let index = 0;
  let gone = false;
  const THRESHOLD = 78;

  const escapeFor = (kind: 'laugh' | 'meh' | 'skip'): [number, number, number] =>
    kind === 'laugh' ? [300, -180, 26] : kind === 'meh' ? [-300, -120, -26] : [0, 420, 0];

  const draw = (): void => {
    if (gone) return;
    const live = items.slice(index, index + 3).reverse();
    host.innerHTML = live
      .map((m, i) => {
        const depth = live.length - 1 - i;
        const isTop = depth === 0;
        return `<div class="ob-stack-card ${isTop ? 'top' : 'behind'}" data-m="${m.id}" style="--bg:${m.bg};--fg:${m.fg};--depth:${depth}">
          <div class="ob-stack-in">
            <span class="ob-emoji" aria-hidden="true">${m.emoji}</span>
            <p>${m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
            ${isTop ? '<span class="ob-hint">drag toward a button, or use the buttons below</span>' : ''}
          </div>
        </div>`;
      })
      .join('');
    const top = host.querySelector('.ob-stack-card.top') as HTMLElement | null;
    if (top) bind(top);
  };

  const bind = (card: HTMLElement): void => {
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    let dragging = false;
    let side: 'laugh' | 'meh' | 'skip' | null = null;
    card.addEventListener('pointerdown', (e) => {
      if (e.target instanceof Element && e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      x = 0;
      y = 0;
      card.classList.add('grabbed');
      try {
        card.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      x = e.clientX - sx;
      y = e.clientY - sy;
      const was = side;
      side = Math.abs(x) > THRESHOLD || y > THRESHOLD ? (x < -THRESHOLD ? 'meh' : y > THRESHOLD ? 'skip' : 'laugh') : null;
      if (side !== was && side) opts.haptic?.(5);
      card.style.transform = `translate3d(${x * 0.9}px,${y * 0.7}px,0) rotate(${clamp(x / 16, -18, 18)}deg) rotateY(${clamp(x / 34, -8, 8)}deg)`;
      card.style.setProperty('--hint', side === 'laugh' ? '1' : '0');
      card.style.setProperty('--nah', side === 'meh' || side === 'skip' ? '1' : '0');
    });
    const end = (): void => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('grabbed');
      const speed = Math.abs(x) > 120 || Math.abs(y) > 140;
      if (side && speed) escape(card, card.dataset.m ?? '', side);
      else {
        card.style.transform = '';
        card.style.setProperty('--hint', '0');
        card.style.setProperty('--nah', '0');
        side = null;
        animate(card, [{ transform: card.style.transform || 'scale(1)' }, { transform: 'scale(1.01)' }, { transform: 'scale(1)' }], {
          duration: DUR.slow,
          easing: EASE.spring,
        });
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  };

  const escape = (card: HTMLElement, id: string, kind: 'laugh' | 'meh' | 'skip'): void => {
    const [tx, ty, rot] = escapeFor(kind);
    const finish = (): void => {
      index += 1;
      opts.onDecide(id, kind);
      if (index >= items.length) opts.onDone?.();
      else draw();
    };
    const anim = animate(
      card,
      [
        { transform: card.style.transform || 'translate3d(0,0,0)', opacity: 1 },
        { transform: `translate3d(${tx}px,${ty}px,0) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: DUR.slow, easing: EASE.ease },
    );
    if (anim) anim.finished.then(finish, finish);
    else finish();
  };

  const decide = (id: string, kind: 'laugh' | 'meh' | 'skip'): void => {
    const card = host.querySelector('.ob-stack-card.top') as HTMLElement | null;
    if (!card || card.dataset.m !== id) {
      index += 1;
      opts.onDecide(id, kind);
      if (index >= items.length) opts.onDone?.();
      else draw();
      return;
    }
    escape(card, id, kind);
  };

  draw();
  return {
    render: draw,
    decide,
    destroy: () => {
      gone = true;
    },
  };
};

/* ------------------------------------------------------- audio waveform */

export interface WaveItem {
  id: string;
  title: string;
  sub: string;
}

export interface WaveOptions {
  clipSeconds?: number;
  haptic?: (pattern: number | number[]) => void;
  onRate: (id: string, kind: 'react' | 'skip') => void;
  /** Status line from the PreviewProvider, shown under the active row. */
  status?: (id: string) => string;
}

export interface WaveHandle {
  destroy: () => void;
}

/**
 * Seven-second clip rows with a live waveform. No audio file ships: the clip is
 * simulated and the waveform is drawn from the same deterministic envelope the
 * production preview would be cut from, so the shape is the honest shape of the
 * moment. The PreviewProvider result (see src/lib/preview.ts) is what reports
 * whether a real preview exists.
 */
export const waveList = (host: HTMLElement, items: WaveItem[], opts: WaveOptions): WaveHandle => {
  const seconds = opts.clipSeconds ?? 7;
  let raf = 0;
  let stopVisible = () => undefined as void;
  let destroyed = false;
  let playingId: string | null = null;
  let startedAt = 0;
  let paused = false;

  host.innerHTML = items
    .map(
      (t) => `<div class="ob-wave" data-id="${t.id}">
      <button class="ob-wave-play" data-act="ob-wave" aria-label="Play the 7-second clip of ${t.title}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
      </button>
      <div class="ob-wave-body"><b>${t.title}</b><span class="ob-wave-status">${opts.status ? opts.status(t.id) : `${seconds}-second clip`}</span>
        <canvas class="ob-wave-cv" width="300" height="44" aria-hidden="true"></canvas></div>
      <div class="ob-wave-rate">
        <button class="chip on" data-act="ob-rate" data-v="react">React</button>
        <button class="chip" data-act="ob-rate" data-v="skip">Pass</button>
      </div>
    </div>`,
    )
    .join('');

  const envelopes = new Map<string, number[]>();
  const envelope = (id: string): number[] => {
    let e = envelopes.get(id);
    if (!e) {
      const r = rngFor(
        [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7),
      );
      e = Array.from({ length: 90 }, (_, i) => {
        const k = i / 90;
        const swell = 0.28 + 0.72 * Math.min(1, k * 1.7);
        const bridge = Math.abs(k - 0.62) < 0.07 ? 1.35 : 1;
        return clamp((0.22 + r() * 0.78) * swell * bridge, 0.08, 1);
      });
      envelopes.set(id, e);
    }
    return e;
  };

  const paint = (row: HTMLElement, progress: number): void => {
    const cv = row.querySelector('canvas') as HTMLCanvasElement | null;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 300;
    const h = 44;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const env = envelope(row.dataset.id ?? '');
    const bars = 46;
    for (let i = 0; i < bars; i++) {
      const e = (env[Math.floor((i / bars) * env.length)] ?? 0.4) as number;
      const beat = playingId === row.dataset.id ? 1 + 0.06 * Math.sin(performance.now() / 130 + i) : 1;
      const bh = clamp(e * (h - 8) * beat, 4, h - 4);
      const x = (i / bars) * (w - 4) + 2;
      const played = i / bars <= progress;
      ctx.fillStyle = played ? (i % 4 === 0 ? '#ff5d7a' : '#ffd166') : 'rgba(239,233,218,.22)';
      const y = (h - bh) / 2;
      const bw = Math.max(2, w / bars - 2.6);
      ctx.fillRect(x, y, bw, bh);
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x, y - 2, bw, bh + 4);
      ctx.globalAlpha = 1;
    }
  };

  const tickFrame = (): void => {
    if (destroyed || !playingId) return;
    if (!paused) {
      const elapsed = (performance.now() - startedAt) / 1000;
      const row = host.querySelector(`.ob-wave[data-id="${playingId}"]`) as HTMLElement | null;
      const progress = clamp(elapsed / seconds, 0, 1);
      if (row) paint(row, progress);
      if (progress >= 1) {
        playingId = null;
        host.querySelectorAll('.ob-wave.playing').forEach((n) => n.classList.remove('playing'));
        return;
      }
    } else {
      startedAt = performance.now() - pauseAt;
    }
    raf = requestAnimationFrame(tickFrame);
  };
  let pauseAt = 0;

  const toggle = (row: HTMLElement): void => {
    const id = row.dataset.id ?? '';
    if (playingId === id) {
      playingId = null;
      cancelAnimationFrame(raf);
      row.classList.remove('playing');
      opts.haptic?.(6);
      return;
    }
    host.querySelectorAll('.ob-wave.playing').forEach((n) => n.classList.remove('playing'));
    playingId = id;
    startedAt = performance.now();
    paused = false;
    row.classList.add('playing');
    opts.haptic?.(8);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tickFrame);
  };

  const onClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement)?.closest?.('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const row = btn.closest('.ob-wave') as HTMLElement | null;
    if (!row) return;
    const act = btn.dataset.act;
    if (act === 'ob-wave') toggle(row);
    else if (act === 'ob-rate') {
      const kind = btn.dataset.v === 'skip' ? 'skip' : 'react';
      row.querySelectorAll('.ob-wave-rate .chip').forEach((c) => c.classList.toggle('on', c === btn));
      row.classList.add('rated');
      opts.onRate(row.dataset.id ?? '', kind);
      opts.haptic?.(kind === 'react' ? [8, 24, 8] : 6);
      if (playingId === row.dataset.id) {
        playingId = null;
        cancelAnimationFrame(raf);
        row.classList.remove('playing');
      }
    }
  };
  host.addEventListener('click', onClick);

  // Ambient rAF must stop when the tab hides — and so must the pause clock.
  stopVisible =
    whileVisible((visible) => {
      if (!playingId) return;
      if (!visible) {
        paused = true;
        pauseAt = performance.now() - startedAt;
      } else {
        paused = false;
      }
    }) ?? (() => undefined);

  items.forEach((t) => {
    const row = host.querySelector(`.ob-wave[data-id="${t.id}"]`) as HTMLElement | null;
    if (row) paint(row, 0);
  });

  return {
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      host.removeEventListener('click', onClick);
      stopVisible();
    },
  };
};

/* ------------------------------------------------ live Fingerprint + % */

/** The contours grow with the signal: one new ring per few answers, drawn in. */
export const fpGrow = (host: HTMLElement | null, fraction: number): void => {
  if (!host) return;
  const f = clamp(fraction, 0, 1);
  const want = 3 + Math.round(f * 15);
  const seed = 4242;
  const r = rngFor(seed);
  const lobes = [3, 5, 8];
  const phase = [r() * 6.283, r() * 6.283, r() * 6.283];
  const amp = [0.4 + r() * 0.6, 0.3 + r() * 0.7, 0.2 + r() * 0.8];
  const cx = 100 + (r() - 0.5) * 8;
  const cy = 100 + (r() - 0.5) * 8;
  let out = '';
  for (let i = 0; i < want; i++) {
    const k = i / Math.max(1, want - 1);
    const base = 12 + k * 70;
    const wob = 0.8 + k * 6.4;
    let d = '';
    for (let a = 0; a <= 110; a++) {
      const t = (a / 110) * Math.PI * 2;
      const rr =
        base +
        wob *
          ((amp[0] ?? 0.5) * Math.sin(lobes[0] * t + phase[0] + k * 1.9) +
            0.7 * (amp[1] ?? 0.5) * Math.sin(lobes[1] * t + phase[1] - k * 2.4) +
            0.45 * (amp[2] ?? 0.5) * Math.sin(lobes[2] * t + phase[2] + k * 3.3));
      d += `${a ? 'L' : 'M'}${(cx + rr * Math.cos(t)).toFixed(1)} ${(cy + rr * Math.sin(t)).toFixed(1)}`;
    }
    out += `<path class="fp-ring ob-fp-ring" pathLength="1" d="${d}Z" stroke="${i % 2 ? '#ff8a5b' : '#EFE9DA'}" stroke-width="1.5" opacity="${(0.95 - k * 0.42).toFixed(2)}" style="--i:${i}"/>`;
  }
  const first = host.querySelectorAll('path').length === 0;
  host.innerHTML = `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" aria-hidden="true">${out}</svg>`;
  if (!first) {
    const added = host.querySelectorAll('path');
    const last = added[added.length - 1] as SVGPathElement | undefined;
    if (last && shouldAnimate() && typeof last.animate === 'function') {
      last.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: parseFloat(last.getAttribute('opacity') ?? '1'), transform: 'scale(1)' }], {
        duration: DUR.slow,
        easing: EASE.spring,
        fill: 'backwards',
      });
    }
  }
};

/** "Signal confidence" counts up; it is a count of answers, never a claim. */
export const confidence = (el: HTMLElement | null, fraction: number): void => {
  if (!el) return;
  const to = Math.round(clamp(fraction, 0, 1) * 100);
  const from = parseInt(el.textContent ?? '0', 10) || 0;
  el.setAttribute('aria-label', `Signal confidence ${to}%`);
  if (!shouldAnimate() || from === to) {
    el.textContent = String(to);
    return;
  }
  const t0 = performance.now();
  const dur = 360;
  const step = (now: number): void => {
    const k = clamp((now - t0) / dur, 0, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/* ------------------------------------------------------- final reveal */

export interface RevealStep {
  /** 'fingerprint' | 'tastecard' | 'duel' — the seam owns the markup. */
  id: string;
  el: HTMLElement;
}

/**
 * The reveal is three beats, not a spinner: the Fingerprint, then the Taste
 * Card, then the invitation to duel a friend. Each beat lifts into place on a
 * timer; a tap jumps straight to the last one. Function (the callback) runs
 * even under reduced motion — only the timing collapses.
 */
export const runReveal = (
  host: HTMLElement,
  steps: RevealStep[],
  done: () => void,
  opts: { perStep?: number; haptic?: (p: number | number[]) => void } = {},
): (() => void) => {
  const per = opts.perStep ?? 1500;
  let i = 0;
  let finished = false;
  const timers: number[] = [];
  const advance = (): void => {
    const step = steps[i];
    if (!step) {
      finished = true;
      done();
      return;
    }
    step.el.style.display = '';
    opts.haptic?.(i === steps.length - 1 ? [10, 30, 10] : 6);
    animate(step.el, [{ transform: 'translateY(22px) scale(.985)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], {
      duration: DUR.page,
      easing: EASE.spring,
    });
    i += 1;
    if (!finished && i < steps.length) timers.push(window.setTimeout(advance, shouldAnimate() ? per : 60));
    else if (!finished) timers.push(window.setTimeout(() => { finished = true; done(); }, shouldAnimate() ? per : 60));
  };
  // Tap anywhere jumps to the final beat.
  const jump = (): void => {
    if (finished) return;
    for (const t of timers) window.clearTimeout(t);
    while (i < steps.length) {
      const s = steps[i];
      if (s) s.el.style.display = '';
      i += 1;
    }
    finished = true;
    done();
  };
  host.addEventListener('pointerdown', jump);
  steps.forEach((s) => {
    s.el.style.display = 'none';
  });
  advance();
  return () => {
    for (const t of timers) window.clearTimeout(t);
    host.removeEventListener('pointerdown', jump);
  };
};
