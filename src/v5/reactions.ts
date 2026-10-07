/**
 * ReactionTray — the showpiece (build brief §6.3).
 *
 * One module, used on memes, songs, pins, stories and chat bubbles:
 *
 *   - long-press 350 ms opens it (thin progress ring, `tick` at 200 ms)
 *   - the tray springs in above the finger, items stagger 30 ms
 *   - finger-drag fisheye with a haptic tick per focus change
 *   - the chosen emoji flies a curved path to the reaction chip, which squashes
 *   - a signature FX plays per emoji (canvas particles, all ≤ 1.2 s)
 *   - fast repeats escalate cosmetically (x2, x3, x5 UNWELL) and never change
 *     stored state beyond the first reaction
 *
 * Every reaction is data: it nudges the humor axes. `REACTION_AXES` is the
 * single table for that, and the Fingerprint reads it.
 */

import { copy } from '../copy/index.ts';
import type { HumorAxis } from '../copy/taxonomy.ts';
import { haptics } from '../lib/haptics.ts';
import { getQuality } from './quality.ts';
import { getPerfHud } from './perfHud.ts';

export type ReactionSurfaceKind = 'meme' | 'song';
export type FxSurface = 'deck' | 'pin' | 'story' | 'chat' | 'vault' | 'onboarding';

export const MEME_REACTIONS = ['💀', '😭', '🗿', '🤡', '🧠', '🫠', '🥹', '🔥'] as const;
export const SONG_REACTIONS = ['🔥', '🎧', '🥹', '😭', '🤌', '🫠', '🕺', '💀'] as const;

/**
 * Axis weights per reaction (brief §6.3 "Meaning"). 🔥 adds none; song-only
 * reactions add genre/vibe weight, handled by the caller.
 */
export const REACTION_AXES: Record<string, Partial<Record<HumorAxis, number>>> = {
  '💀': { absurdist: 0.6, chaotic: 0.4 },
  '😭': { wholesome: 1 },
  '🗿': { deadpan: 1 },
  '🤡': { chaotic: 1 },
  '🧠': { niche_refs: 0.6, dry_wit: 0.4 },
  '🫠': { dry_wit: 1 },
  '🥹': { wholesome: 1 },
  '🔥': {},
  '🎧': {},
  '🤌': {},
  '🕺': { chaotic: 0.4 },
};

export const trayFor = (kind: ReactionSurfaceKind): readonly string[] =>
  kind === 'song' ? SONG_REACTIONS : MEME_REACTIONS;

export const reactionName = (kind: ReactionSurfaceKind, emoji: string): string =>
  (kind === 'song' ? copy.reactions.song : copy.reactions.meme)[emoji] ?? emoji;

/** Accumulates reaction weights into an axis vector. Pure — the tests pin it. */
export const axisVector = (reactions: readonly { emoji: string; weight?: number }[]): Partial<Record<HumorAxis, number>> => {
  const out: Record<string, number> = {};
  for (const reaction of reactions) {
    const weights = REACTION_AXES[reaction.emoji];
    if (!weights) continue;
    for (const [axis, value] of Object.entries(weights)) {
      out[axis] = (out[axis] ?? 0) + (value ?? 0) * (reaction.weight ?? 1);
    }
  }
  return out;
};

/* ------------------------------------------------------------- geometry -- */

export interface TrayItem {
  emoji: string;
  name: string;
  /** Centre in tray-local px. */
  x: number;
  y: number;
}

export const TRAY_ITEM_SPACING = 46;
export const TRAY_PADDING = 18;
export const TRAY_HEIGHT = 62;

/** Lays the tray out, centred on the anchor but clamped inside the viewport. */
export const layoutTray = (
  emojis: readonly string[],
  kind: ReactionSurfaceKind,
  anchorX: number,
  viewportWidth: number,
): { items: TrayItem[]; left: number; width: number } => {
  const width = emojis.length * TRAY_ITEM_SPACING + TRAY_PADDING * 2;
  const left = Math.max(8, Math.min(viewportWidth - width - 8, anchorX - width / 2));
  const items = emojis.map((emoji, index) => ({
    emoji,
    name: reactionName(kind, emoji),
    x: TRAY_PADDING + index * TRAY_ITEM_SPACING + TRAY_ITEM_SPACING / 2,
    y: TRAY_HEIGHT / 2,
  }));
  return { items, left, width };
};

