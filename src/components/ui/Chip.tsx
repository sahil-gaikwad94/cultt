"use client";

import { cn } from "@/lib/utils";

/** Chips — interest / distance / shared-signal pills (ref pattern). */
export function Chip({
  children,
  className,
  onClick,
  active,
  as,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  as?: "div" | "button";
}) {
  const Tag = (as ?? (onClick ? "button" : "div")) as "button";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "inline-flex h-8.5 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[12.5px] font-medium transition-all",
        active
          ? "border-flame/55 bg-flame/14 text-flame shadow-[0_4px_18px_-6px_rgba(255,107,74,0.45)]"
          : "border-hairline bg-panel-2/70 text-ink-dim hover:text-ink hover:border-hairline-lit",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </Tag>
  );
}
