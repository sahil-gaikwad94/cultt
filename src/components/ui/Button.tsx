"use client";

import { motion } from "motion/react";
import type { Transition } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING, useAppReduced } from "@/lib/motion";

type Variant = "flame" | "neutral" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  flame: "bg-flame text-flame-ink font-semibold glow-flame hover:brightness-[1.06]",
  neutral: "bg-panel-2 text-ink border border-hairline hover:bg-panel-3",
  ghost: "bg-transparent text-ink-dim hover:text-ink",
  outline: "bg-transparent text-ink border border-hairline hover:bg-panel-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-full gap-1.5",
  md: "h-12 px-6 text-sm rounded-full gap-2",
  lg: "h-14 px-8 text-[15.5px] rounded-full gap-2.5",
};

type NativeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onTransitionEnd"
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
>;

export function Button({
  children,
  className,
  variant = "neutral",
  size = "md",
  transition,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  transition?: Transition;
} & NativeButtonProps) {
  const reduced = useAppReduced();
  return (
    <motion.button
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={transition ?? SPRING}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame/60 disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
