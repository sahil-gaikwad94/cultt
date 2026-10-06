/**
 * The Cold Open: the ~11-second scripted intro that opens onboarding.
 *
 * Beats (the script, not decoration — each one says something):
 *   0.0s  black, grain. The ring glyph draws itself.
 *   1.5s  the ring becomes a vinyl; its grooves resolve into fingerprint contours.
 *   3.5s  the vinyl splits; each half carries an original typographic meme card
 *         while the two claims type out word by word.
 *   6.2s  the halves drift back together; coral and yellow sound ribbons
 *         intertwine; the heart pulses once; a slow push-in begins.
 *   8.6s  the "cultured" lockup, then the CTA.
 *
 * Motion is the Web Animations API throughout, with exactly one canvas layer for
 * grain, motes and the ribbons. No video file is required; if the manifest
 * supplies `heroVideo.file` it plays underneath the live text instead.
 *
 * Honesty rules that shaped this: no fabricated counters, no "people near you"
 * claims, nothing that implies a user base that does not exist yet. The intro
 * makes a promise about the *product* and nothing about its population.
 */

import { DUR, EASE, shouldAnimate, whileVisible } from './reduce';
import { synth } from './audio';

export interface ColdOpenOptions {
  host: HTMLElement;
  /** Opt-in, from the existing settings toggle. */
  sound: boolean;
  /** Opt-in, from the existing settings toggle. */
  haptics: boolean;
  /** From `manifest.heroVideo.file`, when the asset pipeline provided one. */
  heroVideo?: string | null;
  /**
   * Capture mode, used by scripts/export-intro-video.mjs. Renders the visual
   * beats only — no type, lockup, CTA or skip hint — so the exported video can
   * sit underneath the live text overlay without any words baked into the
   * frame. The slot is specified as text-free for exactly this reason.
   */
  capture?: boolean;
  /** Called when the viewer presses the CTA. */
  onDone: () => void;
  /** The seam's own haptic() so this module cannot bypass the setting. */
  haptic?: (pattern: number | number[]) => void;
}

export interface ColdOpenHandle {
  /** Fast-forwards to the settled final frame. Called by a tap. */
  skip: () => void;
  /** Cancels everything and removes the layer. */
  destroy: () => void;
  /** True once the timeline has reached its end state. */
  readonly settled: boolean;
}

/* ------------------------------------------------------------ path helpers */

const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A closed, smoothed wobbly ring — the shape language shared by the vinyl
 * grooves and the fingerprint contours, which is what lets one morph into the
 * other instead of cutting between two unrelated drawings.
 */
