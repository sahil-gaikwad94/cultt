/**
 * Shared plumbing for the Live and Dine-in screens.
 *
 * Everything here is pure — a clock and a pack go in, strings come out — so the
 * screens can be tested without a DOM and without stubbing a provider. The only
 * genuinely new machinery is `posterSVG`, because neither pack ships artwork:
 * generating it from the palette is the honest alternative to inventing a photo
 * of a band or a restaurant that does not exist.
 *
 * Dependency rule, same as `src/screens/feed.ts`: no imports from `src/v5/*`,
 * no store, no `src/legacy.ts`. The seam passes icons and callbacks in.
 */

import type { Poster } from '../lib/places/types';

export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Deterministic PRNG. Same seed, same poster, every render, forever. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const uid = (seed: number): string => `pp${(seed >>> 0).toString(36)}`;

/**
 * Poster artwork, generated from the pack's palette.
 *
 * 300×400 to match a ticket or a menu card. Returns markup rather than a data
 * URI so it stays sharp at any size and inherits `currentColor` if a theme ever
 * needs it to.
 */
export const posterSVG = (poster: Poster): string => {
  const { palette: p, style, seed } = poster;
  const r = mulberry32(seed);
  const u = uid(seed);
  const [c0, c1, c2, c3] = [p[0], p[1], p[2], p[3]] as const;

  const defs = `<defs><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".58" stop-color="${c3}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>`;
  const bg = `<rect width="300" height="400" fill="url(#${u}g)"/>`;

  let body = '';
  if (style === 'dusk') {
    const cx = 70 + r() * 160;
    const cy = 150 + r() * 60;
    body =
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(46 + r() * 26).toFixed(0)}" fill="${c1}" opacity=".9"/>` +
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(78 + r() * 30).toFixed(0)}" fill="${c1}" opacity=".16"/>` +
      [0, 1, 2, 3].map((i) => `<rect x="0" y="${280 + i * 26}" width="300" height="12" fill="${c2}" opacity="${0.32 - i * 0.06}"/>`).join('');
  } else if (style === 'moon') {
    const stars = Array.from({ length: 22 }, () => {
      const x = (r() * 300).toFixed(0);
      const y = (r() * 260).toFixed(0);
      return `<circle cx="${x}" cy="${y}" r="${(0.7 + r() * 1.6).toFixed(1)}" fill="${c2}" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`;
    }).join('');
    body =
      stars +
      `<circle cx="205" cy="120" r="52" fill="${c1}" opacity=".92"/><circle cx="186" cy="106" r="46" fill="${c0}" opacity=".85"/>`;
  } else if (style === 'wave') {
    const bands = [0, 1, 2, 3, 4]
      .map((i) => `<rect x="0" y="${40 + i * 74}" width="300" height="${18 + r() * 22}" fill="${i % 2 ? c2 : c1}" opacity="${0.5 - i * 0.06}"/>`)
      .join('');
    const path = `M0 ${250 + r() * 40} C 60 ${180 + r() * 60}, 120 ${320 - r() * 60}, 180 ${240 + r() * 30} S 280 ${200 + r() * 60}, 300 ${250 + r() * 30}`;
    body = `${bands}<path d="${path}" fill="none" stroke="${c2}" stroke-width="4" opacity=".85"/>`;
  } else if (style === 'bauhaus') {
    const shapes = [0, 1, 2, 3]
      .map((i) => {
        const x = (20 + r() * 200).toFixed(0);
        const y = (40 + r() * 280).toFixed(0);
        const s = (40 + r() * 70).toFixed(0);
        const fill = [c1, c2, c3][i % 3];
        if (i % 3 === 0) return `<circle cx="${x}" cy="${y}" r="${s}" fill="${fill}" opacity=".8"/>`;
        if (i % 3 === 1) return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}" opacity=".75"/>`;
        return `<path d="M${x} ${y} a${s} ${s} 0 0 1 ${s} ${s} z" fill="${fill}" opacity=".7"/>`;
      })
      .join('');
    body = shapes;
  } else {
    const petals = [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const x = (150 + Math.cos(a) * 62).toFixed(0);
        const y = (200 + Math.sin(a) * 62).toFixed(0);
        return `<ellipse cx="${x}" cy="${y}" rx="${(34 + r() * 16).toFixed(0)}" ry="${(56 + r() * 20).toFixed(0)}" fill="${i % 2 ? c1 : c2}" opacity=".5" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x} ${y})"/>`;
      })
      .join('');
    body = `${petals}<circle cx="150" cy="200" r="30" fill="${c2}" opacity=".9"/>`;
  }

  /* A grain overlay, matching the app's own texture. Kept cheap: one rect with
     a turbulence filter would cost more than the whole poster. */
  const grain = `<rect width="300" height="400" fill="${c0}" opacity=".14"/>`;

  return `<svg class="pp-art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Generated artwork">${defs}${bg}${body}${grain}</svg>`;
};

