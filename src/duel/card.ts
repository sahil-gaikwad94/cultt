/**
 * Duel Card — the shareable artifact of a completed duel.
 *
 * Rendered client-side on a canvas, from the record's real answers: nothing is
 * drawn that the two players did not pick. Two sizes ship (1080×1920 stories,
 * 1080×1080 feed), and the only difference between an in-app preview and an
 * external share is the footer: the watermark and the CTA appear on the way
 * out of the app and nowhere inside it (brief §6.4, the other way round).
 *
 * The art is the app's own language: brand-ink ground, faint grain, coral and
 * yellow sound-wave ribbons, fingerprint contours drawn with the same wobble
 * math as the seam's `fpSVG`, and typographic answer chips. No faces, no text
 * baked into any bitmap — the whole card is drawn here from live data, so it
 * stays translatable and stale-proof.
 */

import type { DuelRecord } from '../lib/types';

export type DuelCardSize = 'story' | 'square';

const INK = '#0A0A09';
const BONE = '#EFE9DA';
const CORAL = '#ff5d7a';
const SUN = '#ffd166';
const STONE = '#8e8b83';

const SIZES: Record<DuelCardSize, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const rngFor = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const sideLabel = (rec: DuelRecord): string => `${rec.a.name ?? 'You'} vs ${rec.b.name ?? 'Your friend'}`;

/** A fingerprint-contour ring, the seam's math on canvas. */
const contour = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  base: number,
  amp: number,
  lobes: readonly number[],
  phase: readonly number[],
): void => {
  ctx.beginPath();
  for (let a = 0; a <= 110; a++) {
    const t = (a / 110) * Math.PI * 2;
    const rr =
      base +
      amp *
        (0.85 * Math.sin((lobes[0] ?? 3) * t + (phase[0] ?? 0)) +
          0.6 * Math.sin((lobes[1] ?? 5) * t + (phase[1] ?? 0)) +
          0.4 * Math.sin((lobes[2] ?? 8) * t + (phase[2] ?? 0)));
    const x = cx + rr * Math.cos(t);
    const y = cy + rr * Math.sin(t);
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const wave = (ctx: CanvasRenderingContext2D, y0: number, amp: number, freq: number, color: string, alpha: number): void => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const w = ctx.canvas.width;
  for (let x = 0; x <= w; x += 4) {
    const y = y0 + Math.sin(x / (w / freq)) * amp + Math.sin(x / (w / (freq * 2.3)) + 1.2) * amp * 0.4;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
};

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 2): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1] ?? '';
    if ((lines.join(' ').length + text.replace(lines.join(' '), '').length) > last.length + 40) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
    }
  }
  return lines;
};

export interface DuelCardOptions {
  size?: DuelCardSize;
  /** External share mode adds the watermark + CTA footer. In-app: never. */
  external?: boolean;
  font?: string;
}

