"use client";

import { motion } from "motion/react";
import type { Transition } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING, useAppReduced } from "@/lib/motion";

type Variant = "flame" | "neutral" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  flame: "bg-flame text-flame-ink font-semibold hover:brightness-105",
  neutral: "bg-panel-2 text-ink hover:bg-[#2e2a22]",
  ghost: "bg-transparent text-ink-dim hover:text-ink",
  outline: "bg-transparent text-ink border border-hairline hover:bg-panel-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-full gap-1.5",
  md: "h-11 px-5 text-sm rounded-full gap-2",
  lg: "h-13 px-7 text-[15px] rounded-full gap-2",
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
