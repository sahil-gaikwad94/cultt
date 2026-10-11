/**
 * Procedural poster art for Concerts and Dine-in.
 *
 * Why generate instead of ship photographs: the brief forbids text baked into
 * images and the repo holds no licensed gig/restaurant photography. A poster
 * drawn from a deterministic seed is offline, weightless, always on-brand, and
 * different for every listing — which is what makes a listing grid feel alive.
 *
 * The seed is the listing id, so a poster never changes between renders, and
 * two devices draw the same one. No text is ever drawn into the artwork (§1.4).
 */

export type PosterStyle = 'aurora' | 'rings' | 'beam' | 'grid' | 'dusk';

export interface PosterOptions {
  width?: number;
  height?: number;
  /** Force a style; otherwise it is derived from the seed. */
  style?: PosterStyle;
  /** 0..1 — how busy the art is. Lower for small thumbs. */
  detail?: number;
}

/** Deterministic hash → 32-bit int (FNV-1a). */
export const seedHash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Tiny deterministic PRNG, so every drawing is reproducible. */
export const rng = (seed: string): (() => number) => {
  let a = seedHash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Brand-family palettes. Nothing outside the token families (§1.1). */
export const PALETTES: readonly (readonly [string, string, string])[] = [
  ['#ff5d7a', '#ff8a5b', '#ffd166'], // heart → coral → sun
  ['#ffd166', '#ff8a5b', '#ff5d7a'], // sun first
  ['#35f2ff', '#7d7bff', '#ff5d7a'], // cold open
  ['#9be8bf', '#35f2ff', '#EFE9DA'], // ok
  ['#EFE9DA', '#b9b5aa', '#ff8a5b'], // bone → mist → coral
  ['#7d7bff', '#ff5d7a', '#ffd166'],
];

export const paletteFor = (seed: string): readonly [string, string, string] =>
  PALETTES[seedHash(seed) % PALETTES.length]!;

export const styleFor = (seed: string): PosterStyle => {
  const styles: PosterStyle[] = ['aurora', 'rings', 'beam', 'grid', 'dusk'];
  return styles[seedHash(`style:${seed}`) % styles.length]!;
};

const f = (n: number): string => n.toFixed(2);

/** Aurora bands — the hero look. */
const aurora = (rand: () => number, w: number, h: number, c: readonly [string, string, string], detail: number): string => {
  const bands = Math.max(2, Math.round(detail * 5));
  let out = '';
  for (let i = 0; i < bands; i += 1) {
    const y = h * (0.12 + rand() * 0.8);
    const thickness = h * (0.06 + rand() * 0.22);
    const tilt = (rand() - 0.5) * h * 0.5;
    out += `<path d="M0 ${f(y)} C ${f(w * 0.3)} ${f(y - tilt)}, ${f(w * 0.7)} ${f(y + tilt)}, ${f(w)} ${f(y - tilt * 0.4)} L ${f(w)} ${f(y + thickness)} C ${f(w * 0.7)} ${f(y + thickness + tilt)}, ${f(w * 0.3)} ${f(y + thickness - tilt)}, 0 ${f(y + thickness * 0.6)} Z" fill="url(#band${i % 3})" opacity="${f(0.28 + rand() * 0.34)}"/>`;
  }
  return out;
};

/** Concentric contours — the fingerprint vocabulary. */
const rings = (rand: () => number, w: number, h: number, c: readonly [string, string, string], detail: number): string => {
  const cx = w * (0.3 + rand() * 0.4);
  const cy = h * (0.35 + rand() * 0.3);
  const count = Math.max(3, Math.round(detail * 9));
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const r = (Math.min(w, h) * (0.12 + i * 0.075)) * (1 + (rand() - 0.5) * 0.12);
    out += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * (0.7 + rand() * 0.5))}" fill="none" stroke="${i % 2 ? c[0] : c[2]}" stroke-width="${f(1 + rand() * 2.4)}" opacity="${f(0.5 - i * 0.03)}" transform="rotate(${f((rand() - 0.5) * 40)} ${f(cx)} ${f(cy)})"/>`;
  }
  return out;
};

