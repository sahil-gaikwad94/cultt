"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY, useAppReduced } from "@/lib/motion";

/** Segmented control — the Dating/Friends dual-mode toggle (and friends). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  id: string;
  className?: string;
}) {
  const reduced = useAppReduced();
  return (
    <div
      role="tablist"
      className={cn(
        "relative flex h-11 items-center gap-1 rounded-full p-1 glass",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 h-9 flex-1 rounded-full px-4 text-[13.5px] font-semibold tracking-tight transition-colors",
              active ? "text-ink" : "text-ink-faint hover:text-ink-dim"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-full bg-panel-3 border border-hairline-lit shadow-[0_6px_18px_-8px_rgba(0,0,0,0.7)]"
                transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
