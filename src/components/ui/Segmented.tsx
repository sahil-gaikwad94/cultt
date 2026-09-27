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
        "relative flex h-10 items-center gap-1 rounded-full bg-panel-2 p-1 border border-hairline",
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
              "relative z-10 h-8 flex-1 rounded-full px-4 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-ink-faint hover:text-ink-dim"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-full bg-[#332e25] border border-hairline"
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