const contourPath = (seed: number, radius: number, wobble: number, points = 48): string => {
  const random = rng(seed);
  let radii = Array.from({ length: points }, () => radius * (1 + wobble * (random() * 2 - 1)));
  // Smooth with a couple of passes so the ring reads as drawn, not as noise.
  for (let pass = 0; pass < 3; pass++) {
    radii = radii.map((_, i) => {
      const a = radii[(i - 1 + points) % points] as number;
      const b = radii[i] as number;
      const c = radii[(i + 1) % points] as number;
      return (a + b * 2 + c) / 4;
    });
  }

  const at = (i: number): [number, number] => {
    const angle = (i / points) * Math.PI * 2;
    const r = radii[((i % points) + points) % points] as number;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  };

  // Catmull-Rom through the samples, emitted as cubic segments, so the contour
  // is one continuous path and can be dash-drawn in a single stroke.
  let d = '';
  for (let i = 0; i < points; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    if (i === 0) d += `M${p1[0].toFixed(2)},${p1[1].toFixed(2)}`;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[
      0
    ].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* ------------------------------------------------------------ sound (opt-in)
   The hum and chime live in src/motion/audio.ts, shared with the micro layer so
   the page has exactly one AudioContext. */

/* --------------------------------------------------------- canvas: one layer */

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

/**
 * Grain, drifting motes and the two sound ribbons — all on a single canvas, so
 * the whole intro is one composited layer over the DOM animation.
 */
class ParticleLayer {
  private raf = 0;
  private motes: Mote[] = [];
  private running = false;
  /** When the current run began, in performance.now() terms. */
  private startedAt = 0;
  /** How far into the timeline we were when the tab was hidden. */
  private elapsedMs = 0;
  private stopWatching: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private seed: number,
  ) {}

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const random = rng(this.seed);
    const count = w * h > 320000 ? 54 : 34;
    this.motes = Array.from({ length: count }, () => ({
      x: random() * w,
      y: random() * h,
      r: 0.4 + random() * 1.6,
      vx: (random() - 0.5) * 0.16,
      vy: -0.05 - random() * 0.22,
      a: 0.1 + random() * 0.4,
    }));
  }

  /** `ribbons` ramps 0 to 1 across beat 4; `grain` fades in from black. */
  private frame = (now: number): void => {
    if (!this.running) return;
    const t = (now - this.startedAt) / 1000;
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = w / dpr;
    const ch = h / dpr;

    ctx.clearRect(0, 0, cw, ch);

    // Grain: sparse static specks, redrawn each frame so it shimmers.
    const random = rng(this.seed + Math.floor(now / 42));
    ctx.fillStyle = 'rgba(239,233,218,.05)';
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(random() * cw, random() * ch, 1, 1);
    }

    // Motes, drifting up.
    for (const mote of this.motes) {
      mote.x += mote.vx;
      mote.y += mote.vy;
      if (mote.y < -4) mote.y = ch + 4;
      if (mote.x < -4) mote.x = cw + 4;
      if (mote.x > cw + 4) mote.x = -4;
      ctx.globalAlpha = mote.a * Math.min(1, t / 1.2);
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fillStyle = '#EFE9DA';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Two ribbons that weave; they only exist for beat 4.
    const ribbon = Math.max(0, Math.min(1, (t - 6.1) / 2.4));
    if (ribbon > 0) {
      const fade = ribbon < 0.8 ? ribbon / 0.8 : Math.max(0, 1 - (ribbon - 0.8) / 0.4);
      const midY = ch * 0.5;
      const amp = ch * 0.06 * fade;
      const ribbons: ReadonlyArray<readonly [string, number]> = [
        ['#ff5d7a', 0],
        ['#ffd166', Math.PI],
      ];
      for (const [color, phase] of ribbons) {
        ctx.beginPath();
        ctx.lineWidth = 1.6 + 1.4 * fade;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5 * fade;
        for (let x = 0; x <= cw; x += 6) {
          const p = x / cw;
          const y =
            midY +
            Math.sin(p * Math.PI * 3.2 + phase + t * 1.1) * amp * (1 - Math.abs(p - 0.5) * 1.6);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  start(): void {
    if (this.running) return;
    this.resize();
    this.running = true;
    this.startedAt = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.stopWatching = whileVisible((visible) => this.setRunning(visible));
  }

  /** Ambient drawing stops while the tab is hidden and resumes where it left off. */
  private setRunning(visible: boolean): void {
    if (!visible) {
      this.elapsedMs = performance.now() - this.startedAt;
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (!this.running) {
      this.running = true;
      this.startedAt = performance.now() - this.elapsedMs;
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopWatching?.();
    this.stopWatching = null;
  }
}

/* ------------------------------------------------------------------ timeline */

/** Beat boundaries in milliseconds. One place to retime the whole intro. */
const BEAT = {
  grain: 0,
  ring: 150,
  vinyl: 1500,
  grooves: 1800,
  morph: 2600,
  split: 3500,
  cardA: 3700,
  cardB: 4300,
  typeOne: 4200,
  typeTwo: 5100,
  merge: 6200,
  ribbons: 6300,
  heart: 7050,
  pushIn: 7100,
  lockup: 8400,
  tagline: 9000,
  cta: 10100,
} as const;

const TOTAL = 11400;

const FINE_GRAIN = `<div class="co-scan" aria-hidden="true"></div>`;

/**
 * Studio dressing that the DOM beats reference: a warm key light, a slow fog
 * band and a framing vignette. All are pure CSS layers — no new canvas work,
 * no layout properties animated — and all sit under the stage (z-index 0 vs
 * the canvas z-index). Reduced motion freezes the fog via the CSS block in
 * app.css; the light simply stays on at its settled opacity.
 */
const SET_DRESSING = `<div class="co-spot" aria-hidden="true"></div><div class="co-fog" aria-hidden="true"></div><div class="co-vignette" aria-hidden="true"></div>`;

const MEME_CARDS: ReadonlyArray<{ text: string; bg: string; fg: string; ac: string }> = [
  { text: 'me: i’ll just fix this one bug', bg: '#F2D45C', fg: '#141413', ac: '#ff5d7a' },
  { text: 'the codebase: 47 new bugs', bg: '#F26B4E', fg: '#141413', ac: '#ffd166' },
];

export const playColdOpen = (options: ColdOpenOptions): ColdOpenHandle => {
  const { host, sound, haptics, heroVideo, onDone } = options;
  const haptic = options.haptic ?? (() => undefined);
  const animate = shouldAnimate();

  /**
   * When the slot supplied a clip, the clip carries the visual beats and this
   * timeline supplies only the words. Running both would draw the ring, the
   * split and the ribbons on top of footage that is already drawing them.
   */
  const useVideo = Boolean(heroVideo);

  const root = el('div', 'co');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'cultured introduction. Tap to skip.');

  const canvas = el('canvas', 'co-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);

  // Stage: ring / vinyl / fingerprint contours, all in one SVG.
  const stage = el('div', 'co-stage');
  const svg = svgEl('svg', { viewBox: '-120 -120 240 240', 'aria-hidden': 'true' });
  svg.classList.add('co-svg');

  const ring = svgEl('circle', {
    cx: 0,
    cy: 0,
    r: 74,
    fill: 'none',
    stroke: '#EFE9DA',
    'stroke-width': 2,
  });
  ring.classList.add('co-ring');
  svg.appendChild(ring);
  const grooveGroup = svgEl('g', {});
  grooveGroup.classList.add('co-grooves');
  for (let i = 0; i < 7; i++) {
    const circle = svgEl('circle', {
      cx: 0,
      cy: 0,
      r: 22 + i * 8,
      fill: 'none',
      stroke: i % 2 === 0 ? '#EFE9DA' : '#ffd166',
      'stroke-width': i % 2 === 0 ? 1 : 1.4,
      opacity: i % 2 === 0 ? 0.5 : 0.7,
    });
    grooveGroup.appendChild(circle);
  }
  svg.appendChild(grooveGroup);

  const fpGroup = svgEl('g', {});
  fpGroup.classList.add('co-fp');
  const fpPaths: SVGPathElement[] = [];
  for (let i = 0; i < 9; i++) {
    const path = svgEl('path', {
      d: contourPath(11 + i * 7, 16 + i * 7.4, 0.05 + i * 0.006),
      fill: 'none',
      stroke: i < 6 ? '#EFE9DA' : '#ff8a5b',
      'stroke-width': i < 6 ? 1.1 : 1.4,
      'stroke-linecap': 'round',
    });
    fpGroup.appendChild(path);
    fpPaths.push(path);
  }
  svg.appendChild(fpGroup);
  stage.appendChild(svg);
  root.appendChild(stage);

  /**
   * The scaffolding of beats 1 and 2. Once the vinyl has split these are gone,
   * so the reduced-motion final frame hides them rather than replaying them.
   */
  const silhouettes: SVGElement[] = [ring, grooveGroup];

  // Two halves of the split vinyl, each carrying a meme card.
  const halves = el('div', 'co-halves');
  const halfNodes = MEME_CARDS.map((card, index) => {
    const half = el('div', `co-half co-half-${index === 0 ? 'a' : 'b'}`);
    const cardEl = el('figure', 'co-card');
    cardEl.style.setProperty('--bg', card.bg);
    cardEl.style.setProperty('--fg', card.fg);
    cardEl.style.setProperty('--ac', card.ac);
    cardEl.appendChild(el('blockquote', 'co-card-text', card.text));
    half.appendChild(cardEl);
    halves.appendChild(half);
    return half;
  });
  root.appendChild(halves);

  // Kinetic type: the two claims, revealed word by word.
  const type = el('div', 'co-type');
  const lineOne = el('h2', 'co-line');
  const lineTwo = el('p', 'co-line co-line-2');
  const wordNodes: HTMLElement[] = [];
  const fill = (node: HTMLElement, text: string, cls: string): void => {
    for (const word of text.split(' ')) {
      const span = el('span', `co-word ${cls}`, word);
      node.appendChild(span);
      node.appendChild(document.createTextNode(' '));
      wordNodes.push(span);
    }
  };
  fill(lineOne, 'Match on your humor.', 'co-w1');
  fill(lineTwo, 'Not your headshot.', 'co-w2');
  type.append(lineOne, lineTwo);
  root.appendChild(type);

  // Heart + lockup + tagline + CTA.
  const heart = el('div', 'co-heart');
  heart.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.3-9A5.6 5.6 0 0 1 12 6.4 5.6 5.6 0 0 1 21.3 12C19.5 16.3 12 21 12 21Z" fill="currentColor"/></svg>';
  root.appendChild(heart);

  const lockupWrap = el('div', 'co-lockup');
  const lockupWords = [...'cultured'];
  for (const [index, ch] of lockupWords.entries()) {
    const span = el('span', 'co-l');
    const inner = el('i', undefined, ch);
    inner.style.setProperty('--d', String(index));
    span.appendChild(inner);
    lockupWrap.appendChild(span);
  }
  root.appendChild(lockupWrap);

  // The one-line title under the lockup: the promise, in gradient type.
  const tagline = el('p', 'co-tagline co-title-grad', 'humor first. chemistry always.');
  root.appendChild(tagline);

  const cta = el('button', 'cta co-cta', 'Start with the good stuff');
  cta.type = 'button';
  root.appendChild(cta);
  const skipHint = el('p', 'co-skip', 'Tap to skip');
  root.appendChild(skipHint);

  /** The stage dressing nodes, wired up after the DOM is built. */
  const spot = root.querySelector('.co-spot') as HTMLDivElement | null;
  const fog = root.querySelector('.co-fog') as HTMLDivElement | null;
  root.insertAdjacentHTML('beforeend', SET_DRESSING);
  root.insertAdjacentHTML('beforeend', FINE_GRAIN);

  if (options.capture) root.classList.add('co-capture');

  host.innerHTML = '';
  host.appendChild(root);
  host.classList.add('on');

  /* -------- video slot: plays underneath, live text stays on top -------- */

  let videoNode: HTMLVideoElement | null = null;
  if (heroVideo) {
    videoNode = document.createElement('video');
    videoNode.className = 'co-video';
    videoNode.muted = true;
    videoNode.defaultMuted = true;
    videoNode.playsInline = true;
    videoNode.autoplay = true;
    videoNode.loop = false;
    videoNode.preload = 'auto';
    videoNode.setAttribute('muted', '');
    videoNode.setAttribute('playsinline', '');
    videoNode.setAttribute('aria-hidden', 'true');
    videoNode.poster = '/assets/intro-poster.jpg';
    videoNode.src = heroVideo;
    root.insertBefore(videoNode, canvas);
  }

  /* ---------------------------- animations ---------------------------- */

  /**
   * Nodes that exist only to draw the beats the clip also draws. Keyframes that
   * target one of these are dropped when a clip is playing.
   */
  const visualOnly = new Set<Element>([
    canvas,
    stage,
    ring,
    grooveGroup,
    fpGroup,
    ...fpPaths,
    halves,
    ...halfNodes,
    heart,
  ]);

  const animations: Animation[] = [];
  /**
   * Animations autoplay (a paused animation would never progress). `settle()`
   * then calls finish() on all of them, which is what makes a tap jump straight
   * to the settled final frame however far in it was.
   */
  const push = (animation: Animation | null): void => {
    if (!animation) return;
    animations.push(animation);
  };

  const keyframe = (
    node: Element,
    frames: Keyframe[],
    start: number,
    duration: number,
    easing: string = EASE.ease,
  ): void => {
    if (useVideo && visualOnly.has(node)) return;
    push(
      node.animate(frames, {
        delay: start,
        duration,
        easing,
        fill: 'both',
      }),
    );
  };

  const dashed = (path: SVGPathElement, start: number, duration: number): void => {
    const length = path.getTotalLength?.() ?? 320;
    path.style.strokeDasharray = String(length);
    keyframe(
      path,
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      start,
      duration,
      EASE.ease,
    );
  };

  if (animate) {
    keyframe(root, [{ opacity: 0 }, { opacity: 1 }], BEAT.grain, 420);
    keyframe(
      canvas,
      [{ opacity: 0 }, { opacity: 1 }],
      BEAT.grain,
      520,
    );
    // Studio dressing: the warm key blooms as the vinyl resolves and the
    // fog fades in with it. The vignette is present from the first frame.
    if (spot) keyframe(spot, [{ opacity: 0 }, { opacity: 1 }], BEAT.grooves, 1400, EASE.ease);
    if (fog) keyframe(fog, [{ opacity: 0 }, { opacity: 1 }], BEAT.merge, 1800, EASE.ease);

    // 1. the ring draws itself
    const ringLength = ring.getTotalLength?.() ?? 465;
    ring.style.strokeDasharray = String(ringLength);
    keyframe(ring, [{ strokeDashoffset: ringLength }, { strokeDashoffset: 0 }], BEAT.ring, 1200, EASE.ease);
    keyframe(ring, [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], BEAT.ring, 1200, EASE.ease);

    // 2. ring -> vinyl -> fingerprint contours
    keyframe(grooveGroup, [{ opacity: 0 }, { opacity: 1 }], BEAT.grooves, 800);
    grooveGroup.querySelectorAll('circle').forEach((circle, index) => {
      const length = 2 * Math.PI * (22 + index * 8);
      (circle as SVGCircleElement).style.strokeDasharray = String(length);
      keyframe(
        circle,
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        BEAT.grooves + index * 70,
        900,
        EASE.ease,
      );
    });
    keyframe(grooveGroup, [{ opacity: 1 }, { opacity: 0 }], BEAT.morph, 700);
    keyframe(ring, [{ opacity: 1 }, { opacity: 0 }], BEAT.morph, 700);
    fpPaths.forEach((path, index) =>
      dashed(path, BEAT.morph + index * 55, 760 + index * 40),
    );
    // The fingerprint keeps breathing: this is the contours' settled state.
    keyframe(fpGroup, [{ opacity: 0 }, { opacity: 1 }], BEAT.morph, 300);

    // 3. the split. Each half carries a card.
    keyframe(
      halfNodes[0] as HTMLElement,
      [
        { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 0 },
        { transform: 'translate3d(-42%,0,0) rotate(-7deg)', opacity: 1 },
      ],
      BEAT.split,
      720,
      EASE.spring,
    );
    keyframe(
      halfNodes[1] as HTMLElement,
      [
        { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 0 },
        { transform: 'translate3d(42%,0,0) rotate(7deg)', opacity: 1 },
      ],
      BEAT.split + 120,
      720,
      EASE.spring,
    );
    keyframe(fpGroup, [{ transform: 'scale(1)' }, { transform: 'scale(.62)' }], BEAT.split, 700);
    keyframe(stage, [{ opacity: 1 }, { opacity: 0.25 }], BEAT.split, 700);

    // word-by-word type
    wordNodes.forEach((word) => {
      const isSecond = word.classList.contains('co-w2');
      keyframe(
        word,
        [
          { opacity: 0, transform: 'translate3d(0,14px,0)' },
          { opacity: 1, transform: 'translate3d(0,0,0)' },
        ],
        isSecond ? BEAT.typeTwo + wordNodes.indexOf(word) * 55 : BEAT.typeOne + wordNodes.indexOf(word) * 80,
        460,
        EASE.spring,
      );
    });

    // 4. the halves come back together, ribbons weave, heart pulses, push-in
    keyframe(
      halfNodes[0] as HTMLElement,
      [{ transform: 'translate3d(-42%,0,0) rotate(-7deg)' }, { transform: 'translate3d(-6%,0,0) rotate(-2deg)' }],
      BEAT.merge,
      900,
      EASE.ease,
    );
    keyframe(
      halfNodes[1] as HTMLElement,
      [{ transform: 'translate3d(42%,0,0) rotate(7deg)' }, { transform: 'translate3d(6%,0,0) rotate(2deg)' }],
      BEAT.merge,
      900,
      EASE.ease,
    );
    keyframe(halves, [{ opacity: 1 }, { opacity: 0.16 }], BEAT.ribbons + 900, 900);

    keyframe(
      heart,
      [
        { opacity: 0, transform: 'scale(.7)' },
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1.18)' },
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      BEAT.heart,
      900,
      EASE.spring,
    );
    keyframe(stage, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], BEAT.pushIn, 3200, EASE.linear);

    // 5. lockup, then CTA
    lockupWrap.querySelectorAll('i').forEach((inner, index) =>
      keyframe(
        inner,
        [
          { opacity: 0, transform: 'translate3d(0,18px,0)' },
          { opacity: 1, transform: 'translate3d(0,0,0)' },
        ],
        BEAT.lockup + index * 55,
        520,
        EASE.spring,
      ),
    );
    keyframe(
      tagline,
      [
        { opacity: 0, transform: 'translate3d(0,14px,0)', letterSpacing: '0.2em' },
        { opacity: 1, transform: 'translate3d(0,0,0)', letterSpacing: '-0.01em' },
      ],
      BEAT.tagline,
      700,
      EASE.ease,
    );
    keyframe(cta, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], BEAT.cta, 520, EASE.spring);
    keyframe(skipHint, [{ opacity: 1 }, { opacity: 0 }], BEAT.cta, 400);
  } else {
    // Reduced motion / Calm Mode: the static final frame, immediately. No
    // rAF loop, no audio, no particles — just the state the intro settles into.
    root.classList.add('co-static');
    // A moving clip is motion. Reduced motion gets the poster frame instead.
    if (videoNode) {
      videoNode.autoplay = false;
      videoNode.removeAttribute('autoplay');
      videoNode.pause();
    }
    canvas.style.opacity = '0';
    stage.style.opacity = '0.25';
    silhouettes.forEach((node) => (node.style.opacity = '0'));
    if (spot) spot.style.opacity = '0.55';
    if (fog) fog.style.opacity = '1';
    fpPaths.forEach((path) => {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
    });
    cta.style.opacity = '1';
    for (const word of wordNodes) word.style.opacity = '1';
    lockupWrap.querySelectorAll('i').forEach((inner) => ((inner as HTMLElement).style.opacity = '1'));
    heart.style.opacity = '1';
    tagline.style.opacity = '1';
    skipHint.style.display = 'none';
  }

  /* ---------------------------- the timeline clock ---------------------------- */

  // The clip carries its own grain and ribbons, so the canvas layer stays off
  // rather than compositing a second, slightly different, one over it.
  const particles =
    animate && !useVideo
      ? new ParticleLayer(canvas, canvas.getContext('2d') as CanvasRenderingContext2D, 4242)
      : null;

  if (useVideo) {
    // Layered under the clip, not over it.
    for (const node of visualOnly) {
      (node as HTMLElement).style.opacity = '0';
    }
  }

  const audio = animate && sound ? synth : null;
  if (audio) audio.setEnabled(true);

  let settled = false;
  let destroyed = false;
  let timers: number[] = [];

  const settle = (): void => {
    if (settled || destroyed) return;
    settled = true;
    for (const animation of animations) {
      try {
        animation.finish();
      } catch {
        /* an animation cancelled by destroy() cannot finish */
      }
    }
    cta.style.opacity = '1';
    tagline.style.opacity = '1';
    root.classList.add('co-settled');
    root.removeAttribute('aria-label');
  };

  const startClock = (): void => {
    if (!animate) {
      settled = true;
      cta.focus({ preventScroll: true });
      return;
    }
    particles?.start();
    audio?.startHum();
    timers = [
      window.setTimeout(() => {
        audio?.chime();
        if (haptics) haptic(12);
      }, BEAT.heart),
      window.setTimeout(() => {
        if (haptics) haptic(8);
      }, BEAT.lockup),
      window.setTimeout(settle, TOTAL),
    ];
  };
  startClock();

  /* ------------------------------- interaction ------------------------------- */

  const onHostTap = (event: Event): void => {
    if (destroyed) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.co-cta')) return;
    settle();
    particles?.stop();
    event.preventDefault();
  };

  const onCta = (event: Event): void => {
    event.stopPropagation();
    settle();
    destroy();
    onDone();
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      if (event.key === 'Escape') settle();
    }
  };

  root.addEventListener('pointerdown', onHostTap, { passive: false });
  cta.addEventListener('click', onCta);
  window.addEventListener('keydown', onKey);

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    settled = true;
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
    particles?.stop();
    audio?.destroy();
    animations.forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        /* already cancelled */
      }
    });
    root.removeEventListener('pointerdown', onHostTap);
    cta.removeEventListener('click', onCta);
    window.removeEventListener('keydown', onKey);
    videoNode?.pause();
    videoNode = null;
    root.remove();
    host.classList.remove('on');
  };

  return {
    skip: settle,
    destroy,
    get settled(): boolean {
      return settled;
    },
  };
};

export const COLD_OPEN_DURATION = TOTAL;
export { DUR };
