/**
 * The single gate every motion module asks before it animates.
 *
 * Why this exists rather than relying on CSS: the global `.calm` and
 * `prefers-reduced-motion` rules in app.css force `animation-duration:.001ms`,
 * which neutralises CSS *animations* and *transitions* only. The Web Animations
 * API used by the Cold Open and the micro-interactions runs on the compositor
 * and is completely unaffected by those rules — an `element.animate()` call
 * keeps playing at full speed inside `.calm` unless JavaScript checks here.
 *
 * So: every module asks `shouldAnimate()` and renders the *final frame* when it
 * is false. That is the contractual behaviour — not "no animation", but the
 * settled state the animation would have arrived at.
 */

export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Calm Mode is the product's own switch, set by the settings screen. */
export const calmMode = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('calm');

/** Motion is allowed only when neither the OS nor the product asked for calm. */
export const shouldAnimate = (): boolean => !prefersReducedMotion() && !calmMode();

/** Ambient loops must stop while the tab is hidden. Returns an unsubscriber. */
export const whileVisible = (onChange: (visible: boolean) => void): (() => void) => {
  const handler = () => onChange(!document.hidden);
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
};

/**
 * Motion tokens, mirroring the CSS custom properties appended to app.css.
 * Keeping them here as well lets JS and CSS agree on a duration without a
 * magic number in two places.
 */
export const DUR = {
  instant: 90,
  quick: 160,
  base: 240,
  slow: 380,
  page: 550,
} as const;

export const EASE = {
  /** Overshoot. Matches `--spring` in app.css. */
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  /** Sheet and page movement. */
  ease: 'cubic-bezier(.22,.61,.36,1)',
  linear: 'linear',
} as const;