/**
 * Gaussian fisheye. The emoji under the finger magnifies; its neighbours scale
 * by distance. Returns the scale for each item plus the focused index.
 */
export const fisheye = (
  items: readonly TrayItem[],
  pointerX: number,
  trayLeft: number,
  options: { maxScale?: number; sigma?: number } = {},
): { scales: number[]; focus: number | null } => {
  const maxScale = options.maxScale ?? 1.75;
  const sigma = options.sigma ?? TRAY_ITEM_SPACING * 0.85;
  const local = pointerX - trayLeft;
  const scales: number[] = [];
  let focus: number | null = null;
  let bestDistance = Infinity;

  for (let i = 0; i < items.length; i += 1) {
    const distance = Math.abs(items[i].x - local);
    const scale = 1 + (maxScale - 1) * Math.exp(-(distance * distance) / (2 * sigma * sigma));
    scales.push(scale);
    if (distance < bestDistance) {
      bestDistance = distance;
      focus = i;
    }
  }
  // Outside the tray entirely cancels rather than snapping to the nearest.
  if (local < 0 || local > items.length * TRAY_ITEM_SPACING + TRAY_PADDING * 2) focus = null;
  return { scales, focus };
};

/** Quadratic Bézier for the emoji's flight to the chip. */
export const flightPoint = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
  lift = 0.35,
): { x: number; y: number; scale: number; rotate: number } => {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - Math.abs(to.x - from.x) * lift - 40;
  const inv = 1 - t;
  const x = inv * inv * from.x + 2 * inv * t * cx + t * t * to.x;
  const y = inv * inv * from.y + 2 * inv * t * cy + t * t * to.y;
  // Grow on the way out, settle on the way in.
  const scale = 1 + Math.sin(t * Math.PI) * 0.85;
  return { x, y, scale, rotate: (t - 0.5) * 28 };
};

/** Chip squash keyframes: scaleY 0.8 → 1.1 → 1. */
export const CHIP_SQUASH: Keyframe[] = [
  { transform: 'scale(1,1)' },
  { transform: 'scale(1.14,0.8)', offset: 0.25 },
  { transform: 'scale(0.94,1.1)', offset: 0.6 },
  { transform: 'scale(1,1)' },
];

/** Combo thresholds. Cosmetic only — never stored beyond the first reaction. */
export const comboLabel = (count: number): string | null => (count >= 2 ? copy.reactions.combo(count) : null);

/* ------------------------------------------------------------------- FX -- */

export type SignatureFx =
  | 'dead'
  | 'cant-breathe'
  | 'deadpan'
  | 'self-own'
  | 'galaxy-brain'
  | 'existential'
  | 'soft'
  | 'slaps'
  | 'on-repeat'
  | 'chefs-kiss'
  | 'moves';

export const FX_FOR_EMOJI: Record<string, SignatureFx> = {
  '💀': 'dead',
  '😭': 'cant-breathe',
  '🗿': 'deadpan',
  '🤡': 'self-own',
  '🧠': 'galaxy-brain',
  '🫠': 'existential',
  '🥹': 'soft',
  '🔥': 'slaps',
  '🎧': 'on-repeat',
  '🤌': 'chefs-kiss',
  '🕺': 'moves',
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  glyph: string | null;
  colour: string;
}

export interface FxOptions {
  /** Overlay canvas shared by every effect. One canvas, pooled particles. */
  canvas: HTMLCanvasElement;
  /** The item being reacted to, for effects that move it. */
  target?: HTMLElement | null;
  reducedMotion?: boolean;
}

/**
 * The shared particle overlay. Pooled and capped at the tier's particle count
 * (§10: ≤ 300 live, DPR capped at 2). One canvas for the whole app.
 */
