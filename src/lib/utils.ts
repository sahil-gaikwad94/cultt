import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${n}`;
}

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic mock amplitude array for waveform canvases. */
export function makeWave(seed: number, n = 56): number[] {
  const rnd = seededRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const env = Math.sin((i / n) * Math.PI) * 0.55 + 0.45;
    out.push(Math.max(0.12, Math.min(1, env * (0.35 + rnd() * 0.75))));
  }
  return out;
}

export function initials(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
