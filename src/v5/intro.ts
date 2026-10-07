/**
 * The intro (build brief §5.1).
 *
 * The whole sequence is a **pure function of time**: `renderIntro(t)` returns
 * the complete frame description for any `t` in `[0, 5.5]`. The live player and
 * the frame-by-frame video capture (`scripts/render-intro.ts`) both call the
 * same function, so what ships and what is rendered to a tier-C video cannot
 * drift apart.
 *
 * Acceptance targets: first frame paints under 400 ms (the poster is inline,
 * the JS chunk is lazy), and ≥ 55 fps p95 at 4× CPU throttle on tier A.
 *
 * Timeline (seconds):
 *   0.0–0.4   black; one ember dot pulses once
 *   0.4–1.6   contour lines bloom outward, ember warms to bone
 *   1.2–2.6   real memes deal in on springs with 3D tilt; each landing sends a
 *             ripple through the contours and a 2–3 px camera nudge
 *   2.4–3.4   kinetic type: "Match on your humor." then "Not your headshot."
 *             in gold, where "headshot" pixelates and vanishes
 *   3.2–4.2   the contours morph into an audio waveform with an EQ bounce
 *   4.2–5.2   everything collapses into the logo mark; the wordmark assembles
 *             letter by letter; one light sweep
 *   5.2+      the CTA rises with a calm idle drift
 */

export const INTRO_DURATION = 5.5;
export const INTRO_CTA_AT = 5.2;
export const WORDMARK = 'cultured';

export const EMBER = '#ff9466';
export const BONE = '#EFE9DA';
export const GOLD = '#E8C77E';

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamped 0..1 progress through a `[start, end]` window. */
export const progress = (t: number, start: number, end: number): number => {
  if (end <= start) return t >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (t - start) / (end - start)));
};

/** Ease-out cubic — system motion. Springs are handled by `spring()`. */
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Critically-damped-ish spring, evaluated analytically so the same value comes
 * out in the player and in a frame capture. `stiffness` ~80, `damping` ~10.
 */
