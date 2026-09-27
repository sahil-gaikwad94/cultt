"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import BottomNav from "@/components/shell/BottomNav";
import { useAppReduced, EASE_OUT } from "@/lib/motion";
import { useAppStore } from "@/lib/store";

const TAB_ROOTS = ["/feed", "/matrix", "/chat", "/profile"];

function isDrill(path: string) {
  return !TAB_ROOTS.includes(path);
}

type NavKind = "tab" | "drill-in" | "drill-out";

interface MotionSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animate: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exit: Record<string, any>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const reduced = useAppReduced();
  const router = useRouter();

  /* first mount: no entrance drama */
  const kind: NavKind = useMemo(() => {
    const prev = prevPath.current;
    if (prev === pathname) return "tab";
    const k =
      !isDrill(prev) && isDrill(pathname)
        ? "drill-in"
        : isDrill(prev) && !isDrill(pathname)
          ? "drill-out"
          : "tab";
    prevPath.current = pathname;
    return k;
  }, [pathname]);

  /* gate: onboarding completion check happens at / */
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const hydrated = useAppStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated && !onboardingDone && isDrill(pathname)) {
      router.replace("/welcome");
    }
  }, [hydrated, onboardingDone, pathname, router]);

  const variants: Record<NavKind, MotionSet> = {
    tab: {
      initial: { opacity: 0 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0 },
    },
    "drill-in": {
      initial: { x: "100%" },
      animate: { x: 0, scale: 1, opacity: 1 },
      exit: { scale: 0.94, opacity: 0.35 },
    },
    "drill-out": {
      initial: { scale: 0.94, opacity: 0.35 },
      animate: { scale: 1, opacity: 1 },
      exit: { x: "100%" },
    },
  };

  const active: MotionSet = reduced
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0 } },
      }
    : variants[kind];

  const motionTransition =
    kind === "tab"
      ? { duration: 0.18, ease: "easeOut" as const }
      : { duration: 0.34, ease: EASE_OUT };

  return (
    <div className="fixed inset-0 flex h-[100dvh] flex-col bg-canvas">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={pathname}
            initial={reduced ? active.initial : { ...active.initial }}
            animate={active.animate}
            exit={{ ...active.exit, transition: reduced ? { duration: 0 } : motionTransition }}
            transition={reduced ? { duration: 0 } : motionTransition}
            style={{ zIndex: isDrill(pathname) ? 10 : 0 }}
            className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
