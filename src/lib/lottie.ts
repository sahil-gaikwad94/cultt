/**
 * Hand-authored Lottie animations (lottie-web bodymovin format).
 * Accent-colored particle bursts: match celebration + like/Resonate pops.
 * Generated programmatically so colors/density stay in sync with tokens.
 */

const ACCENT: [number, number, number, number] = [1, 0.4196, 0.2902, 1]; // #7C5CFF
const PAPER: [number, number, number, number] = [0.9608, 0.9451, 0.9176, 1]; // #F5F1EA

type Keyframe = Record<string, unknown>;

function oChannel(from: number, to: number, t0: number, t1: number): Keyframe {
  return {
    a: 1,
    k: [
      { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: t0, s: [from] },
      { t: t1, s: [to] },
    ],
  };
}

function pChannel(
  from: [number, number, number],
  to: [number, number, number],
  t0: number,
  t1: number
): Keyframe {
  return {
    a: 1,
    k: [
      {
        i: { x: [0.25, 0.25, 0], y: [1, 1, 0] },
        o: { x: [0.55, 0.55, 0], y: [0, 0, 0] },
        t: t0,
        s: from,
      },
      { t: t1, s: to },
    ],
  };
}

function sChannel(
  from: [number, number, number],
  mid: [number, number, number],
  to: [number, number, number],
  t0: number,
  t1: number,
  t2: number
): Keyframe {
  return {
    a: 1,
    k: [
      { i: { x: [0.4, 0.4, 0], y: [1, 1, 0] }, o: { x: [0.6, 0.6, 0], y: [0, 0, 0] }, t: t0, s: from },
      { i: { x: [0.4, 0.4, 0], y: [1, 1, 0] }, o: { x: [0.6, 0.6, 0], y: [0, 0, 0] }, t: t1, s: mid },
      { t: t2, s: to },
    ],
  };
}

function circleParticle(opts: {
  ind: number;
  center: [number, number];
  dx: number;
  dy: number;
  color: [number, number, number, number];
  size: number;
  t0: number;
  t1: number;
  t2: number;
}) {
  const { ind, center, dx, dy, color, size, t0, t1, t2 } = opts;
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: `p${ind}`,
    sr: 1,
    ks: {
      o: oChannel(100, 0, t0 + (t1 - t0) * 0.55, t2),
      r: { a: 0, k: 0 },
      p: pChannel([center[0], center[1], 0], [center[0] + dx, center[1] + dy, 0], t0, t1),
      a: { a: 0, k: [0, 0, 0] },
      s: sChannel([40, 40, 100], [100, 100, 100], [0, 0, 100], t0, t1, t2),
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] }, nm: "c" },
          { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 }, nm: "f" },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
            sk: { a: 0, k: 0 },
            sa: { a: 0, k: 0 },
          },
        ],
      },
    ],
    ip: t0,
    op: t2,
    st: 0,
  };
}

function ring(opts: {
  ind: number;
  center: [number, number];
  color: [number, number, number, number];
  t0: number;
  t1: number;
  size: number;
  width: number;
}) {
  const { ind, center, color, t0, t1, size, width } = opts;
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: `ring${ind}`,
    sr: 1,
    ks: {
      o: oChannel(90, 0, t0, t1),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [center[0], center[1], 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: sChannel([20, 20, 100], [110, 110, 100], [170, 170, 100], t0, t1, t1 + 4),
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] }, nm: "c" },
          {
            ty: "st",
            c: { a: 0, k: color },
            o: { a: 0, k: 100 },
            w: { a: 0, k: width },
            lc: 1,
            lj: 1,
            nm: "s",
          },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
            sk: { a: 0, k: 0 },
            sa: { a: 0, k: 0 },
          },
        ],
      },
    ],
    ip: t0,
    op: t1 + 5,
    st: 0,
  };
}

export interface LottieAnim {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: unknown[];
  layers: unknown[];
}

/** Full-size celebration burst — particles radiate from center. */
export function makeBurstLottie(size = 300, count = 14): LottieAnim {
  const c: [number, number] = [size / 2, size / 2];
  const reach = size * 0.42;
  const layers: unknown[] = [
    ring({ ind: 1, center: c, color: ACCENT, t0: 0, t1: 26, size: size * 0.5, width: 5 }),
    ring({ ind: 2, center: c, color: PAPER, t0: 6, t1: 34, size: size * 0.34, width: 3 }),
  ];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + 0.25;
    const dist = reach * (i % 3 === 0 ? 0.75 : 1);
    layers.push(
      circleParticle({
        ind: 3 + i,
        center: c,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        color: i % 4 === 0 ? PAPER : ACCENT,
        size: i % 3 === 0 ? 30 : 20,
        t0: i % 2 === 0 ? 0 : 3,
        t1: 26 + (i % 4) * 3,
        t2: 40 + (i % 4) * 3,
      })
    );
  }
  return { v: "5.7.4", fr: 30, ip: 0, op: 56, w: size, h: size, nm: "cultured-burst", ddd: 0, assets: [], layers };
}

/** Tiny like/Resonate pop — quick ring + few dots, sits over the button. */
export function makePopLottie(size = 120): LottieAnim {
  const c: [number, number] = [size / 2, size / 2];
  const layers: unknown[] = [
    ring({ ind: 1, center: c, color: ACCENT, t0: 0, t1: 16, size: size * 0.55, width: 4 }),
  ];
  const pts: [number, number][] = [
    [0, -1], [0.9, -0.4], [0.55, 0.8], [-0.55, 0.8], [-0.9, -0.4],
  ];
  pts.forEach(([px, py], i) => {
    layers.push(
      circleParticle({
        ind: 2 + i,
        center: c,
        dx: px * size * 0.4,
        dy: py * size * 0.4,
        color: i % 2 ? PAPER : ACCENT,
        size: 16,
        t0: 0,
        t1: 14,
        t2: 22,
      })
    );
  });
  return { v: "5.7.4", fr: 30, ip: 0, op: 26, w: size, h: size, nm: "cultured-pop", ddd: 0, assets: [], layers };
}

export const celebrationBurst = makeBurstLottie(320, 16);
export const likePop = makePopLottie(120);
export const resonatePop = makePopLottie(150);
