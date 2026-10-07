/**
 * Contour — the one visual language of v5 (build brief §3).
 *
 * Story rings, avatar auras, progress, tap ripples, loaders and the reveal are
 * all the same generative isoline shape driven by a seed and a few params. One
 * renderer, usable at any size, pausable when it scrolls offscreen.
 *
 * Two draw paths behind one API:
 *   - Canvas2D: stroked perturbed rings. Cheap, works everywhere, tier B and C.
 *   - WebGL2: a hand-written fragment shader that thresholds a 2D value-noise
 *     field into isolines. Tier A only. No Three.js (rule 7).
 *
 * The ring geometry is a pure function (`contourRings`) so the exact shape a
 * user sees is testable and reproducible from its seed.
 */

import { getQuality } from './quality.ts';

export interface ContourParams {
  /** Deterministic seed. Same seed ⇒ same shape. */
  seed: number;
  /** Number of isolines. */
  rings: number;
  /** Points per ring. Higher is smoother and more expensive. */
  points: number;
  /** 0..1 — how far the rings wobble from a circle. */
  wobble: number;
  /** Animated phase, radians. */
  phase: number;
  /** Radial spread of the ring stack, 0..1 of the radius. */
  spread: number;
  /** Line width in CSS px. */
  lineWidth: number;
  stroke: string;
  /** Optional second colour for the innermost rings. */
  accent?: string;
  /** 0..1 fade on the outermost ring. */
  edgeFade?: number;
}

export const DEFAULT_CONTOUR: ContourParams = {
  seed: 1,
  rings: 7,
  points: 96,
  wobble: 0.28,
  phase: 0,
  spread: 0.82,
  lineWidth: 1.25,
  stroke: '#EFE9DA',
};

/* ------------------------------------------------------------- noise ----- */

const hash2 = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in [0,1]. Deterministic for a given seed. */
export const valueNoise2D = (x: number, y: number, seed: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const tl = hash2(xi, yi, seed);
  const tr = hash2(xi + 1, yi, seed);
  const bl = hash2(xi, yi + 1, seed);
  const br = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  const top = tl + (tr - tl) * u;
  const bottom = bl + (br - bl) * u;
  return top + (bottom - top) * v;
};

/** Fractal sum of value noise, 3 octaves. */
export const fbm2D = (x: number, y: number, seed: number): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 3; i += 1) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 1013);
    amp *= 0.5;
    freq *= 2;
  }
  return sum / 0.875;
};

/* ------------------------------------------------------------ geometry --- */

export type Ring = [number, number][];

/**
 * The ring stack for a given param set. Pure and deterministic: this is the
 * shape a fingerprint, a story ring and a tap ripple all share.
 *
 * Returned in normalised coordinates (radius 1 at the outermost ring) so the
 * caller decides the pixel size.
 */
export const contourRings = (params: ContourParams): Ring[] => {
  const { seed, rings, points, wobble, phase, spread } = params;
  const out: Ring[] = [];
  const count = Math.max(1, Math.round(rings));
  const steps = Math.max(12, Math.round(points));

  for (let r = 0; r < count; r += 1) {
    const t = count === 1 ? 1 : r / (count - 1);
    // Inner rings sit closer together; the stack opens toward the edge.
    const baseRadius = 0.18 + spread * (t ** 0.85) * 0.82;
    const ring: Ring = [];
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const nx = Math.cos(angle) * 1.6 + phase * 0.35;
      const ny = Math.sin(angle) * 1.6 - phase * 0.22;
      const n = fbm2D(nx + t * 2.4, ny + r * 0.6, seed);
      const radius = baseRadius * (1 + (n - 0.5) * 2 * wobble * (0.4 + t));
      ring.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    out.push(ring);
  }
  return out;
};

/** Bounding radius of a ring set, so callers can size a canvas without guessing. */
export const contourExtent = (rings: Ring[]): number => {
  let max = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) max = Math.max(max, Math.hypot(x, y));
  }
  return max || 1;
};

/* ------------------------------------------------------------ rendering -- */

export interface ContourHandle {
  readonly mode: 'canvas2d' | 'webgl2' | 'static';
  /** Starts the animation loop. No-op when offscreen or reduced-motion. */
  start(): void;
  stop(): void;
  /** Redraws once without starting a loop. Used for thumbnails and tests. */
  draw(phase?: number): void;
  setParams(patch: Partial<ContourParams>): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** Isolines of a 2D value-noise field. Written by hand — no Three.js. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uSeed;
uniform float uWobble;
uniform float uRings;
uniform float uSpread;
uniform vec3 uStroke;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++){ s += a * noise(p); p *= 2.0; a *= 0.5; }
  return s / 0.875;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float r = length(uv) * 2.0;
  float a = atan(uv.y, uv.x);
  vec2 np = vec2(cos(a), sin(a)) * 1.6 + vec2(uTime * 0.35, -uTime * 0.22);
  float n = fbm(np + r * 2.4);
  float field = r * (1.0 + (n - 0.5) * 2.0 * uWobble) / uSpread;
  float bands = field * uRings;
  float line = abs(fract(bands) - 0.5);
  float aa = fwidth(bands) * 1.5 + 0.002;
  float alpha = 1.0 - smoothstep(0.0, aa, line);
  alpha *= smoothstep(1.05, 0.55, r);
  outColor = vec4(uStroke, alpha * 0.9);
}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};

