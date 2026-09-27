"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "group relative h-[30px] w-[52px] shrink-0 rounded-full border border-hairline bg-panel-2 transition-colors",
        "data-[state=checked]:bg-flame data-[state=checked]:border-flame/70",
        "disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
    >
      <SwitchPrimitive.Thumb className="block h-[24px] w-[24px] translate-x-[2px] rounded-full bg-[#f5f1ea] shadow-md transition-transform will-change-transform data-[state=checked]:translate-x-[24px]" />
    </SwitchPrimitive.Root>
  );
}
