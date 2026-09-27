"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING, useAppReduced } from "@/lib/motion";
import { Portal } from "./Portal";

/**
 * Bottom sheet primitive — slides up over the shell.
 * (avoids Radix Dialog so motion + app-shell scroll play nicely)
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useAppReduced();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
        <div className="fixed inset-0 z-[250] flex flex-col justify-end">
          <motion.button
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ y: "102%" }}
            animate={{ y: 0 }}
            exit={{ y: "102%" }}
            transition={reduced ? { duration: 0 } : { ...SPRING, stiffness: 340, damping: 36 }}
            className={cn(
              "relative max-h-[86dvh] overflow-hidden rounded-t-sheet border border-hairline bg-panel pb-6 shadow-[0_-16px_60px_rgba(0,0,0,0.55)]",
              className
            )}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#3a352c]" />
            {title && (
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 border border-hairline text-ink-dim hover:text-ink"
                >
                  <X size={17} />
                </button>
              </div>
            )}
            <div className="no-scrollbar max-h-[74dvh] overflow-y-auto px-5 pt-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
      </Portal>
    );
}