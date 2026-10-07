/**
 * Content manifest types.
 *
 * These live in `src/` rather than in `scripts/` so the app never imports from
 * the pipeline; the scripts import them from here instead. One definition, two
 * consumers.
 */

import type { HUMOR_AXES } from '../copy/taxonomy.ts';

export type HumorAxisId = (typeof HUMOR_AXES)[number];

export interface MemeVariant {
  width: number;
  avif: string;
  webp: string;
}

export interface MemeEntry {
  id: string;
  kind: 'image' | 'video';
  src: string;
  title: string;
  /** One of the 15 display categories in `src/copy/taxonomy.ts`. */
  category: string;
  mood: string;
  axis: HumorAxisId;
  placard: string;
  /** Doubles as the alt text (brief §11). */
  alt: string;
  credit: string | null;
  rightsCleared: boolean;
  width: number;
  height: number;
  bytes: number;
  dominant: string | null;
  blurhash: string | null;
  durationMs: number | null;
  poster: string | null;
  variants: MemeVariant[];
}

export interface MemeManifest {
  version: number;
  generatedAt: string;
  count: number;
  categories: string[];
  items: MemeEntry[];
}

export interface SongEntry {
  genre: string;
  title: string;
  artist: string;
  vibe: string;
  id: string;
  genreName: string;
  trackId: string | null;
  provider: 'itunes' | 'deezer' | null;
  previewUrl: string | null;
  artworkUrl: string | null;
  trackViewUrl: string | null;
  durationMs: number | null;
  resolved: boolean;
}

export interface SongManifest {
  version: number;
  generatedAt: string;
  count: number;
  resolvedCount: number;
  genres: { slug: string; name: string; count: number }[];
  items: SongEntry[];
}

export interface NhieQuestion {
  id: string;
  category: string;
  emoji: string;
  text: string;
  sub: string;
  axis: HumorAxisId;
  spice: number;
}

export interface NhieManifest {
  version: number;
  prefix: string;
  axes: string[];
  categories: { slug: string; name: string }[];
  spiceLegend: Record<string, string>;
  questions: NhieQuestion[];
  rounds: number;
}
