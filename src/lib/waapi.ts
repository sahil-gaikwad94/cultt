/**
 * One guarded entry point to the Web Animations API.
 *
 * `Element.animate` is everywhere in the browsers cultured ships to, but it is
 * absent in jsdom and in the odd embedded webview — and an unguarded call
 * throws, taking the interaction down with it. Motion is decoration: when the
 * API is missing the element simply lands in its final state.
 *
 * Every call site in `src/v5/` goes through here so that rule holds in one
 * place, and so the tests can drive the screens without stubbing WAAPI.
 */

export interface AnimationLike {
  /** Resolves when the animation ends — immediately when WAAPI is absent. */
  finished: Promise<unknown>;
  cancel(): void;
}

type AnimateCapable = Element & {
  animate?: (keyframes: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions) => Animation;
};

const NO_ANIMATION: AnimationLike = {
  finished: Promise.resolve(),
  cancel() {
    /* nothing was started */
  },
};

export const animate = (
  target: Element | null | undefined,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options?: number | KeyframeAnimationOptions,
): AnimationLike => {
  const node = target as AnimateCapable | null | undefined;
  if (!node || typeof node.animate !== 'function') return NO_ANIMATION;
  return node.animate(keyframes, options) as AnimationLike;
};
