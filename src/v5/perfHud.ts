/**
 * `?perf=1` — a dev-only HUD (build brief §4.2).
 *
 * FPS, long tasks, JS heap, and the live counts the §10 caps are written
 * against: Lottie instances, decoded videos, particles. It is mounted only when
 * the flag is in the URL and never ships into the production bundle path
 * because nothing renders it unless asked.
 */

import { getQuality } from './quality.ts';

export interface PerfCounters {
  lottie: number;
  video: number;
  particles: number;
}

export interface PerfSample {
  fps: number;
  /** Longest task since the last sample, ms. */
  longTaskMs: number;
  longTaskCount: number;
  heapMb: number | null;
  counters: PerfCounters;
  tier: string;
}

export interface PerfHud {
  /** Registers a counter source. Effects call this when they mount. */
  track(key: keyof PerfCounters, delta: number): void;
  sample(): PerfSample;
  start(): void;
  stop(): void;
  destroy(): void;
}

export const perfEnabled = (search: string = typeof location === 'undefined' ? '' : location.search): boolean =>
  new URLSearchParams(search).get('perf') === '1';

export const createPerfHud = (doc: Document | null = typeof document === 'undefined' ? null : document): PerfHud => {
  const counters: PerfCounters = { lottie: 0, video: 0, particles: 0 };
  let frames = 0;
  let lastSampleAt = 0;
  let fps = 0;
  let longTaskMs = 0;
  let longTaskCount = 0;
  let raf = 0;
  let observer: PerformanceObserver | null = null;
  let element: HTMLElement | null = null;

  if (doc) {
    element = doc.createElement('div');
    element.id = 'perf-hud';
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = [
      'position:fixed',
      'top:calc(6px + env(safe-area-inset-top,0px))',
      'right:6px',
      'z-index:var(--z-perf,300)',
      'padding:6px 9px',
      'border-radius:10px',
      'background:rgba(10,10,9,.9)',
      'border:1px solid var(--gallery-hairline,#fff2)',
      'color:var(--bone,#EFE9DA)',
      'font:600 11px/1.4 ui-monospace,monospace',
      'pointer-events:none',
      'white-space:pre',
    ].join(';');
  }

  const heapMb = (): number | null => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10 : null;
  };

  const loop = (now: number) => {
    frames += 1;
    if (lastSampleAt && now - lastSampleAt >= 1000) {
      fps = Math.round((frames * 1000) / (now - lastSampleAt));
      frames = 0;
      lastSampleAt = now;
      if (element) {
        const heap = heapMb();
        element.textContent = [
          `${fps} fps  tier ${getQuality().tier}`,
          `long ${longTaskCount}× ${longTaskMs.toFixed(0)}ms`,
          `heap ${heap === null ? '—' : `${heap}MB`}`,
          `lottie ${counters.lottie}/${getQuality().caps.liveLottie}  video ${counters.video}/${getQuality().caps.decodedVideos}`,
          `particles ${counters.particles}/${getQuality().caps.particles}`,
        ].join('\n');
      }
      longTaskMs = 0;
      longTaskCount = 0;
    }
    raf = requestAnimationFrame(loop);
  };

  return {
    track(key, delta) {
      counters[key] = Math.max(0, counters[key] + delta);
    },
    sample() {
      return {
        fps,
        longTaskMs,
        longTaskCount,
        heapMb: heapMb(),
        counters: { ...counters },
        tier: getQuality().tier,
      };
    },
    start() {
      if (!element || element.isConnected) {
        if (element && doc && !element.isConnected) doc.body.appendChild(element);
      } else if (doc) {
        doc.body.appendChild(element);
      }
      if (!raf) {
        lastSampleAt = 0;
        frames = 0;
        raf = requestAnimationFrame(loop);
      }
      if (!observer && typeof PerformanceObserver === 'function') {
        try {
          observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              longTaskCount += 1;
              longTaskMs = Math.max(longTaskMs, entry.duration);
            }
          });
          observer.observe({ entryTypes: ['longtask'] });
        } catch {
          observer = null;
        }
      }
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observer?.disconnect();
      observer = null;
      element?.remove();
    },
    destroy() {
      this.stop();
      element = null;
    },
  };
};

let singleton: PerfHud | null = null;

/** Returns a no-op HUD when the flag is off, so call sites need no branching. */
export const getPerfHud = (): PerfHud => {
  if (!perfEnabled()) {
    return (singleton ??= {
      track: () => undefined,
      sample: () => ({ fps: 0, longTaskMs: 0, longTaskCount: 0, heapMb: null, counters: { lottie: 0, video: 0, particles: 0 }, tier: getQuality().tier }),
      start: () => undefined,
      stop: () => undefined,
      destroy: () => undefined,
    });
  }
  return (singleton ??= createPerfHud());
};
