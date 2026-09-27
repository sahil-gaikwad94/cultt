"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import type { Candidate } from "@/lib/types";
import { Avatar } from "@/components/ui/GradientTile";
import { Button } from "@/components/ui/Button";
import { celebrationBurst } from "@/lib/lottie";
import { CELEBRATE, useAppReduced, t } from "@/lib/motion";
import { Portal } from "@/components/ui/Portal";

/**
 * THE signature motion moment — full-screen celebration.
 * Both avatars slide together from opposite edges, orbit the Taste Twins
 * score while it counts up, Lottie burst in accent, scale-pulse on
 * “It's a resonance.” Most of the animation budget lives here.
 */
export function MatchCelebration({
  candidate,
  matchId,
  onKeepSwiping,
}: {
  candidate: Candidate;
  matchId: string | null;
  onKeepSwiping: () => void;
}) {
  const router = useRouter();
  const reduced = useAppReduced();
  const [phase, setPhase] = useState<"slide" | "orbit" | "settle">(
    reduced ? "settle" : "slide"
  );
  const [count, setCount] = useState(reduced ? candidate.tasteScore : 0);
  const [showFinal, setShowFinal] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setPhase("settle");
      setCount(candidate.tasteScore);
      setShowFinal(true);
      return;
    }
    setPhase("slide");
    setCount(0);
    setShowFinal(false);
    const t1 = setTimeout(() => setPhase("orbit"), 620);
    const t2 = setTimeout(() => {
      setPhase("settle");
      setShowFinal(true);
    }, 2150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [candidate.id, candidate.tasteScore, reduced]);

  /* score count-up, runs during orbit */
  useEffect(() => {
    if (reduced || phase !== "orbit") return;
    const target = candidate.tasteScore;
    const dur = 1350;
    let start: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      start ??= ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, candidate.tasteScore, reduced]);

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={t(reduced, { duration: 0.28, ease: "easeOut" })}
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center gap-8 overflow-hidden bg-[#0d0b08]/94 px-6 backdrop-blur-xl"
    >
      {/* ambient heat behind the stage */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img
          src="/art/celebration-art.png"
          alt=""
          className="h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-canvas/45" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora" />
        <div className="absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame/25 blur-[90px]" />
      </div>

      {/* stage: avatars orbit around the score */}
      <div className="relative h-[280px] w-full max-w-[380px]">
        {/* accent particle burst */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Lottie
              animationData={celebrationBurst}
              loop={false}
              autoplay
              style={{ width: 320, height: 320, opacity: 0.9 }}
            />
          </div>
        )}

        {/* orbit container — rotates around center while score counts */}
        <motion.div
          className="absolute inset-0"
          animate={
            reduced
              ? { rotate: 0 }
              : phase === "slide"
                ? { rotate: 0 }
                : { rotate: phase === "orbit" ? 360 : 360 }
          }
          transition={reduced ? { duration: 0 } : { duration: 1.4, ease: "easeInOut" }}
        >
          {/* avatar A — enters from left edge */}
          <div className="absolute left-1/2 top-1/2 -ml-[38px] -mt-[38px]">
            <motion.div
              initial={reduced ? false : { x: "-58vw" }}
              animate={{ x: phase === "settle" ? -112 : -104 }}
              transition={reduced ? { duration: 0 } : CELEBRATE}
            >
              <motion.div
                animate={{ rotate: phase === "slide" ? 0 : -360 }}
                transition={reduced ? { duration: 0 } : { duration: 1.4, ease: "easeInOut" }}
              >
                <div className="rounded-full border-[3px] border-flame shadow-[0_0_40px_rgba(124,92,255,0.35)]">
                  <Avatar gradient={candidate.photoGradient} name={candidate.name} size={72} />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* avatar B — enters from right edge */}
          <div className="absolute left-1/2 top-1/2 -ml-[38px] -mt-[38px]">
            <motion.div
              initial={reduced ? false : { x: "58vw" }}
              animate={{ x: phase === "settle" ? 112 : 104 }}
              transition={reduced ? { duration: 0 } : CELEBRATE}
            >
              <motion.div
                animate={{ rotate: phase === "slide" ? 0 : 360 }}
                transition={reduced ? { duration: 0 } : { duration: 1.4, ease: "easeInOut" }}
              >
                <div className="rounded-full border-[3px] border-[#f5f1ea] shadow-[0_0_40px_rgba(245,241,234,0.25)]">
                  <Avatar
                    gradient="linear-gradient(135deg, #7c5cff 0%, #a855f7 48%, #1e1b4b 100%)"
                    name="Alex"
                    size={72}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* the score — stays upright, dead center, on top */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div aria-hidden className="absolute h-44 w-44 rounded-full border border-flame/25 shadow-[0_0_60px_rgba(124,92,255,0.22)]" />
          <motion.span
            initial={{ scale: 0.55, opacity: 0 }}
            animate={
              showFinal && !reduced
                ? { scale: [1, 1.16, 1], opacity: 1 }
                : { scale: 1, opacity: 1 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { scale: { duration: 0.5, delay: 0.05, ease: "easeOut" }, default: { duration: 0.3 } }
            }
            className="font-display text-[76px] font-medium leading-none tracking-[-0.03em] text-ink text-sheet tabular-nums"
          >
            {count}
            <span className="text-flame">%</span>
          </motion.span>
          <span className="mono-label mt-2.5 !text-[10.5px] !tracking-[0.34em] text-ink-dim">
            taste twins
          </span>
        </div>
      </div>

      {/* final copy + actions */}
      <div className="flex flex-col items-center gap-5">
        <AnimatePresence>
          {showFinal && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <h2 className="font-display text-[34px] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
                It&apos;s a resonance.
              </h2>
              <p className="max-w-[290px] text-[14.5px] leading-relaxed text-ink-dim">
                You and {candidate.name} laughed at the same {candidate.sharedMemeCategory} bit
                and share {candidate.sharedArtist}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={showFinal ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={reduced ? { duration: 0 } : { duration: 0.35, delay: 0.15, ease: "easeOut" }}
          className="flex w-full max-w-[300px] flex-col gap-2.5"
        >
          <Button
            variant="flame"
            size="lg"
            className="w-full"
            onClick={() => {
              if (matchId) router.push(`/chat/${matchId}`);
              else onKeepSwiping();
            }}
          >
            Say hi — the meme&apos;s already attached
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={onKeepSwiping}>
            Keep swiping
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
    </Portal>
  );
}