/** Stage beams from the top corners. */
const beam = (rand: () => number, w: number, h: number, c: readonly [string, string, string], detail: number): string => {
  const count = Math.max(2, Math.round(detail * 4));
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const originX = rand() < 0.5 ? 0 : w;
    const spread = w * (0.18 + rand() * 0.5);
    const endX = rand() < 0.5 ? -spread : w + spread;
    const top = h * (0.6 + rand() * 0.45);
    out += `<path d="M ${f(originX)} -10 L ${f(endX)} ${f(top)} L ${f(endX + w * 0.16)} ${f(top)} L ${f(originX)} -10 Z" fill="url(#beamGrad)" opacity="${f(0.18 + rand() * 0.3)}"/>`;
  }
  out += `<ellipse cx="${f(w / 2)}" cy="${f(h * 0.86)}" rx="${f(w * 0.42)}" ry="${f(h * 0.14)}" fill="${c[2]}" opacity="0.22"/>`;
  return out;
};

/** A skyline / equaliser grid. */
const grid = (rand: () => number, w: number, h: number, c: readonly [string, string, string], detail: number): string => {
  const cols = Math.max(4, Math.round(detail * 12));
  const gap = w / cols;
  let out = '';
  for (let i = 0; i < cols; i += 1) {
    const bar = h * (0.12 + rand() * 0.62);
    out += `<rect x="${f(i * gap + gap * 0.18)}" y="${f(h - bar)}" width="${f(gap * 0.64)}" height="${f(bar)}" rx="${f(gap * 0.32)}" fill="${i % 3 === 0 ? c[0] : i % 3 === 1 ? c[1] : c[2]}" opacity="${f(0.5 + rand() * 0.4)}"/>`;
  }
  return out;
};

/** Dusk — a slow sun and a horizon, for late sets and candlelit rooms. */
const dusk = (rand: () => number, w: number, h: number, c: readonly [string, string, string], detail: number): string => {
  const sunY = h * (0.32 + rand() * 0.2);
  const sunR = Math.min(w, h) * (0.14 + rand() * 0.1);
  let out = `<circle cx="${f(w * (0.3 + rand() * 0.4))}" cy="${f(sunY)}" r="${f(sunR)}" fill="url(#sunGrad)" opacity="0.9"/>`;
  const hills = Math.max(2, Math.round(detail * 3));
  for (let i = 0; i < hills; i += 1) {
    const y = h * (0.62 + i * 0.09);
    out += `<path d="M0 ${f(y)} Q ${f(w * 0.28)} ${f(y - h * 0.12)}, ${f(w * 0.55)} ${f(y)} T ${f(w)} ${f(y - h * 0.04)} L ${f(w)} ${f(h)} L 0 ${f(h)} Z" fill="${c[i % 3]}" opacity="${f(0.24 + i * 0.14)}"/>`;
  }
  return out;
};

const GRAIN = '<filter id="pg"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>';

/**
 * One poster, as an SVG string. Deterministic: same seed, same art, forever.
 */
export const posterSvg = (seed: string, options: PosterOptions = {}): string => {
  const w = options.width ?? 480;
  const h = options.height ?? 640;
  const detail = options.detail ?? 1;
  const rand = rng(seed);
  const c = paletteFor(seed);
  const style = options.style ?? styleFor(seed);
  const angle = Math.round(rand() * 360);

  const body =
    style === 'aurora'
      ? aurora(rand, w, h, c, detail)
      : style === 'rings'
        ? rings(rand, w, h, c, detail)
        : style === 'beam'
          ? beam(rand, w, h, c, detail)
          : style === 'grid'
            ? grid(rand, w, h, c, detail)
            : dusk(rand, w, h, c, detail);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" gradientTransform="rotate(${angle} .5 .5)" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#0A0A09"/><stop offset="0.55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/>
</linearGradient>
<linearGradient id="band0" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
<linearGradient id="band1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>
<linearGradient id="band2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient>
<linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[2]}" stop-opacity="0.9"/><stop offset="1" stop-color="${c[0]}" stop-opacity="0"/></linearGradient>
<radialGradient id="sunGrad"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[0]}" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.42" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
${GRAIN}
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
${body}
<rect width="${w}" height="${h}" fill="url(#vig)"/>
<rect width="${w}" height="${h}" filter="url(#pg)" opacity="0.06"/>
</svg>`;
};

/** The same art as a data URI, for CSS backgrounds. */
export const posterDataUri = (seed: string, options: PosterOptions = {}): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(posterSvg(seed, options))}`;

/** Two-stop CSS gradient for a listing card, derived from the same seed. */
export const posterGradient = (seed: string): string => {
  const [a, b, d] = paletteFor(seed);
  return `linear-gradient(150deg, ${a} 0%, ${b} 52%, ${d} 100%)`;
};
