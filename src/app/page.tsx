"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAppStore } from "@/lib/store";
import { useAppReduced } from "@/lib/motion";

/** Root splash — decides onboarding vs app once the store hydrates. */
export default function Home() {
  const router = useRouter();
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const hydrated = useAppStore((s) => s.hydrated);
  const reduced = useAppReduced();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      router.replace(onboardingDone ? "/feed" : "/welcome");
      setReady(true);
    }, reduced ? 0 : 450);
    return () => clearTimeout(t);
  }, [hydrated, onboardingDone, router, reduced]);

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-canvas">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-3"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-hairline bg-panel">
          <span className="font-display text-3xl font-medium text-flame">C</span>
        </div>
        <span className="font-display text-2xl font-medium tracking-tight text-ink">
          Cultured
        </span>
        <span className="text-[13px] text-ink-faint">
          {ready ? "opening…" : "match on culture, not headshots"}
        </span>
      </motion.div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-panel-2">
        <motion.div
          className="h-full rounded-full bg-flame"
          initial={{ width: "8%" }}
          animate={{ width: "100%" }}
          transition={{ duration: reduced ? 0 : 0.8, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
