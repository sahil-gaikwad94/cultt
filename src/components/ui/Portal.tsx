"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portals overlays to document.body so they sit ABOVE the shell's
 * bottom nav (the shell's route wrapper is a stacking context — z-index
 * inside it can't beat the nav's z-50 in the root context).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
