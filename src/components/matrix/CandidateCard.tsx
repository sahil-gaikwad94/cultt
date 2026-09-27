"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import {
  BadgeCheck,
  Expand,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import type { Candidate } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/utils";
import { SPRING, useAppReduced } from "@/lib/motion";

export type ExitDir = -1 | 0 | 1; // -1 pass · 1 vibe · 0 resonate

const THRESHOLD = 130;
const FLING_V = 520;

export function CandidateCard({
  candidate,
  onDecide,
  onExpand,
  onSharedChip,
  flyDir,
  top,
}: {
  candidate: Candidate;
  onDecide: (dir: ExitDir) => void;
  onExpand: () => void;
  onSharedChip: () => void;
  /** when set, the card flies out this direction (commanded by the action row / expanded view) */
  flyDir: ExitDir | null;
  top: boolean;
}) {
  const reduced = useAppReduced();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-15, 15]);
  const rotateY = useTransform(x, [-260, 260], [9, -9]); // 3D board tilt while dragging
  const passOpacity = useTransform(x, [-150, -45], [1, 0]);
  const vibeOpacity = useTransform(x, [45, 150], [0, 1]);
  const resoOpacity = useTransform(y, [-150, -45], [1, 0]);
  const exiting = useRef(false);

  const flyOut = (dir: ExitDir) => {
    exiting.current = true;
    const opts = reduced
      ? { duration: 0 }
      : { duration: 0.34, ease: "easeIn" as const };
    const done = Promise.all([
      animate(x, dir === 0 ? 0 : dir * 760, opts),
      animate(y, dir === 0 ? -820 : 0, opts),
      ...(reduced ? [] : [animate(rotate, dir === 0 ? 0 : dir * 22, opts)]),
    ]);
    done.then(() => onDecide(dir));
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (exiting.current) return;
    const vx = info.velocity.x;
    if (x.get() < -THRESHOLD || vx < -FLING_V) flyOut(-1);
    else if (x.get() > THRESHOLD || vx > FLING_V) flyOut(1);
    else animate(x, 0, reduced ? { duration: 0 } : SPRING);
  };

  /* commanded fly-out (action row / expanded fingerprint) */
  useEffect(() => {
    if (flyDir !== null && !exiting.current) flyOut(flyDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyDir]);

  return (
    <motion.div
      drag={top ? "x" : false}
      dragElastic={0.7}
      dragMomentum={false}
      style={{ x, y: top ? y : 0, rotate: top ? rotate : 0, rotateY: top && !reduced ? rotateY : 0 }}
      onDragEnd={handleDragEnd}
      animate={undefined}
      initial={false}
      className="absolute inset-0 flex touch-pan-y flex-col overflow-hidden rounded-[26px] border border-hairline-lit bg-panel p-3.5 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.85)] will-change-transform"
    >
      {/* photo area — placeholder gradient tile (photos never gate the score) */}
      <div className="relative flex-1 min-h-0">
        {/* morph target: shared layoutId between card ↔ expanded fingerprint */}
        <motion.div
          layoutId={`photo-${candidate.id}`}
          className="absolute inset-0 overflow-hidden rounded-[18px]"
          style={{ background: candidate.photoGradient }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.5px)",
              backgroundSize: "7px 7px",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.18), transparent 55%)",
            }}
          />
        </motion.div>

        {/* legibility scrim inside the photo composition */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-[18px] bg-gradient-to-t from-black/80 via-black/45 to-transparent"
        />

        {/* name/age over photo — ref composition */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[32px] font-medium leading-none tracking-[-0.02em] text-white text-sheet">
              {candidate.name}, {candidate.age}
            </h2>
            {candidate.verified && (
              <BadgeCheck size={20} className="text-flame" strokeWidth={2} aria-label="Verified" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-black/45 px-2.5 text-[11.5px] font-medium text-white backdrop-blur-sm">
              <MapPin size={11} strokeWidth={2.2} />
              {candidate.distanceKm} km · {candidate.city.split(",")[0]}
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-black/45 px-2.5 text-[11.5px] text-white/85 backdrop-blur-sm">
              looking to {candidate.lookingFor === "dating" ? "date" : "vibe"}
            </span>
          </div>
        </div>

        {/* Taste Twins badge — the hook, top corner, before any decision */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/50 px-3.5 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <Sparkles size={13} className="text-flame" strokeWidth={2} />
          <span className="text-[12.5px] font-semibold text-white">
            {candidate.tasteScore}% taste twins
          </span>
        </div>

        {/* expand affordance → full fingerprint (layoutId morph) */}
        <button
          onClick={onExpand}
          aria-label="Expand full fingerprint"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition-transform hover:scale-105"
        >
          <Expand size={16} strokeWidth={2} />
        </button>

        {/* decision stamps */}
        <motion.div
          style={{ opacity: top ? passOpacity : 0 }}
          className="absolute left-5 top-16 -rotate-12 rounded-[12px] border-[3px] border-ink-faint bg-black/40 px-3 py-1 backdrop-blur-sm"
        >
          <span className="text-[22px] font-black uppercase tracking-widest text-ink-faint">
            pass
          </span>
        </motion.div>
        <motion.div
          style={{ opacity: top ? vibeOpacity : 0 }}
          className="absolute right-5 top-16 rotate-12 rounded-[12px] border-[3px] border-flame bg-black/40 px-3 py-1 backdrop-blur-sm"
        >
          <span className="text-[22px] font-black uppercase tracking-widest text-flame">
            vibe
          </span>
        </motion.div>
        <motion.div
          style={{ opacity: top ? resoOpacity : 0 }}
          className="absolute left-1/2 top-14 -translate-x-1/2 rounded-[12px] border-[3px] border-flame bg-black/40 px-3 py-1 backdrop-blur-sm"
        >
          <span className="text-[18px] font-black uppercase tracking-widest text-flame">
            resonate
          </span>
        </motion.div>
      </div>

      {/* shared signals + expand hint — built-in icebreaker hooks */}
      <div className="mt-3 flex items-center gap-2">
        <Chip
          onClick={onSharedChip}
          className={cn("hover:border-flame/40", "border-flame/35 bg-flame/8 text-flame")}
        >
          ♫ {candidate.sharedArtist}
        </Chip>
        <Chip
          onClick={onSharedChip}
          className="border-flame/35 bg-flame/8 text-flame"
        >
          😂 {candidate.sharedMemeCategory}
        </Chip>
        <button
          onClick={onExpand}
          className="ml-auto shrink-0 text-[12px] text-ink-faint transition-colors hover:text-ink"
        >
          full fingerprint ↗
        </button>
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-[13px] leading-snug text-ink-dim">
        {candidate.blurb}
      </p>
    </motion.div>
  );
}

/** Floating action cluster under the stack (ref-1 pattern). */
export function MatrixActions({
  onPass,
  onLike,
  onResonate,
  onRewind,
  canRewind,
  canResonate,
  resonatesLeft,
}: {
  onPass: () => void;
  onLike: () => void;
  onResonate: () => void;
  onRewind: () => void;
  canRewind: boolean;
  canResonate: boolean;
  resonatesLeft: number;
}) {
  const reduced = useAppReduced();
  const btn =
    "flex items-center justify-center rounded-full border border-hairline-lit bg-panel-2/90 shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-colors hover:bg-panel-3";

  return (
    <div className="mx-auto flex w-fit items-center justify-center gap-3 rounded-full glass px-4 py-2.5">
      <motion.button
        whileTap={reduced ? undefined : { scale: 0.9 }}
        onClick={onRewind}
        disabled={!canRewind}
        aria-label="Rewind last pass"
        className={cn(btn, "h-11 w-11 text-ink-dim hover:text-ink disabled:opacity-35")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </motion.button>

      <motion.button
        whileTap={reduced ? undefined : { scale: 0.9 }}
        onClick={onPass}
        aria-label="Pass"
        className={cn(btn, "h-14 w-14 text-ink")}
      >
        <X size={26} strokeWidth={2.2} />
      </motion.button>

      <motion.button
        whileTap={reduced ? undefined : { scale: 0.9 }}
        onClick={onLike}
        aria-label="Vibe"
        className={cn(btn, "h-14 w-14 text-ink")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </motion.button>

      <motion.button
        whileTap={reduced ? undefined : { scale: 0.9 }}
        onClick={onResonate}
        disabled={!canResonate}
        aria-label={`Resonate — ${resonatesLeft} left today`}
        className={cn(
          btn,
          "relative h-16 w-16 border-flame/70 bg-flame text-flame-ink disabled:opacity-35"
        )}
      >
        <Sparkles size={24} strokeWidth={2} />
        <span className="absolute -top-2 rounded-full border border-flame/50 bg-canvas px-1.5 py-px text-[10px] font-bold text-flame">
          {resonatesLeft}
        </span>
      </motion.button>
    </div>
  );
}
