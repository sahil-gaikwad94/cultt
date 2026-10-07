/**
 * The quality ladder (build brief §4.2).
 *
 * On boot we read `deviceMemory` / `hardwareConcurrency`, then run a ~500 ms
 * frame-time probe, and pick a tier:
 *
 *   A — WebGL2 + full FX
 *   B — Canvas2D + reduced FX (halved particles, no big blurs)
 *   C — CSS/video fallbacks only (no canvas loops, no particles)
 *
 * Every effect in v5 reads `quality.tier` before deciding how much to do. The
 * probe is real measurement, not a device database: a fast phone in a bad
 * thermal state still lands on B.
 */

export type QualityTier = 'A' | 'B' | 'C';

export interface QualityProfile {
  tier: QualityTier;
  /** Why this tier was chosen — surfaced in the `?perf=1` HUD. */
  reason: string;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  /** Median frame time observed during the probe, in ms. */
  frameMs: number | null;
  webgl2: boolean;
  reducedMotion: boolean;
  /** Caps derived from the tier. §10's hard ceilings are the ceiling for A. */
  caps: {
    particles: number;
    liveLottie: number;
    decodedVideos: number;
    dpr: number;
  };
}

export const CAPS: Record<QualityTier, QualityProfile['caps']> = {
  A: { particles: 300, liveLottie: 6, decodedVideos: 3, dpr: 2 },
  B: { particles: 150, liveLottie: 3, decodedVideos: 2, dpr: 1.5 },
  C: { particles: 0, liveLottie: 1, decodedVideos: 1, dpr: 1 },
};

interface ProbeEnv {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  reducedMotion?: boolean;
  webgl2?: boolean;
  /** Injected frame times in tests. */
  frameSamples?: number[];
  /** Skip the probe entirely (tests, or a build that wants a fixed tier). */
  skipProbe?: boolean;
}

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const detectWebgl2 = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
};

/**
 * Classifies a profile from the numbers alone. Pure — the probe calls it, and
 * the tests pin it.
 */
export const classify = (input: {
  frameMs: number | null;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  webgl2: boolean;
  reducedMotion: boolean;
}): { tier: QualityTier; reason: string } => {
  if (input.reducedMotion) {
    return { tier: 'C', reason: 'prefers-reduced-motion' };
  }

  // Measured frame time always wins over the spec sheet.
  if (input.frameMs !== null) {
    if (input.frameMs <= 18) return { tier: input.webgl2 ? 'A' : 'B', reason: `probe ${input.frameMs.toFixed(1)}ms/frame` };
    if (input.frameMs <= 30) return { tier: 'B', reason: `probe ${input.frameMs.toFixed(1)}ms/frame` };
    return { tier: 'C', reason: `probe ${input.frameMs.toFixed(1)}ms/frame` };
  }

  const memory = input.deviceMemoryGb;
  const cores = input.hardwareConcurrency;
  if (memory !== null && memory <= 2) return { tier: 'C', reason: `deviceMemory ${memory}GB` };
  if (memory !== null && memory <= 4) return { tier: 'B', reason: `deviceMemory ${memory}GB` };
  if (cores !== null && cores <= 2) return { tier: 'C', reason: `${cores} cores` };
  if (cores !== null && cores <= 4) return { tier: 'B', reason: `${cores} cores` };
  return { tier: input.webgl2 ? 'A' : 'B', reason: input.webgl2 ? 'webgl2 available' : 'no webgl2' };
};

/**
 * Measures real frame times for ~500 ms while doing the kind of work the app
 * does (a transform + a readback), then classifies.
 *
 * Resolves with the profile; never rejects, and always resolves within ~700 ms
 * even if `requestAnimationFrame` stalls.
 */
export const measureQuality = async (env: ProbeEnv = {}): Promise<QualityProfile> => {
  const deviceMemoryGb = env.deviceMemory ?? (typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null : null);
  const hardwareConcurrency =
    env.hardwareConcurrency ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null);
  const reducedMotion =
    env.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  const webgl2 = env.webgl2 ?? detectWebgl2();

  const build = (frameMs: number | null, reason: string, tier: QualityTier): QualityProfile => ({
    tier,
    reason,
    deviceMemoryGb,
    hardwareConcurrency,
    frameMs,
    webgl2,
    reducedMotion,
    caps: CAPS[tier],
  });

  if (env.skipProbe || reducedMotion || typeof requestAnimationFrame === 'undefined') {
    const { tier, reason } = classify({ frameMs: null, deviceMemoryGb, hardwareConcurrency, webgl2, reducedMotion });
    return build(null, reason, tier);
  }

  const samples = env.frameSamples ?? (await runFrameProbe());
  const frameMs = median(samples);
  const { tier, reason } = classify({ frameMs, deviceMemoryGb, hardwareConcurrency, webgl2, reducedMotion });
  return build(frameMs, reason, tier);
};

/** Drives ~500 ms of rAF and records the deltas. */
export const runFrameProbe = (budgetMs = 500): Promise<number[]> =>
  new Promise((resolve) => {
    const samples: number[] = [];
    let last = performance.now();
    const startedAt = last;

    const step = (now: number) => {
      samples.push(now - last);
      last = now;
      if (now - startedAt < budgetMs) requestAnimationFrame(step);
      else resolve(samples.slice(1)); // drop the first frame, it includes setup
    };

    requestAnimationFrame(step);
    // Hard stop: a stalled compositor must not hang boot.
    setTimeout(() => resolve(samples.slice(1)), budgetMs + 200);
  });

let current: QualityProfile | null = null;

/** The app-wide profile. `initQuality()` fills it; before that it is tier B. */
export const quality: QualityProfile = {
  tier: 'B',
  reason: 'not measured yet',
  deviceMemoryGb: null,
  hardwareConcurrency: null,
  frameMs: null,
  webgl2: false,
  reducedMotion: false,
  caps: CAPS.B,
};

export const initQuality = async (env: ProbeEnv = {}): Promise<QualityProfile> => {
  const measured = await measureQuality(env);
  Object.assign(quality, measured);
  current = measured;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.qualityTier = measured.tier;
  }
  return measured;
};

export const getQuality = (): QualityProfile => current ?? quality;

export const setQualityForTests = (profile: QualityProfile | null): void => {
  current = profile;
  if (profile) Object.assign(quality, profile);
};
