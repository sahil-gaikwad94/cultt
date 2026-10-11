/**
 * The share card — one placard layout, drawn on a canvas.
 *
 * Build brief §6: "Share card: one clean 'placard' layout in three sizes
 * (9:16, 1:1, link preview). Meme, song, Fingerprint, Duel result, Weekly recap
 * all use the same template. Restrained on purpose."
 *
 * The layout maths is split out as `cardLayout` and unit-tested, because the
 * thing that goes wrong in every implementation of this is the image fit:
 * stretch it to fill and a 700×368 meme becomes unwatchable, letterbox it
 * without a frame and the card looks broken. `cardLayout` returns the rect that
 * preserves the source aspect ratio inside the frame, and the caller draws a
 * blurred copy behind it so the letterbox is filled rather than empty — the
 * same trick Instagram uses.
 *
 * Rendering needs a real canvas. jsdom has none, so `renderShareCard` returns
 * `null` and the caller falls back to sharing the raw image. That fallback is
 * the honest one: a share target that cannot draw a card should still send
 * something real.
 */

export type CardAspect = '9:16' | '1:1';

export const CARD_SIZES: Record<CardAspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardLayoutInput {
  canvas: { width: number; height: number };
  image: { width: number; height: number };
  /** Space kept clear at the top for the brand line. */
  topInset?: number;
  /** Space kept clear at the bottom for the placard text. */
  bottomInset?: number;
  /** Padding inside the frame. */
  padding?: number;
}

export interface CardLayout {
  /** Where the sharp image goes. Aspect ratio preserved, never enlarged. */
  image: CardRect;
  /** The full bleed area behind it, for the blurred fill. */
  bleed: CardRect;
  frame: CardRect;
}

/**
 * Where everything goes. Pure, and the only place aspect ratios are decided —
 * which is why a stretched share image is a bug in this function and nowhere
 * else.
 */
export const cardLayout = (input: CardLayoutInput): CardLayout => {
  const topInset = input.topInset ?? 220;
  const bottomInset = input.bottomInset ?? 420;
  const padding = input.padding ?? 48;

  const bleed: CardRect = { x: 0, y: 0, width: input.canvas.width, height: input.canvas.height };

  const frameWidth = input.canvas.width - padding * 2;
  const frameHeight = input.canvas.height - topInset - bottomInset;
  const frame: CardRect = { x: padding, y: topInset, width: frameWidth, height: Math.max(1, frameHeight) };

  const sourceAspect = input.image.width > 0 ? input.image.width / input.image.height : 1;
  const boxAspect = frame.width / frame.height;

  let width: number;
  let height: number;
  if (sourceAspect > boxAspect) {
    // Wider than the frame: fit the width, letterbox top and bottom.
    width = frame.width;
    height = frame.width / sourceAspect;
  } else {
    height = frame.height;
    width = frame.height * sourceAspect;
  }

  return {
    bleed,
    frame,
    image: {
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    },
  };
};

export interface ShareCardContent {
  image: { src: string; alt: string };
  title: string;
  caption: string;
  /** Hex-validated by the caller's token, defaulted here. */
  accent?: string;
  aspect?: CardAspect;
}

const BONE = '#EFE9DA';
const INK = '#0A0A09';
const MIST = '#b9b5aa';
const DEFAULT_ACCENT = '#E8C77E';

const isHex = (value: string | undefined): value is string => !!value && /^#[0-9a-fA-F]{6}$/.test(value);

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (typeof Image !== 'function') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/**
 * Draws the card and returns a PNG blob, or `null` when this environment has
 * no canvas — in which case the caller shares the raw image instead.
 */
export const renderShareCard = async (content: ShareCardContent): Promise<Blob | null> => {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const size = CARD_SIZES[content.aspect ?? '9:16'];
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = await loadImage(content.image.src);
  const accent = isHex(content.accent) ? content.accent : DEFAULT_ACCENT;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size.width, size.height);

  const iw = img?.naturalWidth ?? 700;
  const ih = img?.naturalHeight ?? 400;
  const layout = cardLayout({ canvas: size, image: { width: iw, height: ih } });

  if (img) {
    // The blurred bleed: same image, cover-fitted and softened, so a landscape
    // meme in a 9:16 card is framed rather than floating in a black void.
    ctx.save();
    ctx.filter = 'blur(48px) saturate(1.1)';
    ctx.globalAlpha = 0.55;
    const coverScale = Math.max(size.width / iw, size.height / ih);
    const cw = iw * coverScale;
    const ch = ih * coverScale;
    ctx.drawImage(img, (size.width - cw) / 2, (size.height - ch) / 2, cw, ch);
    ctx.restore();

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.filter = 'blur(52px)';
    ctx.drawImage(img, (size.width - cw) / 2, (size.height - ch) / 2, cw, ch);
    ctx.restore();

    // The frame, then the sharp image inside it.
    const r = 36;
    ctx.save();
    roundRect(ctx, layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, r);
    ctx.clip();
    ctx.drawImage(img, layout.image.x, layout.image.y, layout.image.width, layout.image.height);
    ctx.restore();
    ctx.strokeStyle = 'rgba(239,233,218,0.22)';
    ctx.lineWidth = 2;
    roundRect(ctx, layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, r);
    ctx.stroke();
  }

  // Brand line.
  ctx.fillStyle = MIST;
  ctx.font = '500 30px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const kicker = 'CULTURED';
  ctx.fillText(spaced(kicker), 60, 130);
  ctx.fillStyle = accent;
  ctx.fillRect(60, 156, 96, 6);

  // The placard.
  ctx.fillStyle = BONE;
  ctx.font = '700 58px Helvetica, Arial, sans-serif';
  wrapText(ctx, content.title, 60, size.height - 300, size.width - 120, 68, 2);
  ctx.fillStyle = MIST;
  ctx.font = '400 34px Helvetica, Arial, sans-serif';
  wrapText(ctx, content.caption, 60, size.height - 150, size.width - 120, 44, 2);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
};

const spaced = (value: string): string => value.split('').join(' ');

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

/** Greedy wrap, capped at `maxLines` with an ellipsis. Exported for testing. */
/**
 * Greedy wrap, capped at `maxLines`, with an ellipsis when something was
 * dropped. Exported for testing because getting this wrong is what puts text
 * off the bottom of a share card.
 */
export const wrapLines = (
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
  maxLines = 2,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i += 1) {
    const candidate = current ? `${current} ${words[i]}` : (words[i] as string);
    if (measure(candidate) <= maxWidth || !current) {
      // A single word wider than the line is kept rather than dropped.
      current = candidate;
    } else {
      lines.push(current);
      current = words[i] as string;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  const used = lines.reduce((n, line) => n + line.split(/\s+/).filter(Boolean).length, 0);
  if (used < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  }
  return lines.slice(0, maxLines);
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void => {
  const lines = wrapLines(text, maxWidth, (line) => ctx.measureText(line).width, maxLines);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
};