/** Draws the card onto `canvas`. Caller owns the canvas; sizes are enforced. */
export const renderDuelCard = (canvas: HTMLCanvasElement, rec: DuelRecord, opts: DuelCardOptions = {}): void => {
  const size = SIZES[opts.size ?? 'story'];
  const verdict = rec.verdict;
  const score = verdict?.score ?? 0;
  const of = verdict?.of ?? rec.prompts.length;
  const line = verdict?.line ?? 'Waiting for both sides.';

  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = opts.font ?? "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif";
  const k = size.h / 1920; // layout scale; square cards scale from the story grid
  const isSquare = opts.size === 'square';
  const s = (v: number): number => Math.round(v * (isSquare ? k * 1.45 : k));
  const M = s(84);

  // Ground + grain.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size.w, size.h);
  const r = rngFor(hashStr(rec.id));
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(r() * size.w, r() * size.h, 2, 2);
  }
  ctx.restore();

  // Ribbons: coral and yellow waves weaving once.
  wave(ctx, size.h * 0.16, s(26), 2.2, CORAL, 0.35);
  wave(ctx, size.h * 0.175, s(26), 2.2, SUN, 0.3);

  // Fingerprint top-corner, two contours overlapping (the two people).
  const cx = size.w - s(210);
  const cy = s(238);
  ctx.lineWidth = Math.max(2, s(3));
  ctx.strokeStyle = BONE;
  contour(ctx, cx - s(26), cy, s(34), s(5), [3, 5, 8], [0.4, 1.9, 3.1]);
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.strokeStyle = CORAL;
  contour(ctx, cx + s(26), cy, s(34), s(6), [4, 6, 9], [2.2, 0.6, 4.4]);
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Kicker + title.
  let y = M + s(16);
  ctx.fillStyle = SUN;
  ctx.font = `800 ${s(30)}px ${family}`;
  ctx.fillText('MEME DUEL', M, y);
  y += s(64);
  ctx.fillStyle = BONE;
  ctx.font = `800 ${s(78)}px ${family}`;
  for (const ln of wrap(ctx, sideLabel(rec), size.w - M * 2, 2)) {
    ctx.fillText(ln, M, y);
    y += s(88);
  }

  // Verdict block.
  y += s(10);
  ctx.font = `800 ${s(150)}px ${family}`;
  const big = verdict ? `${score}/${of}` : '—';
  ctx.fillStyle = verdict ? SUN : STONE;
  ctx.fillText(big, M, y + s(118));
  const bigW = ctx.measureText(big).width;
  ctx.font = `700 ${s(46)}px ${family}`;
  ctx.fillStyle = BONE;
  for (const [i, ln] of wrap(ctx, line, size.w - M * 2 - bigW - s(40), 2).entries()) {
    ctx.fillText(ln, M + bigW + s(40), y + s(56) + i * s(58));
  }
  y += s(190);

  // The five answers: prompt, both captions, each side's pick marked.
  const cardH = isSquare ? s(120) : s(168);
  for (const prompt of rec.prompts) {
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    const bx = M;
    const by = y;
    const bw = size.w - M * 2;
    const rad = s(30);
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, cardH, rad);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239,233,218,0.14)';
    ctx.lineWidth = Math.max(1, s(2));
    ctx.stroke();

    ctx.fillStyle = STONE;
    ctx.font = `800 ${s(26)}px ${family}`;
    ctx.fillText(`${prompt.emoji}  ${prompt.q.toUpperCase()}`, bx + s(36), by + s(44));

    const aPick = rec.a.picks?.[prompt.id];
    const bPick = rec.b.picks?.[prompt.id];
    const both = aPick && aPick === bPick;
    ctx.font = `700 ${s(34)}px ${family}`;
    let ly = by + (isSquare ? s(82) : s(96));
    for (const [side, opt] of [
      ['a', prompt.options.a],
      ['b', prompt.options.b],
    ] as const) {
      const marks: string[] = [];
      if (aPick === side) marks.push(rec.a.name ?? 'You');
      if (bPick === side) marks.push(rec.b.name ?? 'Your friend');
      const picked = marks.length > 0;
      const bothHere = both && picked;
      ctx.fillStyle = bothHere ? SUN : picked ? BONE : 'rgba(239,233,218,0.4)';
      const tag = picked ? `  ${bothHere ? '♥ both' : marks.join(' + ')}` : '';
      const label = `${side.toUpperCase()}  “${opt.text}”${tag}`;
      ctx.fillText(label, bx + s(36), ly);
      if (picked) {
        ctx.fillStyle = bothHere ? CORAL : SUN;
        ctx.beginPath();
        ctx.arc(bx + s(18), ly - s(12), s(7), 0, Math.PI * 2);
        ctx.fill();
      }
      ly += isSquare ? s(30) : s(44);
    }
    y += cardH + s(22);
  }

  // Footer: signature line always; watermark + CTA only on external shares.
  ctx.strokeStyle = 'rgba(239,233,218,0.2)';
  ctx.lineWidth = Math.max(1, s(2));
  ctx.beginPath();
  ctx.moveTo(M, size.h - s(180));
  ctx.lineTo(size.w - M, size.h - s(180));
  ctx.stroke();
  ctx.fillStyle = BONE;
  ctx.font = `800 ${s(52)}px ${family}`;
  ctx.fillText('cultured', M, size.h - s(108));
  if (opts.external) {
    ctx.fillStyle = STONE;
    ctx.font = `700 ${s(36)}px ${family}`;
    ctx.fillText('same meme, different damage — duel your friends', M, size.h - s(58));
    // Small ring glyph as the mark, no logo files.
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = Math.max(2, s(4));
    ctx.beginPath();
    ctx.arc(size.w - M - s(24), size.h - s(120), s(26), 0.6, 5.6);
    ctx.stroke();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(size.w - M - s(24), size.h - s(120), s(9), 0, Math.PI * 2);
    ctx.fill();
  }
};

export const duelCardBlob = async (rec: DuelRecord, size: DuelCardSize, external: boolean): Promise<Blob | null> => {
  if (typeof document === 'undefined') return null;
  try {
    await document.fonts.ready;
  } catch {
    /* fonts API unavailable — system fallback is fine */
  }
  const canvas = document.createElement('canvas');
  renderDuelCard(canvas, rec, { size, external });
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
};

export const downloadDuelCard = async (rec: DuelRecord, size: DuelCardSize): Promise<boolean> => {
  const blob = await duelCardBlob(rec, size, true); // downloading leaves the app: external
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cultured-duel-${rec.id}-${size}.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
};
