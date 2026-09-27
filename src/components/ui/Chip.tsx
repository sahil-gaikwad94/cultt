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
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-flame/60 bg-flame/12 text-flame"
          : "border-hairline bg-panel-2/80 text-ink-dim hover:text-ink",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </Tag>
  );
}
