/**
 * Playback (build brief §4.4).
 *
 * One shared `<audio>` element, one global mini-player, 120 ms fades, resume
 * position, pause on blur. Previews always come through `/api/preview?id=…`
 * with a short in-memory cache, because Deezer URLs expire.
 *
 * Cross-origin preview audio is **never** piped into WebAudio — it returns
 * silence. Waveforms are drawn procedurally from a seed derived from the track
 * id and advanced by the element's own `currentTime`.
 */

export interface PlayableTrack {
  id: string;
  title: string;
  artist: string;
  /** From the manifest; may be null when the pipeline could not resolve it. */
  previewUrl: string | null;
  provider: 'itunes' | 'deezer' | null;
  trackId: string | null;
  trackViewUrl: string | null;
  durationMs: number | null;
}

export interface PlayerState {
  trackId: string | null;
  playing: boolean;
  /** 0..1 of the preview. */
  progress: number;
  /** Seconds, from the element. */
  currentTime: number;
  /** Seconds, or the manifest's duration when the element has not loaded. */
  duration: number;
  /** Why nothing is playing. Drives the honest empty line. */
  reason: 'idle' | 'playing' | 'paused' | 'no-preview' | 'error' | 'loading';
}

export interface AudioController {
  state(): PlayerState;
  play(track: PlayableTrack): Promise<void>;
  toggle(track: PlayableTrack): Promise<void>;
  pause(): void;
  stop(): void;
  seek(fraction: number): void;
  subscribe(listener: (state: PlayerState) => void): () => void;
  destroy(): void;
}

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const FADE_MS = 120;

export interface AudioOptions {
  /** Injected element in tests. */
  element?: HTMLAudioElement;
  documentRef?: Document;
  fetchImpl?: typeof fetch;
  /** Skip the network entirely (tests, offline dev). */
  offline?: boolean;
  now?: () => number;
}

/** Deterministic per-track waveform. Never derived from the audio itself. */
export const waveformFor = (trackId: string, bars: number): number[] => {
  let h = 2166136261;
  for (let i = 0; i < trackId.length; i += 1) {
    h ^= trackId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < bars; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const base = 0.25 + (((h >>> 0) % 1000) / 1000) * 0.75;
    // A gentle envelope so it reads as a song, not as noise.
    const envelope = 0.6 + 0.4 * Math.sin((i / bars) * Math.PI);
    out.push(Math.min(1, base * envelope));
  }
  return out;
};

