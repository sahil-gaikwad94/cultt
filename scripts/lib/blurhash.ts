/**
 * A dependency-free BlurHash encoder.
 *
 * The npm `blurhash` package is small, but the pipeline already pulls `sharp`
 * and adding a second runtime dependency for 80 lines of DCT math is not worth
 * it. This implements the reference algorithm: DCT to `nx × ny` components,
 * linear→sRGB per component, base83 encoding.
 *
 * Used for the Deck's instant placeholders, so a card paints its colour story
 * before a single byte of AVIF arrives.
 */

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

const encode83 = (value: number, length: number): string => {
  let out = '';
  for (let i = 1; i <= length; i += 1) {
    const digit = Math.floor(value) / 83 ** (length - i);
    out += BASE83[Math.floor(digit) % 83];
  }
  return out;
};

const signPow = (value: number, exp: number): number => Math.sign(value) * Math.abs(value) ** exp;

const decode83 = (str: string): number => {
  let value = 0;
  for (const char of str) {
    const index = BASE83.indexOf(char);
    if (index < 0) throw new Error(`Invalid base83 character: ${char}`);
    value = value * 83 + index;
  }
  return value;
};

const srgbToLinear = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (value: number): number => {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308 ? Math.round(v * 12.92 * 255 + 0.5) : Math.round((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
};

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major RGBA bytes, `width * height * 4`. */
  data: Uint8Array | Buffer;
}

/**
 * Encodes a blurhash. `componentsX`/`componentsY` are 1–9; 4×3 is the usual
 * trade for a card placeholder.
 */
export const encodeBlurhash = (image: RgbaImage, componentsX = 4, componentsY = 3): string => {
  if (componentsX < 1 || componentsX > 9 || componentsY < 1 || componentsY > 9) {
    throw new Error('BlurHash components must be between 1 and 9');
  }

  const factors: number[][] = [];
  for (let j = 0; j < componentsY; j += 1) {
    for (let i = 0; i < componentsX; i += 1) {
      const norm = i === 0 && j === 0 ? 1 : 2;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const basis = norm * Math.cos((Math.PI * i * x) / image.width) * Math.cos((Math.PI * j * y) / image.height);
          const offset = (y * image.width + x) * 4;
          r += basis * srgbToLinear(image.data[offset]);
          g += basis * srgbToLinear(image.data[offset + 1]);
          b += basis * srgbToLinear(image.data[offset + 2]);
        }
      }
      const scale = 1 / (image.width * image.height);
      factors.push([r * scale, g * scale, b * scale]);
    }
  }

  const dc = factors[0];
  const ac = factors.slice(1);

  const maximumValue = ac.length ? Math.max(...ac.flatMap((f) => f.map(Math.abs))) : 0;
  const quantisedMaximum = Math.max(0, Math.min(82, Math.floor(maximumValue * 166 - 0.5)));
  const realMaximum = (quantisedMaximum + 1) / 166;

  let hash = encode83(componentsX - 1 + (componentsY - 1) * 9, 1);
  hash += encode83(quantisedMaximum, 1);
  hash += encode83(
    Math.floor(dc[0] * 19) ** 1 * 19 ** 0 + Math.floor(dc[1] * 19) * 19 + Math.floor(dc[2] * 19) * 19 * 19,
    4,
  );
  for (const factor of ac) {
    hash += encode83(
      Math.floor(signPow(factor[0] / realMaximum, 0.5) * 9 + 9.5) +
        Math.floor(signPow(factor[1] / realMaximum, 0.5) * 9 + 9.5) * 19 +
        Math.floor(signPow(factor[2] / realMaximum, 0.5) * 9 + 9.5) * 19 * 19,
      4,
    );
  }
  return hash;
};

/** Decodes a blurhash back to RGB pixels — used by the tests to round-trip. */
export const decodeBlurhash = (hash: string, width: number, height: number): Uint8Array => {
  if (hash.length < 6) throw new Error('BlurHash is too short');
  const sizeFlag = decode83(hash[0]);
  const componentsX = (sizeFlag % 9) + 1;
  const componentsY = Math.floor(sizeFlag / 9) + 1;
  if (hash.length !== 4 + 2 * componentsX * componentsY) throw new Error('BlurHash length does not match its size flag');

  const quantisedMaximum = decode83(hash[1]);
  const realMaximum = (quantisedMaximum + 1) / 166;

  const colours: number[][] = [];
  for (let i = 0; i < componentsX * componentsY; i += 1) {
    if (i === 0) {
      const value = decode83(hash.slice(2, 6));
      colours.push([
        srgbToLinear(Math.floor(value / (19 * 19)) % 19),
        srgbToLinear(Math.floor(value / 19) % 19),
        srgbToLinear(value % 19),
      ]);
      continue;
    }
    const value = decode83(hash.slice(4 + i * 2, 6 + i * 2));
    colours.push([
      signPow((Math.floor(value / (19 * 19)) % 19 - 9) / 9, 2) * realMaximum,
      signPow((Math.floor(value / 19) % 19 - 9) / 9, 2) * realMaximum,
      signPow((value % 19 - 9) / 9, 2) * realMaximum,
    ]);
  }

  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < componentsY; j += 1) {
        for (let i = 0; i < componentsX; i += 1) {
          const basis = Math.cos((Math.PI * i * x) / width) * Math.cos((Math.PI * j * y) / height);
          const colour = colours[j * componentsX + i];
          r += colour[0] * basis;
          g += colour[1] * basis;
          b += colour[2] * basis;
        }
      }
      const offset = (y * width + x) * 3;
      pixels[offset] = linearToSrgb(r);
      pixels[offset + 1] = linearToSrgb(g);
      pixels[offset + 2] = linearToSrgb(b);
    }
  }
  return pixels;
};

/**
 * Draws a blurhash to a data-URL CSS gradient. The app uses this for the
 * placeholder layer so no canvas work happens on the main thread.
 */
export const blurhashToCss = (hash: string, width = 32, height = 24): string => {
  const pixels = decodeBlurhash(hash, width, height);
  const stops: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      stops.push(`rgb(${pixels[offset]} ${pixels[offset + 1]} ${pixels[offset + 2]}) ${((x / (width - 1)) * 100).toFixed(1)}% ${((y / (height - 1)) * 100).toFixed(1)}%`);
    }
  }
  return stops.join(',');
};