export const createFxLayer = (options: FxOptions) => {
  const canvas = options.canvas;
  const ctx = canvas.getContext('2d');
  const pool: Particle[] = [];
  let raf = 0;
  let running = false;
  const hud = getPerfHud();

  const resize = () => {
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const cap = (): number => getQuality().caps.particles;

  const spawn = (particle: Partial<Particle> & { x: number; y: number }) => {
    if (pool.length >= cap()) return;
    pool.push({
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 800,
      size: 8,
      glyph: null,
      colour: '#EFE9DA',
      ...particle,
    });
    hud.track('particles', 1);
  };

  const tick = (now: number) => {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    const dt = 16;

    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const p = pool[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        pool.splice(i, 1);
        hud.track('particles', -1);
        continue;
      }
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.12;
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, alpha);
      if (p.glyph) {
        ctx.font = `${p.size * 2}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.glyph, p.x, p.y);
      } else {
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (pool.length) raf = requestAnimationFrame(tick);
    else {
      running = false;
      raf = 0;
    }
    void now;
  };

  const ensureRunning = () => {
    if (running) return;
    running = true;
    resize();
    raf = requestAnimationFrame(tick);
  };

  const burstAt = (x: number, y: number, count: number, make: (i: number) => Partial<Particle>) => {
    const tierCap = getQuality().tier === 'B' ? Math.ceil(count / 2) : count;
    if (getQuality().tier === 'C') return;
    for (let i = 0; i < tierCap; i += 1) spawn({ x, y, ...make(i) });
    ensureRunning();
  };

  const reduced = () =>
    options.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);

  /** Runs the signature FX for an emoji. Returns when it is done (≤ 1.2 s). */
  const play = (emoji: string, at: { x: number; y: number }): Promise<void> => {
    const fx = FX_FOR_EMOJI[emoji];
    if (!fx) return Promise.resolve();

    // Tier C: a colour flash and nothing else.
    if (getQuality().tier === 'C' || reduced()) {
      const target = options.target;
      if (target) {
        target.animate([{ filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], { duration: 220, easing: 'ease-out' });
      }
      return new Promise((resolve) => setTimeout(resolve, 220));
    }

    const target = options.target;
    const animate = (keyframes: Keyframe[], timing: KeyframeAnimationOptions) =>
      target?.animate(keyframes, { easing: 'cubic-bezier(.22,.61,.36,1)', ...timing });

    switch (fx) {
      case 'dead':
        animate?.([{ transform: 'translateY(0) rotate(0)', filter: 'saturate(1)' }, { transform: 'translateY(10px) rotate(-3deg)', filter: 'saturate(0.15)', offset: 0.45 }, { transform: 'translateY(0) rotate(0)', filter: 'saturate(1)' }], { duration: 900 });
        burstAt(at.x, at.y, 10, (i) => ({ glyph: '💀', vy: -3 - i * 0.2, vx: (i % 3) - 1, maxLife: 900, size: 11 }));
        break;
      case 'cant-breathe':
        animate?.([{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)', offset: 0.12 }, { transform: 'translate(3px,-2px)', offset: 0.24 }, { transform: 'translate(0,0)', offset: 0.36 }, { transform: 'translate(-3px,1px)', offset: 0.5 }, { transform: 'translate(0,0)' }], { duration: 700 });
        burstAt(at.x, at.y, 16, (i) => ({ glyph: i % 4 === 0 ? '😭' : null, colour: '#8fb4ff', vx: (i % 5) - 2, vy: -2.5, maxLife: 850, size: i % 4 === 0 ? 10 : 3 }));
        haptics.play('laugh');
        break;
      case 'deadpan':
        animate?.([{ transform: 'translateY(-14px) scale(1.02)' }, { transform: 'translateY(0) scale(1)', offset: 0.35 }, { transform: 'translateY(0) scale(1)' }], { duration: 480 });
        burstAt(at.x, at.y + 18, 14, (i) => ({ colour: '#b9b5aa', vx: (i % 7) - 3, vy: -1, maxLife: 700, size: 4 }));
        haptics.play('thud');
        break;
      case 'self-own':
        burstAt(at.x, at.y - 10, 8, (i) => ({ glyph: i === 0 ? '🥳' : '🔴', vx: (i % 3) - 1, vy: -2.4, maxLife: 900, size: i === 0 ? 12 : 5 }));
        break;
      case 'galaxy-brain':
        burstAt(at.x, at.y, 18, (i) => {
          const angle = (i / 18) * Math.PI * 2;
          return { colour: '#E8C77E', vx: Math.cos(angle) * 2.4, vy: Math.sin(angle) * 2.4, maxLife: 1000, size: 2.5 };
        });
        break;
      case 'existential':
        animate?.([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.9) translateY(6px)', offset: 0.5 }, { transform: 'scaleY(1)' }], { duration: 900 });
        burstAt(at.x, at.y, 10, (i) => ({ colour: '#8e8b83', vx: (i % 3) - 1, vy: 1.5, maxLife: 1000, size: 3 }));
        break;
      case 'soft':
        burstAt(at.x, at.y, 14, (i) => ({ glyph: i % 3 === 0 ? '✨' : null, colour: '#ffd166', vx: (i % 5) - 2, vy: -1.4, maxLife: 1100, size: i % 3 === 0 ? 8 : 2.5 }));
        break;
      case 'slaps':
        burstAt(at.x, at.y, 16, (i) => ({ glyph: i % 5 === 0 ? '🔥' : null, colour: '#ff9466', vx: (i % 5) - 2, vy: -2.8, maxLife: 1000, size: i % 5 === 0 ? 9 : 3 }));
        break;
      case 'on-repeat':
        burstAt(at.x, at.y, 12, (i) => {
          const angle = (i / 12) * Math.PI * 2;
          return { colour: '#E8C77E', vx: Math.cos(angle) * 1.6, vy: Math.sin(angle) * 1.6, maxLife: 900, size: 2 };
        });
        break;
      case 'chefs-kiss':
        burstAt(at.x, at.y, 12, (i) => ({ glyph: i % 4 === 0 ? '✨' : null, colour: '#E8C77E', vx: (i % 5) - 2, vy: -1.8, maxLife: 900, size: i % 4 === 0 ? 8 : 2 }));
        break;
      case 'moves':
        burstAt(at.x, at.y, 14, (i) => ({ colour: i % 2 ? '#35F2FF' : '#FF2E97', vx: 0, vy: -2.2, maxLife: 800, size: 3 }));
        break;
      default:
        break;
    }

    return new Promise((resolve) => setTimeout(resolve, 1200));
  };

  return {
    play,
    burstAt,
    get live() {
      return pool.length;
    },
    resize,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      hud.track('particles', -pool.length);
      pool.length = 0;
    },
  };
};

/* ------------------------------------------------------------ the tray --- */

export interface TrayResult {
  emoji: string | null;
  /** Where the finger released, in viewport px. Used as the FX origin. */
  at: { x: number; y: number };
  /** True when the release happened outside the tray. */
  cancelled: boolean;
}

export interface OpenTrayOptions {
  kind: ReactionSurfaceKind;
  /** Viewport coordinates of the press. */
  anchor: { x: number; y: number };
  viewport?: { width: number; height: number };
  doc?: Document;
  /** The element being reacted to, so FX can move it. */
  target?: HTMLElement | null;
  reducedMotion?: boolean;
}

const LONG_PRESS_MS = 350;
const TICK_AT_MS = 200;
const STAGGER_MS = 30;

/**
 * Opens the tray and resolves when the user selects or cancels.
 *
 * The whole interaction is interruptible: a second press cancels the first,
 * and releasing outside the tray cancels rather than picking the nearest emoji.
 */
export const openReactionTray = (options: OpenTrayOptions): Promise<TrayResult> => {
  const doc = options.doc ?? document;
  const viewport = options.viewport ?? {
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
  };
  const reduced =
    options.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);

  const emojis = trayFor(options.kind);
  const { items, left, width } = layoutTray(emojis, options.kind, options.anchor.x, viewport.width);
  const above = options.anchor.y > 120;
  const top = above ? options.anchor.y - TRAY_HEIGHT - 28 : options.anchor.y + 28;

  const scrim = doc.createElement('div');
  scrim.className = 'tray-scrim';

  const tray = doc.createElement('div');
  tray.className = 'reaction-tray';
  tray.setAttribute('role', 'menu');
  tray.setAttribute('aria-label', copy.reactions.holdHint);
  tray.style.cssText = `left:${left}px;top:${Math.max(8, Math.min(viewport.height - TRAY_HEIGHT - 8, top))}px;width:${width}px;height:${TRAY_HEIGHT}px`;

  for (const item of items) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'tray-item';
    button.dataset.emoji = item.emoji;
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', item.name);
    button.style.cssText = `left:${item.x - TRAY_ITEM_SPACING / 2}px;top:${item.y - TRAY_ITEM_SPACING / 2}px`;
    button.innerHTML = `<span class="tray-glyph" aria-hidden="true">${item.emoji}</span><span class="tray-name">${item.name}</span>`;
    tray.appendChild(button);
  }

  doc.body.appendChild(scrim);
  doc.body.appendChild(tray);

  if (reduced) {
    tray.classList.add('is-visible');
  } else {
    tray.animate([{ opacity: 0, transform: 'translateY(10px) scale(.82)' }, { opacity: 1, transform: 'none' }], {
      duration: 260,
      easing: 'cubic-bezier(.34,1.3,.5,1)',
      fill: 'forwards',
    });
    [...tray.querySelectorAll<HTMLElement>('.tray-item')].forEach((node, index) => {
      node.animate([{ opacity: 0, transform: 'translateY(8px) scale(.6)' }, { opacity: 1, transform: 'none' }], {
        duration: 300,
        delay: index * STAGGER_MS,
        easing: 'cubic-bezier(.34,1.3,.5,1)',
        fill: 'both',
      });
    });
  }

  return new Promise<TrayResult>((resolve) => {
    let settled = false;
    let focused: number | null = null;

    const finish = (result: TrayResult) => {
      if (settled) return;
      settled = true;
      doc.removeEventListener('pointerup', onUp, true);
      doc.removeEventListener('pointermove', onMove, true);
      doc.removeEventListener('pointercancel', onCancel, true);
      const remove = () => {
        tray.remove();
        scrim.remove();
      };
      if (reduced) remove();
      else {
        const animation = tray.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px) scale(.9)' }], {
          duration: 160,
          easing: 'ease-in',
          fill: 'forwards',
        });
        animation.finished.then(remove, remove);
      }
      resolve(result);
    };

    const applyFisheye = (clientX: number) => {
      const { scales, focus } = fisheye(items, clientX, left);
      [...tray.querySelectorAll<HTMLElement>('.tray-item')].forEach((node, index) => {
        node.style.transform = `scale(${scales[index].toFixed(3)})`;
        node.classList.toggle('is-focus', index === focus);
      });
      if (focus !== focused) {
        focused = focus;
        if (focus !== null) haptics.play('tick');
      }
    };

    const onMove = (event: PointerEvent) => applyFisheye(event.clientX);

    const onUp = (event: PointerEvent) => {
      applyFisheye(event.clientX);
      const index = focused;
      if (index === null) {
        finish({ emoji: null, at: { x: event.clientX, y: event.clientY }, cancelled: true });
        return;
      }
      haptics.play('light');
      finish({ emoji: items[index].emoji, at: { x: event.clientX, y: event.clientY }, cancelled: false });
    };

    const onCancel = () => finish({ emoji: null, at: options.anchor, cancelled: true });

    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointermove', onMove, true);
    doc.addEventListener('pointercancel', onCancel, true);

    // A plain tap (no drag) still selects whatever is under the finger.
    applyFisheye(options.anchor.x);
    void LONG_PRESS_MS;
    void TICK_AT_MS;
  });
};

/**
 * Attaches long-press-to-react to any surface.
 *
 * The ring fills over 350 ms, `tick` fires at 200 ms, and moving more than
 * 10 px cancels the press so a scroll is never mistaken for a reaction.
 */
export const attachReactionTrigger = (
  element: HTMLElement,
  onSelect: (result: TrayResult) => void,
  options: { kind: ReactionSurfaceKind; doc?: Document } = { kind: 'meme' },
): (() => void) => {
  const doc = options.doc ?? document;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let ring: HTMLElement | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    if (tickTimer) clearTimeout(tickTimer);
    timer = null;
    tickTimer = null;
    ring?.remove();
    ring = null;
    start = null;
  };

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    start = { x: event.clientX, y: event.clientY };

    ring = doc.createElement('div');
    ring.className = 'hold-ring';
    ring.style.cssText = `left:${event.clientX}px;top:${event.clientY}px`;
    doc.body.appendChild(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.2 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], {
      duration: LONG_PRESS_MS,
      easing: 'linear',
      fill: 'forwards',
    });

    tickTimer = setTimeout(() => haptics.play('tick'), TICK_AT_MS);
    timer = setTimeout(() => {
      const anchor = start ?? { x: event.clientX, y: event.clientY };
      clear();
      void openReactionTray({
        kind: options.kind,
        anchor,
        doc,
        target: element,
      }).then(onSelect);
    }, LONG_PRESS_MS);
  };

  const onMove = (event: PointerEvent) => {
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clear();
  };

  element.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointermove', onMove, { passive: true });
  const onUp = () => clear();
  doc.addEventListener('pointerup', onUp, { passive: true });
  doc.addEventListener('pointercancel', onUp, { passive: true });

  return () => {
    clear();
    element.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerup', onUp);
    doc.removeEventListener('pointercancel', onUp);
  };
};
