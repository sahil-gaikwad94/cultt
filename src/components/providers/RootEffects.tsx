"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Boots client-only pieces after mount (so SSR HTML never mismatches):
 * rehydrates the persisted store (skipHydration: true by design) and flags
 * hydration complete so the root redirect can run.
 */
export default function RootEffects() {
  useEffect(() => {
    const boot = async () => {
      try {
        await useAppStore.persist.rehydrate();
      } finally {
        useAppStore.getState().setHydrated(true);
      }
    };
    void boot();
  }, []);
  return null;
}