export const spring = (t: number, stiffness = 80, damping = 10): number => {
  if (t <= 0) return 0;
  const w = Math.sqrt(stiffness);
  const zeta = damping / (2 * Math.sqrt(stiffness));
  if (zeta < 1) {
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
};

export interface IntroCard {
  index: number;
  /** 0..1 deal progress. */
  deal: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  /** Degrees of 3D tilt around Y. */
  tilt: number;
  opacity: number;
  /** The ripple this card sent into the contours on landing. */
  ripple: number;
}

export interface IntroFrame {
  t: number;
  /** Overall progress 0..1, for the capture harness. */
  progress: number;
  ember: { opacity: number; scale: number; colour: string };
  contours: {
    /** 0..1 — how far the isolines have bloomed from the centre. */
    bloom: number;
    /** Animated isoline threshold. */
    threshold: number;
    colour: string;
    /** 0..1 morph toward the waveform shape. */
    waveform: number;
    opacity: number;
  };
  waveform: { opacity: number; eq: number };
  cards: IntroCard[];
  /** 2–3 px camera nudge, driven by card landings. */
  camera: { x: number; y: number };
  type: {
    line1: number;
    line2: number;
    /** 0..1 pixelation of the word "headshot". */
    headshot: number;
    opacity: number;
  };
  logo: {
    /** 0..1 collapse of everything into the mark. */
    collapse: number;
    /** How many wordmark letters have landed. */
    letters: number;
    /** 0..1 light sweep across the wordmark. */
    sweep: number;
    opacity: number;
  };
  cta: { opacity: number; y: number };
  /** Which tier should render this frame — surfaces in the HUD. */
  phase: 'ember' | 'bloom' | 'deal' | 'type' | 'waveform' | 'collapse' | 'cta';
}

/** Card landing times, staggered inside the 1.2–2.6 s window. */
const CARD_COUNT = 5;
const cardLandAt = (index: number): number => 1.2 + index * ((2.6 - 1.2 - 0.35) / Math.max(1, CARD_COUNT - 1));

/** Fan layout: cards stack and fan out from the centre. */
const cardTarget = (index: number): { x: number; y: number; rotate: number } => {
  const spread = index - (CARD_COUNT - 1) / 2;
  return { x: spread * 54, y: Math.abs(spread) * 10 - 8, rotate: spread * 7.5 };
};

/**
 * The whole frame, for any `t`. Deterministic and side-effect free.
 *
 * `memes` is how many real memes are available to deal in; the sequence adapts
 * rather than inventing placeholders when the catalog is small.
 */
export const renderIntro = (t: number, memes = CARD_COUNT): IntroFrame => {
  const time = Math.max(0, t);
  /* Never invent cards: an empty catalog means an empty fan, and the ember,
     the contours and the wordmark carry the sequence on their own. */
  const cardCount = Math.max(0, Math.min(CARD_COUNT, Math.floor(memes)));

  /* ---- ember: one pulse, then it becomes the contours ---- */
  const emberPulse = progress(time, 0, 0.4);
  const emberFade = progress(time, 0.4, 1.6);
  const emberColour = mixHex(EMBER, BONE, easeOut(emberFade));

  /* ---- contours bloom outward ---- */
  const bloom = easeOut(progress(time, 0.4, 1.6));

  /* ---- cards deal in on springs ---- */
  const cards: IntroCard[] = [];
  for (let i = 0; i < cardCount; i += 1) {
    const land = cardLandAt(i);
    const local = Math.max(0, time - land);
    const deal = spring(local, 90, 11);
    const target = cardTarget(i);
    // Ripple fires on landing and decays over ~600 ms.
    const ripple = local > 0 ? Math.max(0, 1 - local / 0.6) : 0;
    cards.push({
      index: i,
      deal,
      x: lerp(0, target.x, deal),
      // Deal in from below-right, like a hand laying cards down.
      y: lerp(240, target.y, deal),
      rotate: lerp(26, target.rotate, deal),
      scale: lerp(0.72, 1, deal),
      tilt: lerp(38, 6, deal),
      opacity: Math.min(1, deal * 1.6),
      ripple,
    });
  }

  /* ---- camera nudge: sum of the live ripples, capped at 3 px ---- */
  const rippleSum = cards.reduce((sum, card) => sum + card.ripple, 0);
  const camera = {
    x: Math.max(-3, Math.min(3, Math.sin(time * 11) * rippleSum * 1.6)),
    y: Math.max(-3, Math.min(3, Math.cos(time * 9) * rippleSum * 1.4)),
  };

  /* ---- kinetic type ---- */
  const line1 = easeOut(progress(time, 2.4, 2.95));
  const line2 = easeOut(progress(time, 2.85, 3.4));
  // "headshot" pixelates and vanishes over the last 300 ms of the beat.
  const headshot = progress(time, 3.05, 3.4);

  /* ---- contours morph into a waveform ---- */
  const wave = easeInOut(progress(time, 3.2, 4.2));
  const eq = Math.abs(Math.sin(time * 7.5)) * progress(time, 3.3, 3.6) * (1 - progress(time, 4.0, 4.3));

  /* ---- collapse into the mark, wordmark assembles ---- */
  const collapse = easeInOut(progress(time, 4.2, 5.2));
  const letters = Math.round(progress(time, 4.45, 5.15) * WORDMARK.length);
  const sweep = progress(time, 4.95, 5.45);

  /* ---- CTA ---- */
  const ctaProgress = easeOut(progress(time, INTRO_CTA_AT, INTRO_CTA_AT + 0.6));

  const phase: IntroFrame['phase'] =
    time < 0.4 ? 'ember' : time < 1.2 ? 'bloom' : time < 2.4 ? 'deal' : time < 3.2 ? 'type' : time < 4.2 ? 'waveform' : time < INTRO_CTA_AT ? 'collapse' : 'cta';

  return {
    t: time,
    progress: Math.min(1, time / INTRO_DURATION),
    ember: {
      opacity: emberPulse * (1 - emberFade * 0.85),
      scale: 0.6 + Math.sin(emberPulse * Math.PI) * 0.9 + emberFade * 0.4,
      colour: emberColour,
    },
    contours: {
      bloom,
      threshold: 0.25 + bloom * 0.5 + Math.sin(time * 1.4) * 0.04,
      colour: emberColour,
      waveform: wave,
      opacity: bloom * (1 - collapse * 0.9),
    },
    waveform: { opacity: wave * (1 - collapse), eq },
    cards,
    camera,
    type: { line1, line2, headshot, opacity: line1 * (1 - collapse) },
    logo: { collapse, letters, sweep, opacity: collapse },
    cta: { opacity: ctaProgress, y: (1 - ctaProgress) * 24 },
    phase,
  };
};

/** Mixes two hex colours. */
export const mixHex = (from: string, to: string, t: number): string => {
  const parse = (hex: string): [number, number, number] => {
    const value = parseInt(hex.replace('#', ''), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const a = parse(from);
  const b = parse(to);
  const k = Math.max(0, Math.min(1, t));
  return `#${a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join('')}`;
};

/* --------------------------------------------------------------- player -- */

export interface IntroHandle {
  skip(): void;
  destroy(): void;
  /** The current frame, for tests and the capture harness. */
  frame(): IntroFrame;
}

export interface IntroOptions {
  host: HTMLElement;
  /** Real memes to deal in. The intro never invents content. */
  memes: { src: string; alt: string }[];
  onDone: () => void;
  doc?: Document;
  reducedMotion?: boolean;
  /** Fixed clock for deterministic capture. */
  now?: () => number;
}

/**
 * Plays the intro. Reduced motion collapses it to the poster plus the CTA, as
 * §5.1 requires — no parallax, no shaking, nothing animated.
 */
export const mountIntro = (options: IntroOptions): IntroHandle => {
  const doc = options.doc ?? document;
  const reduced =
    options.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);

  const root = doc.createElement('div');
  root.className = 'v5-intro';
  root.setAttribute('role', 'presentation');
  root.innerHTML = `
    <canvas class="v5-intro-field" aria-hidden="true"></canvas>
    <div class="v5-intro-cards" aria-hidden="true"></div>
    <div class="v5-intro-type" aria-hidden="true">
      <p class="v5-intro-line v5-intro-line-1">Match on your humor.</p>
      <p class="v5-intro-line v5-intro-line-2">Not your <span class="v5-intro-headshot">headshot</span>.</p>
    </div>
    <div class="v5-intro-logo" aria-hidden="true">
      <span class="v5-intro-mark"></span>
      <span class="v5-intro-word">${[...WORDMARK].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span>
    </div>
    <div class="v5-intro-cta">
      <button type="button" class="v5-intro-primary">Find my fingerprint</button>
      <button type="button" class="v5-intro-secondary">I already have one</button>
    </div>
    <button type="button" class="v5-intro-skip" aria-label="Skip the intro">Skip</button>`;

  options.host.appendChild(root);

  const cardsHost = root.querySelector<HTMLElement>('.v5-intro-cards')!;
  const cardNodes = options.memes.slice(0, CARD_COUNT).map((meme) => {
    const node = doc.createElement('img');
    node.className = 'v5-intro-card';
    node.src = meme.src;
    node.alt = '';
    node.setAttribute('aria-hidden', 'true');
    node.decoding = 'async';
    cardsHost.appendChild(node);
    return node;
  });

  const line1 = root.querySelector<HTMLElement>('.v5-intro-line-1')!;
  const line2 = root.querySelector<HTMLElement>('.v5-intro-line-2')!;
  const headshot = root.querySelector<HTMLElement>('.v5-intro-headshot')!;
  const logo = root.querySelector<HTMLElement>('.v5-intro-logo')!;
  const wordLetters = [...root.querySelectorAll<HTMLElement>('.v5-intro-word i')];
  const cta = root.querySelector<HTMLElement>('.v5-intro-cta')!;
  const field = root.querySelector<HTMLCanvasElement>('.v5-intro-field')!;

  let current: IntroFrame = renderIntro(0, options.memes.length);
  let raf = 0;
  let destroyed = false;
  let startedAt = 0;
  const now = options.now ?? (() => performance.now());

  const paint = (frame: IntroFrame) => {
    current = frame;
    const { camera } = frame;
    root.style.setProperty('--intro-x', `${camera.x.toFixed(2)}px`);
    root.style.setProperty('--intro-y', `${camera.y.toFixed(2)}px`);

    cardNodes.forEach((node, index) => {
      const card = frame.cards[index];
      if (!card) {
        node.style.opacity = '0';
        return;
      }
      node.style.opacity = String(card.opacity);
      node.style.transform = `translate3d(${card.x.toFixed(1)}px, ${card.y.toFixed(1)}px, 0) rotate(${card.rotate.toFixed(2)}deg) rotateY(${card.tilt.toFixed(1)}deg) scale(${card.scale.toFixed(3)})`;
    });

    line1.style.opacity = String(frame.type.line1);
    line1.style.clipPath = `inset(0 ${(100 - frame.type.line1 * 100).toFixed(1)}% 0 0)`;
    line2.style.opacity = String(frame.type.line2);
    line2.style.clipPath = `inset(0 ${(100 - frame.type.line2 * 100).toFixed(1)}% 0 0)`;
    // A CSS filter blur+contrast reads as pixelation and stays on the GPU.
    headshot.style.filter = frame.type.headshot > 0 ? `blur(${(frame.type.headshot * 7).toFixed(1)}px)` : 'none';
    headshot.style.opacity = String(1 - frame.type.headshot);

    logo.style.opacity = String(frame.logo.opacity);
    wordLetters.forEach((letter, index) => {
      letter.style.opacity = index < frame.logo.letters ? '1' : '0';
      letter.style.transform = index < frame.logo.letters ? 'none' : 'translateY(10px)';
    });
    logo.style.setProperty('--sweep', frame.logo.sweep.toFixed(3));

    cta.style.opacity = String(frame.cta.opacity);
    cta.style.transform = `translateY(${frame.cta.y.toFixed(1)}px)`;
    root.dataset.phase = frame.phase;

    drawField(field, frame);
  };

  const tick = () => {
    if (destroyed) return;
    const t = (now() - startedAt) / 1000;
    paint(renderIntro(t, options.memes.length));
    if (t >= INTRO_CTA_AT + 0.7) {
      raf = 0;
      // Idle drift keeps running cheaply: one transform, no repaint.
      raf = requestAnimationFrame(idle);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const idle = () => {
    if (destroyed) return;
    const t = (now() - startedAt) / 1000;
    cta.style.transform = `translateY(${Math.sin(t * 1.1) * 3}px)`;
    raf = requestAnimationFrame(idle);
  };

  const finish = () => {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    root.remove();
    options.onDone();
  };

  root.querySelector('.v5-intro-primary')?.addEventListener('click', finish);
  root.querySelector('.v5-intro-secondary')?.addEventListener('click', finish);
  root.querySelector('.v5-intro-skip')?.addEventListener('click', finish);

  if (reduced) {
    // Static poster plus the CTA. Nothing moves.
    paint(renderIntro(INTRO_CTA_AT + 0.7, options.memes.length));
  } else {
    startedAt = now();
    paint(current);
    raf = requestAnimationFrame(tick);
  }

  return { skip: finish, destroy: finish, frame: () => current };
};

/** Draws the isoline field / waveform. Canvas2D only — cheap enough for tier B. */
export const drawField = (canvas: HTMLCanvasElement, frame: IntroFrame): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(1.5, typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1);
  const width = canvas.clientWidth || 390;
  const height = canvas.clientHeight || 844;
  if (canvas.width !== Math.round(width * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2 + frame.camera.x;
  const cy = height * 0.42 + frame.camera.y;

  if (frame.ember.opacity > 0.01) {
    ctx.globalAlpha = frame.ember.opacity;
    ctx.fillStyle = frame.ember.colour;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * frame.ember.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const rings = 9;
  const base = Math.min(width, height) * 0.42 * frame.contours.bloom;
  ctx.strokeStyle = frame.contours.colour;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const radius = base * (0.12 + t * 0.88);
    if (radius < 1) continue;
    ctx.globalAlpha = frame.contours.opacity * (1 - t * 0.55);
    ctx.beginPath();
    const steps = 72;
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const wobble = Math.sin(angle * 3 + frame.contours.threshold * 6 + r) * 0.06 * (1 - frame.contours.waveform);
      // The waveform morph: flatten the lower half into a horizontal trace.
      const waveOffset = frame.contours.waveform * Math.sin(angle * 4 + frame.t * 6) * 26 * frame.waveform.eq;
      const x = cx + Math.cos(angle) * radius * (1 + wobble);
      const y = cy + Math.sin(angle) * radius * (1 - frame.contours.waveform * 0.72) * (1 + wobble) + waveOffset;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};
