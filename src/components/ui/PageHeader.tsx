"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING, useAppReduced } from "@/lib/motion";

/** Shared drill-in header: back chevron + Fraunces title (ref 2 pattern). */
export function PageHeader({
  title,
  right,
  className,
  onBack,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const reduced = useAppReduced();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
      className={cn(
        "safe-t sticky top-0 z-40 flex items-center gap-3 px-5 pb-3.5 pt-2 backdrop-blur-2xl",
        "bg-canvas/72 border-b border-hairline",
        className
      )}
    >
      <button
        onClick={() => (onBack ? onBack() : router.back())}
        aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full glass text-ink transition-colors hover:bg-panel-3"
      >
        <ChevronLeft size={20} strokeWidth={2} />
      </button>
      <h1 className="font-display text-[21px] font-medium tracking-[-0.02em] text-ink flex-1 truncate">
        {title}
      </h1>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </motion.div>
  );
}
