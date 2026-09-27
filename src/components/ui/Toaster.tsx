"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { FADE, useAppReduced } from "@/lib/motion";

interface Toast {
  id: number;
  msg: string;
}

interface ToastState {
  toasts: Toast[];
  push: (msg: string) => void;
  remove: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (msg) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, msg }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2400);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  return useToastStore((s) => s.push);
}

export function Toaster() {
  const { toasts } = useToastStore();
  const reduced = useAppReduced();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[300] flex flex-col items-center gap-2 px-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={reduced ? { duration: 0 } : FADE}
            className={cn(
              "pointer-events-auto max-w-[86%] rounded-full border border-hairline bg-[#2b271f] px-4 py-2.5",
              "text-[13px] text-ink shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
            )}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