export interface ContourOptions {
  canvas: HTMLCanvasElement;
  params?: Partial<ContourParams>;
  /** Force a draw path. Defaults to the quality tier. */
  mode?: ContourHandle['mode'];
  /** Stop drawing when the canvas leaves the viewport. */
  pauseOffscreen?: boolean;
  /** Static: draw once, never loop. Tier C and all thumbnails. */
  static?: boolean;
  reducedMotion?: boolean;
}

/**
 * Creates a contour renderer. Falls back gracefully: WebGL2 → Canvas2D → a
 * single static frame, so a context loss can never leave a blank circle.
 */
export const createContour = (options: ContourOptions): ContourHandle => {
  const canvas = options.canvas;
  const params: ContourParams = { ...DEFAULT_CONTOUR, ...(options.params ?? {}) };
  const reducedMotion =
    options.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  const tier = getQuality().tier;
  const wantsWebgl = (options.mode ?? (tier === 'A' ? 'webgl2' : 'canvas2d')) === 'webgl2';
  const isStatic = options.static ?? (tier === 'C' || reducedMotion);

  let mode: ContourHandle['mode'] = 'canvas2d';
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  let ctx: CanvasRenderingContext2D | null = null;

  if (wantsWebgl) {
    try {
      gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
      if (gl) {
        const compile = (type: number, source: string): WebGLShader => {
          const shader = gl!.createShader(type)!;
          gl!.shaderSource(shader, source);
          gl!.compileShader(shader);
          if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
            throw new Error(gl!.getShaderInfoLog(shader) ?? 'shader compile failed');
          }
          return shader;
        };
        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program link failed');
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

        for (const name of ['uRes', 'uTime', 'uSeed', 'uWobble', 'uRings', 'uSpread', 'uStroke']) {
          uniforms[name] = gl.getUniformLocation(program, name);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        mode = 'webgl2';
      }
    } catch {
      gl = null;
      program = null;
      mode = 'canvas2d';
    }
  }

  if (mode !== 'webgl2') ctx = canvas.getContext('2d');
  if (!ctx && mode !== 'webgl2') mode = 'static';

  const devicePixel = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const dpr = Math.min(getQuality().caps.dpr, devicePixel);
  let width = canvas.clientWidth || canvas.width || 120;
  let height = canvas.clientHeight || canvas.height || 120;

  const applySize = () => {
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  };
  applySize();

  const drawCanvas2d = (phase: number) => {
    if (!ctx) return;
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);
    const rings = contourRings({ ...params, phase });
    const extent = contourExtent(rings);
    const scale = (Math.min(width, height) / 2 / extent) * 0.96;
    const cx = width / 2;
    const cy = height / 2;

    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (let i = 0; i < rings.length; i += 1) {
      const t = rings.length === 1 ? 1 : i / (rings.length - 1);
      const ring = rings[i];
      c.beginPath();
      for (let p = 0; p < ring.length; p += 1) {
        const x = cx + ring[p][0] * scale;
        const y = cy + ring[p][1] * scale;
        if (p === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
      const fade = params.edgeFade ?? 0;
      c.globalAlpha = 1 - fade * t;
      c.strokeStyle = params.accent && t < 0.34 ? params.accent : params.stroke;
      c.lineWidth = params.lineWidth * (1 - t * 0.25);
      c.stroke();
    }
    c.globalAlpha = 1;
  };

  const drawWebgl = (phase: number) => {
    if (!gl || !program) return;
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uTime, phase);
    gl.uniform1f(uniforms.uSeed, params.seed);
    gl.uniform1f(uniforms.uWobble, params.wobble);
    gl.uniform1f(uniforms.uRings, params.rings);
    gl.uniform1f(uniforms.uSpread, params.spread);
    const [r, g, b] = hexToRgb(params.accent ?? params.stroke);
    gl.uniform3f(uniforms.uStroke, r, g, b);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const draw = (phase = params.phase) => {
    if (mode === 'webgl2') drawWebgl(phase);
    else drawCanvas2d(phase);
  };

  let raf = 0;
  let running = false;
  let visible = true;
  let observer: IntersectionObserver | null = null;

  const tick = () => {
    if (!running) return;
    params.phase += 0.012;
    draw(params.phase);
    raf = requestAnimationFrame(tick);
  };

  const handle: ContourHandle = {
    get mode() {
      return mode;
    },
    start() {
      if (isStatic || running) {
        draw();
        return;
      }
      running = true;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    draw: (phase) => draw(phase ?? params.phase),
    setParams(patch) {
      Object.assign(params, patch);
      draw();
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      applySize();
      draw();
    },
    destroy() {
      handle.stop();
      observer?.disconnect();
      observer = null;
      if (gl) {
        const lose = gl.getExtension('WEBGL_lose_context');
        lose?.loseContext();
      }
      gl = null;
      program = null;
      ctx = null;
    },
  };

  if (options.pauseOffscreen !== false && typeof IntersectionObserver !== 'undefined' && !isStatic) {
    observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && running) handle.start();
        else if (!visible) handle.stop();
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);
  }

  draw();
  return handle;
};