export const createAudioController = (options: AudioOptions = {}): AudioController => {
  const doc = options.documentRef ?? (typeof document === 'undefined' ? null : document);
  const now = options.now ?? (() => Date.now());
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const element = options.element ?? doc?.createElement('audio') ?? null;

  if (element) {
    element.preload = 'metadata';
    // A preview that ends should stop cleanly, not loop.
    element.loop = false;
  }

  let state: PlayerState = {
    trackId: null,
    playing: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    reason: 'idle',
  };
  const listeners = new Set<(s: PlayerState) => void>();
  const cache = new Map<string, { url: string; at: number }>();
  const resumeAt = new Map<string, number>();
  let fadeTimer: ReturnType<typeof setInterval> | null = null;
  let raf = 0;

  const emit = () => {
    for (const listener of [...listeners]) listener(state);
  };
  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch };
    emit();
  };

  /** Re-resolves through `/api/preview` unless the cache is fresh. */
  const previewUrl = async (track: PlayableTrack): Promise<string | null> => {
    if (!track.previewUrl && !track.trackId) return null;
    if (options.offline || !fetchImpl || !track.trackId) return track.previewUrl;

    const key = `${track.provider}:${track.trackId}`;
    const cached = cache.get(key);
    if (cached && now() - cached.at < PREVIEW_CACHE_TTL_MS) return cached.url;

    try {
      const response = await fetchImpl(`/api/preview?id=${encodeURIComponent(track.trackId)}&provider=${track.provider ?? 'itunes'}`);
      if (!response.ok) return track.previewUrl;
      const body = (await response.json()) as { previewUrl?: string | null };
      const url = body.previewUrl ?? null;
      if (url) cache.set(key, { url, at: now() });
      return url ?? track.previewUrl;
    } catch {
      return track.previewUrl;
    }
  };

  const cancelFade = () => {
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
  };

  const fadeTo = (target: number, onDone?: () => void) => {
    if (!element) {
      onDone?.();
      return;
    }
    cancelFade();
    const from = element.volume;
    const steps = 6;
    let step = 0;
    fadeTimer = setInterval(() => {
      step += 1;
      element.volume = Math.max(0, Math.min(1, from + ((target - from) * step) / steps));
      if (step >= steps) {
        cancelFade();
        onDone?.();
      }
    }, FADE_MS / steps);
  };

  const stopRaf = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const trackProgress = () => {
    if (!element || !state.playing) return;
    const duration = element.duration && Number.isFinite(element.duration) ? element.duration : state.duration;
    set({
      currentTime: element.currentTime,
      duration: duration || state.duration,
      progress: duration ? Math.min(1, element.currentTime / duration) : 0,
    });
    raf = requestAnimationFrame(trackProgress);
  };

  if (element) {
    element.addEventListener('ended', () => {
      stopRaf();
      set({ playing: false, progress: 1, reason: 'idle' });
    });
    element.addEventListener('error', () => {
      stopRaf();
      set({ playing: false, reason: 'error' });
    });
    element.addEventListener('pause', () => {
      if (!element) return;
      if (state.trackId) resumeAt.set(state.trackId, element.currentTime);
      stopRaf();
      if (state.playing) set({ playing: false, reason: 'paused' });
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => {
      if (state.playing) element?.pause();
    });
  }

  const play = async (track: PlayableTrack): Promise<void> => {
    if (!element) return;
    if (state.trackId === track.id && state.playing) return;

    // A different track: remember where this one was.
    if (state.trackId && state.trackId !== track.id) resumeAt.set(state.trackId, element.currentTime);

    set({ trackId: track.id, reason: 'loading', duration: track.durationMs ? track.durationMs / 1000 : 0 });

    const url = await previewUrl(track);
    if (!url) {
      set({ playing: false, reason: 'no-preview', progress: 0 });
      return;
    }

    if (element.src !== url) {
      element.src = url;
      element.load();
    }
    element.volume = 0;
    try {
      await element.play();
    } catch {
      set({ playing: false, reason: 'error' });
      return;
    }
    const resume = resumeAt.get(track.id) ?? 0;
    if (resume > 0 && resume < (element.duration || Infinity) - 1) element.currentTime = resume;
    fadeTo(1);
    set({ playing: true, reason: 'playing' });
    stopRaf();
    raf = requestAnimationFrame(trackProgress);
  };

  return {
    state: () => state,
    play,
    async toggle(track) {
      if (state.trackId === track.id && state.playing) {
        fadeTo(0, () => element?.pause());
        return;
      }
      await play(track);
    },
    pause() {
      fadeTo(0, () => element?.pause());
    },
    stop() {
      cancelFade();
      stopRaf();
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
      resumeAt.clear();
      set({ trackId: null, playing: false, progress: 0, currentTime: 0, reason: 'idle' });
    },
    seek(fraction) {
      if (!element || !Number.isFinite(element.duration)) return;
      element.currentTime = Math.max(0, Math.min(1, fraction)) * element.duration;
      set({ currentTime: element.currentTime, progress: Math.max(0, Math.min(1, fraction)) });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      cancelFade();
      stopRaf();
      listeners.clear();
    },
  };
};

let singleton: AudioController | null = null;

/** The one player. §10 caps the app at a single audio element. */
export const getAudio = (): AudioController => (singleton ??= createAudioController());

export const setAudioForTests = (controller: AudioController | null): void => {
  singleton?.destroy();
  singleton = controller;
};