/** ₹799, or "Free" — 0 is a real price here, not a missing one. */
export const inr = (amount: number, currency = 'INR'): string =>
  amount <= 0 ? 'Free' : `${currency === 'INR' ? '₹' : `${currency} `}${amount.toLocaleString('en-IN')}`;

const DAY = 86_400_000;

/** Local calendar day index, so "tonight" survives a 23:59 render. */
const dayIndex = (ts: number): number => {
  const d = new Date(ts);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY);
};

/** 'Tonight' / 'Tomorrow' / 'Sat 18 Oct'. */
export const dayLabel = (startsAt: string, now: number): string => {
  const at = new Date(startsAt).getTime();
  if (!Number.isFinite(at)) return '';
  const diff = dayIndex(at) - dayIndex(now);
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Whole days from today. Negative is in the past. */
export const daysUntil = (startsAt: string, now: number): number => {
  const at = new Date(startsAt).getTime();
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return dayIndex(at) - dayIndex(now);
};

/** '20:30' → '8:30 PM'. Falls back to the raw value if it will not parse. */
export const timeLabel = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** A chip row. `active === null` means "All". */
export const chipRowHTML = (
  group: string,
  options: readonly { id: string; label: string }[],
  active: string | null,
): string =>
  `<div class="pl-chips" role="group" aria-label="${esc(group)}">` +
  `<button type="button" class="pl-chip${active === null ? ' on' : ''}" data-act="${esc(group)}" data-v="" data-fx="chip">All</button>` +
  options
    .map(
      (option) =>
        `<button type="button" class="pl-chip${active === option.id ? ' on' : ''}" data-act="${esc(group)}" data-v="${esc(option.id)}" data-fx="chip">${esc(option.label)}</button>`,
    )
    .join('') +
  `</div>`;

/* Shared by both screens; each declares the subset it actually offers, so a
   Live card can never end up sorted by a distance the pack does not carry. */
export type SortId = 'soon' | 'cheap' | 'price-high' | 'az' | 'near' | 'rating';

export const sortRowHTML = (
  group: string,
  options: readonly { id: SortId; label: string }[],
  active: SortId,
): string =>
  `<div class="pl-sorts" role="group" aria-label="${esc(group)}">` +
  options
    .map(
      (option) =>
        `<button type="button" class="pl-sort${active === option.id ? ' on' : ''}" data-act="${esc(group)}" data-v="${esc(option.id)}" data-fx="toggle">${esc(option.label)}</button>`,
    )
    .join('') +
  `</div>`;

/**
 * The honesty badge. Every seeded listing carries one; it is not dismissible
 * and it is not styled as a footnote, because the whole point is that nobody
 * mistakes this pack for live inventory.
 */
export const sourceBadgeHTML = (label: string): string =>
  `<span class="pl-src" title="This is sample data, not live inventory">${esc(label)}</span>`;

/**
 * A real <video> when the pack has a clip, and an honest alternative when it
 * does not. The demo packs have no clips and no licensed video ships in this
 * repo at all, so the fallback is a CSS motion poster labelled as one — never a
 * play button that pretends there is footage behind it.
 */
export const mediaHTML = (
  clip: { src: string; type: string; caption: string } | undefined,
  poster: Poster,
): string =>
  clip
    ? `<video class="pl-video" controls playsinline preload="none" poster="">` +
      `<source src="${esc(clip.src)}" type="${esc(clip.type)}">` +
      `<p class="hint">${esc(clip.caption)}</p></video>`
    : `<div class="pl-motion" aria-hidden="true">${posterSVG(poster)}</div>`;
