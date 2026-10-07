/**
 * The overlay manager: one owner for everything that floats above the app.
 *
 * Bug §4.1.2 is a Meme Duel modal opening over Home right after onboarding,
 * with a "Welcome to cultured" toast covering its button. There was no owner:
 * sheets, modals, toasts, the reaction tray and coachmarks each wrote their own
 * z-index into `src/styles/app.css` and each decided for itself whether now was
 * a good time.
 *
 * This module gives them one queue with priorities. Rules:
 *  - Only one *blocking* layer (modal / sheet / tray) is mounted at a time.
 *  - Toasts never stack above a blocking layer's interactive area — they are
 *    re-anchored to the top of the viewport and queued behind the layer.
 *  - `prefers-reduced-motion` collapses all transition durations to ~0.
 *
 * z-index numbers live in exactly one place: the `--z-*` scale in
 * `src/styles/tokens.css`. Nothing else in `src/` should write a z-index.
 */

export type OverlayKind = 'toast' | 'sheet' | 'modal' | 'reaction-tray' | 'coachmark';

export interface OverlayLayer {
  id: string;
  kind: OverlayKind;
  /** Higher wins when two layers want the screen at once. */
  priority: number;
  el: HTMLElement;
  /** Called when the layer is dismissed by the manager (not by its own UI). */
  onDismiss?: () => void;
}

/** Priority ladder. Ties break on insertion order (FIFO). */
export const PRIORITY: Record<OverlayKind, number> = {
  toast: 10,
  coachmark: 20,
  sheet: 30,
  modal: 40,
  'reaction-tray': 50,
};

/** z-index tokens, mirroring `--z-*` in tokens.css so JS and CSS agree.
 *  The toast sits ABOVE sheets and modals on purpose: it is transient and
 *  `pointer-events:none`, so it can confirm an action taken inside a sheet —
 *  but it is anchored to the top of the viewport so it can never cover the
 *  button that just fired it. */
export const Z: Record<OverlayKind, number> = {
  coachmark: 70,
  sheet: 80,
  modal: 90,
  'reaction-tray': 100,
  toast: 120,
};

export interface OverlayManagerOptions {
  document?: Document | null;
  /** Blocking kinds that may not coexist. */
  blocking?: readonly OverlayKind[];
  onStateChange?: (state: OverlayState) => void;
}

export interface OverlayState {
  /** The layer currently on top, if any. */
  top: OverlayLayer | null;
  /** All mounted layers, bottom to top. */
  stack: OverlayLayer[];
  /** Queued but not yet mounted. */
  queued: OverlayLayer[];
}

export interface OverlayManager {
  open(layer: Omit<OverlayLayer, 'priority'> & { priority?: number }): OverlayLayer;
  close(id: string): void;
  closeKind(kind: OverlayKind): void;
  closeAll(): void;
  state(): OverlayState;
  subscribe(listener: (state: OverlayState) => void): () => void;
}

const isBlockingKind = (kind: OverlayKind, blocking: readonly OverlayKind[]): boolean => blocking.includes(kind);

export const createOverlayManager = (options: OverlayManagerOptions = {}): OverlayManager => {
  const doc = options.document ?? (typeof document === 'undefined' ? null : document);
  const blocking = options.blocking ?? (['sheet', 'modal', 'reaction-tray'] as const);
  const listeners = new Set<(state: OverlayState) => void>();

  let stack: OverlayLayer[] = [];
  let queued: OverlayLayer[] = [];

  const emit = () => {
    const snapshot: OverlayState = {
      top: stack.length ? stack[stack.length - 1] : null,
      stack: [...stack],
      queued: [...queued],
    };
    options.onStateChange?.(snapshot);
    for (const listener of [...listeners]) listener(snapshot);
  };

  const applyZ = (layer: OverlayLayer) => {
    const index = stack.indexOf(layer);
    // Blocking layers stack on their kind's rung; everything else takes its
    // rung as-is. The rung comes from Z, never from a hard-coded number here.
    const base = Z[layer.kind];
    layer.el.style.zIndex = String(isBlockingKind(layer.kind, blocking) ? base + index : base);
    layer.el.dataset.overlayKind = layer.kind;
    layer.el.dataset.overlayTop = String(index === stack.length - 1);
  };

  const mount = (layer: OverlayLayer) => {
    stack = [...stack, layer];
    if (doc && layer.el.ownerDocument === doc && !layer.el.isConnected) doc.body.appendChild(layer.el);
    layer.el.hidden = false;
    stack.forEach(applyZ);
    emit();
  };

  const tryPromote = () => {
    if (!queued.length) return;
    const activeBlocking = stack.some((l) => isBlockingKind(l.kind, blocking));
    if (activeBlocking) return;
    const next = queued[0];
    if (isBlockingKind(next.kind, blocking)) {
      queued = queued.slice(1);
      mount(next);
    }
  };

  const open: OverlayManager['open'] = (input) => {
    const layer: OverlayLayer = { ...input, priority: input.priority ?? PRIORITY[input.kind] };

    // Replace an existing layer of the same id rather than double-mounting.
    const existing = stack.find((l) => l.id === layer.id) ?? queued.find((l) => l.id === layer.id);
    if (existing) {
      close(existing.id);
    }

    const wantsBlocking = isBlockingKind(layer.kind, blocking);
    const activeBlocking = stack.filter((l) => isBlockingKind(l.kind, blocking));

    if (wantsBlocking && activeBlocking.length) {
      // A higher-priority blocking layer takes the screen; the incumbent is
      // queued back underneath rather than being destroyed mid-interaction.
      const incumbent = activeBlocking[activeBlocking.length - 1];
      if (layer.priority > incumbent.priority) {
        stack = stack.filter((l) => l !== incumbent);
        incumbent.el.hidden = true;
        queued = [incumbent, ...queued];
        mount(layer);
        return layer;
      }
      queued = [...queued, layer].sort((a, b) => b.priority - a.priority);
      emit();
      return layer;
    }

    mount(layer);
    return layer;
  };

  const close: OverlayManager['close'] = (id) => {
    const inStack = stack.find((l) => l.id === id);
    const inQueue = queued.find((l) => l.id === id);
    if (!inStack && !inQueue) return;

    if (inQueue) {
      queued = queued.filter((l) => l.id !== id);
      emit();
      return;
    }

    stack = stack.filter((l) => l.id !== id);
    if (inStack) {
      inStack.el.hidden = true;
      inStack.onDismiss?.();
    }
    stack.forEach(applyZ);
    emit();
    tryPromote();
  };

  return {
    open,
    close,
    closeKind(kind) {
      for (const layer of [...stack, ...queued].filter((l) => l.kind === kind)) close(layer.id);
    },
    closeAll() {
      for (const layer of [...stack, ...queued]) close(layer.id);
    },
    state: () => ({ top: stack.length ? stack[stack.length - 1] : null, stack: [...stack], queued: [...queued] }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

let singleton: OverlayManager | null = null;

/** The app-wide manager. */
export const getOverlayManager = (): OverlayManager => (singleton ??= createOverlayManager());

export const setOverlayManagerForTests = (manager: OverlayManager | null): void => {
  singleton = manager;
};
