"use client";

import { useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Heart, Pause, Play, SkipForward, X } from "lucide-react";
import { memeCalibration, musicCalibration } from "@/lib/mockData";
import { GradientTile, MemeFace } from "@/components/ui/GradientTile";
import { Waveform } from "@/components/feed/Waveform";
import { useToast } from "@/components/ui/Toaster";
import { SPRING, useAppReduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* ── shared swipe-stack physics ── */
function SwipeItem({
  children,
  onDecide,
  zIndex,
  behind,
}: {
  children: React.ReactNode;
  onDecide: (dir: 1 | -1) => void;
  zIndex: number;
  behind: boolean;
}) {
  const reduced = useAppReduced();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const likeOp = useTransform(x, [40, 130], [0, 1]);
  const skipOp = useTransform(x, [-130, -40], [1, 0]);
  const exited = useRef(false);

  const fly = (dir: 1 | -1) => {
    if (exited.current) return;
    exited.current = true;
    animate(x, dir * 640, reduced ? { duration: 0 } : { duration: 0.3, ease: "easeIn" }).then(() =>
      onDecide(dir)
    );
  };

  return (
    <motion.div
      drag={!behind}
      dragElastic={0.65}
      dragMomentum={false}
      style={{ x, rotate: behind ? 0 : rotate }}
      onDragEnd={(_, info: PanInfo) => {
        if (behind) return;
        if (x.get() > 110 || info.velocity.x > 500) fly(1);
        else if (x.get() < -110 || info.velocity.x < -500) fly(-1);
        else animate(x, 0, reduced ? { duration: 0 } : SPRING);
      }}
      initial={behind ? { scale: 0.94, y: 14, opacity: 0.7 } : false}
      animate={behind ? { scale: 0.94, y: 14, opacity: 0.7 } : { scale: 1, y: 0, opacity: 1 }}
      className={cn(
        "absolute inset-0 touch-pan-y",
        behind ? "pointer-events-none" : ""
      )}
    >
      <div className="relative h-full w-full" style={{ zIndex }}>
        {children}
        {!behind && (
          <>
            <motion.div
              style={{ opacity: likeOp }}
              className="absolute left-5 top-6 -rotate-12 rounded-[10px] border-[3px] border-flame px-3 py-1"
            >
              <span className="text-[20px] font-black uppercase tracking-widest text-flame">
                vibe
              </span>
            </motion.div>
            <motion.div
              style={{ opacity: skipOp }}
              className="absolute right-5 top-6 rotate-12 rounded-[10px] border-[3px] border-ink-faint px-3 py-1"
            >
              <span className="text-[20px] font-black uppercase tracking-widest text-ink-faint">
                skip
              </span>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── meme calibration: 8 cards, flat gradient placeholders ── */
export function MemeCalibration({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const toast = useToast();
  const total = memeCalibration.length;

  const decide = (dir: 1 | -1) => {
    if (dir === 1) toast("Humor vector nudged toward absurdist");
    if (index + 1 >= total) onDone();
    else setIndex((i) => i + 1);
  };

  const current = memeCalibration[Math.min(index, total - 1)]!;
  const next = memeCalibration[index + 1];

  return (
    <div className="flex h-full flex-col px-6">
      <CalibProgress done={index} total={total} label="Meme calibration" />
      <div className="relative min-h-0 flex-1">
        {next && (
          <div className="absolute inset-x-2 bottom-0 top-6 rounded-[22px] border border-hairline bg-panel opacity-70" />
        )}
        <div className="absolute inset-x-0 bottom-2 top-0" key={current.id}>
          <SwipeItem onDecide={decide} zIndex={2} behind={false}>
            <div className="relative h-full overflow-hidden rounded-[22px] border border-hairline bg-panel p-3.5">
              <GradientTile gradient={current.gradient} className="h-full rounded-[16px]">
                <MemeFace top={current.top} bottom={current.bottom} />
              </GradientTile>
            </div>
          </SwipeItem>
        </div>
      </div>
      <CalibActions
        onLike={() => decide(1)}
        onSkip={() => decide(-1)}
        hint="drag or tap — this seeds your humor vector"
      />
    </div>
  );
}

/* ── music calibration: 6 short track cards, same swipe pattern ── */
export function MusicCalibration({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const toast = useToast();
  const total = musicCalibration.length;

  const decide = (dir: 1 | -1) => {
    if (dir === 1) toast("Music vector gained a genre tag");
    setPlaying(null);
    if (index + 1 >= total) onDone();
    else setIndex((i) => i + 1);
  };

  const current = musicCalibration[Math.min(index, total - 1)]!;

  return (
    <div className="flex h-full flex-col px-6">
      <CalibProgress done={index} total={total} label="Music calibration · 7s previews" />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-2 bottom-0 top-6 rounded-[22px] border border-hairline bg-panel opacity-70" />
        <div className="absolute inset-x-0 bottom-2 top-0" key={current.id}>
          <SwipeItem onDecide={decide} zIndex={2} behind={false}>
            <div className="flex h-full flex-col rounded-[22px] border border-hairline bg-panel p-3.5">
              <GradientTile gradient={current.gradient} className="relative aspect-[4/3] rounded-[16px]">
                <button
                  aria-label={playing === current.id ? "Pause" : "Play preview"}
                  onClick={() => setPlaying((p) => (p === current.id ? null : current.id))}
                  className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-md"
                >
                  {playing === current.id ? (
                    <Pause size={19} fill="currentColor" />
                  ) : (
                    <Play size={19} fill="currentColor" />
                  )}
                </button>
                <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  7s clip
                </span>
              </GradientTile>
              <div className="mt-3.5 flex-1">
                <p className="text-[17px] font-medium leading-tight text-ink">{current.title}</p>
                <p className="text-[13.5px] text-ink-dim">{current.artist}</p>
                <div className="mt-3">
                  <Waveform seed={index * 17 + 3} playing={playing === current.id} height={44} />
                </div>
                <p className="mt-2 text-[12px] text-ink-faint">
                  tags this as <span className="text-flame">{current.vibe}</span>
                </p>
              </div>
            </div>
          </SwipeItem>
        </div>
      </div>
      <CalibActions
        onLike={() => decide(1)}
        onSkip={() => decide(-1)}
        hint="like the ones you'd queue twice"
      />
    </div>
  );
}

function CalibProgress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="pb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          {label}
        </span>
        <span className="text-[12px] tabular-nums text-ink-faint">
          {Math.min(done + 1, total)}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2 border border-hairline">
        <motion.div
          className="h-full rounded-full bg-flame"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
}

function CalibActions({
  onLike,
  onSkip,
  hint,
}: {
  onLike: () => void;
  onSkip: () => void;
  hint: string;
}) {
  const reduced = useAppReduced();
  return (
    <div className="shrink-0 pt-5">
      <div className="mb-3 flex items-center justify-center gap-5">
        <motion.button
          whileTap={reduced ? undefined : { scale: 0.9 }}
          onClick={onSkip}
          aria-label="Skip"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-panel-2 text-ink"
        >
          <X size={22} strokeWidth={2.2} />
        </motion.button>
        <motion.button
          whileTap={reduced ? undefined : { scale: 0.9 }}
          onClick={onLike}
          aria-label="Like"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-flame text-flame-ink shadow-[0_10px_30px_rgba(255,107,74,0.3)]"
        >
          <Heart size={24} strokeWidth={2} />
        </motion.button>
        <motion.button
          whileTap={reduced ? undefined : { scale: 0.9 }}
          onClick={onSkip}
          aria-label="Next"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-panel-2 text-ink-dim"
        >
          <SkipForward size={20} strokeWidth={2} />
        </motion.button>
      </div>
      <p className="text-center text-[11.5px] text-ink-faint">{hint}</p>
    </div>
  );
}
