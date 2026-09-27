"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  label,
}: {
  value: number[];
  onValueChange: (v: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  label?: string;
}) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-panel-2 border border-hairline">
        <SliderPrimitive.Range className="absolute h-full bg-flame" />
      </SliderPrimitive.Track>
      {value.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-5 w-5 rounded-full border-2 border-flame bg-canvas shadow-[0_2px_8px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/40"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
