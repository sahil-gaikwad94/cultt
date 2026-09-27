"use client";

import { useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

/** Default interactive spring from the motion system spec. */
export const SPRING: Transition = { type: "spring", stiffness: 300, damping: 30 };
/** Snappier variant for small controls (toggles, chips). */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
};
/** Soft default ease for fades (200–300ms, easeOut). */
export const FADE: Transition = { duration: 0.25, ease: "easeOut" };
/** The celebration gets a longer, bouncier curve. */
export const CELEBRATE: Transition = { type: "spring", stiffness: 220, damping: 22 };

/**
 * Single source of truth for reduced-motion, wired in from the first
 * component. True → zero durations, disable parallax/3D/Lenis/GSAP.
 */
export function useAppReduced(): boolean {
  return !!useReducedMotion();
}

/** Transition helper: collapses to a 0s duration when reduced motion is set. */
export function t(reduced: boolean, normal: Transition = SPRING): Transition {
  return reduced ? { duration: 0 } : normal;
}

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
