"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Sparkles } from "lucide-react";
import {
  candidates as allCandidates,
} from "@/lib/mockData";
import type { Candidate } from "@/lib/types";
import { queueFor, useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/Toaster";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { CandidateCard, MatrixActions, type ExitDir } from "./CandidateCard";
import { ExpandedFingerprint } from "./ExpandedFingerprint";
import { MatchCelebration } from "./MatchCelebration";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/GradientTile";
import { useAppReduced, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export default function MatrixView() {
  const router = useRouter();
  const toast = useToast();
  const reduced = useAppReduced();

  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const passedIds = useAppStore((s) => s.passedIds);
  const likedIds = useAppStore((s) => s.likedIds);
  const resonatedIds = useAppStore((s) => s.resonatedIds);
  const matches = useAppStore((s) => s.matches);
  const rewindsLeft = useAppStore((s) => s.rewindsLeft);
  const resonatesLeft = useAppStore((s) => s.resonatesLeft);
  const passCandidate = useAppStore((s) => s.passCandidate);
  const likeCandidate = useAppStore((s) => s.likeCandidate);
  const resonateCandidate = useAppStore((s) => s.resonateCandidate);
  const rewindLastPass = useAppStore((s) => s.rewindLastPass);
  const addMatch = useAppStore((s) => s.addMatch);

  const queue = useMemo(
    () => queueFor({ passedIds, likedIds, resonatedIds, mode, matches }),
    [passedIds, likedIds, resonatedIds, mode, matches]
  );

  const [fly, setFly] = useState<{ id: string; dir: ExitDir } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [celebration, setCelebration] = useState<{
    candidate: Candidate;
    matchId: string | null;
  } | null>(null);
  const [sharedSheet, setSharedSheet] = useState<"artist" | "meme" | null>(null);

  const top = queue[0];
  const expandedCandidate = expanded && top ? top : null;

  const requestDecide = (dir: ExitDir) => {
    if (!top || fly || celebration) return;
    if (dir === 0 && resonatesLeft <= 0) {
      toast("No resonates left today — tomorrow's queue is stacked");
      return;
    }
    setExpanded(false);
    setFly({ id: top.id, dir });
  };

  const handleDecided = (dir: ExitDir) => {
    const c = queue[0];
    setFly(null);
    if (!c) return;
    if (dir === -1) passCandidate(c.id);
    else if (dir === 1) likeCandidate(c.id);
    else resonateCandidate(c.id);

    const isMatch = (dir === 1 || dir === 0) && c.mutual;
    if (isMatch) {
      const matchId = addMatch(c);
      setCelebration({ candidate: c, matchId });
    } else {
      toast(
        dir === -1
          ? `Passed on ${c.name} — vector updated`
          : dir === 1
            ? `Vibed with ${c.name} — we'll tell you if it's mutual`
            : `Resonated with ${c.name} — waiting on theirs`
      );
    }
  };

  const handleRewind = () => {
    const restored = rewindLastPass();
    toast(restored ? "Last pass rewound" : "Nothing to rewind yet");
  };

  const canRewind = rewindsLeft > 0 && passedIds.length > 0;
  const canResonate = resonatesLeft > 0;

  /* shared-sub-list (enhanced discovery): any signal → its own entry point */
  const sharedPool = top
    ? allCandidates.filter(
        (c) =>
          c.id !== top.id &&
          (c.sharedArtist === top.sharedArtist ||
            c.sharedMemeCategory === top.sharedMemeCategory)
      )
    : [];
  const sharedTitle =
    sharedSheet === "artist" && top
      ? `${12} local singles who also love ${top.sharedArtist}`
      : top
        ? `12 local singles who also laugh at ${top.sharedMemeCategory}`
        : "";

  return (
    <div className="flex h-full flex-col">
      {/* header — dual-mode toggle persistent at top */}
      <header className="safe-t shrink-0 px-5 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <motion.span
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="mono-label !text-[9.5px] text-ink-faint"
            >
              decide together
            </motion.span>
            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.07, ease: "easeOut" }}
              className="display-lg mt-1 text-ink"
            >
              Match Matrix
            </motion.h1>
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
              className="mono-label mt-1.5 !text-[9.5px] !tracking-[0.1em] whitespace-nowrap text-ink-faint"
            >
              {queue.length} in queue · <span className="text-flame">{resonatesLeft} res</span> · {rewindsLeft} rewinds
            </motion.p>
          </div>
          <Segmented
            id="matrix-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "dating", label: "Dating" },
              { value: "friends", label: "Friends" },
            ]}
          />
        </div>
      </header>

      {/* stack */}
      <div className="relative min-h-0 flex-1 px-4">
        {queue.length === 0 ? (
          <EmptyState onRewind={handleRewind} canRewind={canRewind} />
        ) : (
          <div className="stage-3d absolute inset-x-4 bottom-1 top-1">
            {/* peeking cards behind */}
            {queue.slice(1, 3).map((c, i) => (
              <div
                key={c.id}
                className="absolute inset-0"
                style={{
                  zIndex: 10 - i,
                  transform: `translateY(${12 * (i + 1)}px) scale(${1 - (i + 1) * 0.045}) rotate(${i % 2 === 0 ? 1.4 : -1.4}deg)`,
                  opacity: 1 - i * 0.25,
                  pointerEvents: "none",
                }}
              >
                <div className="h-full w-full rounded-[26px] border border-hairline-lit bg-panel shadow-[0_16px_44px_rgba(0,0,0,0.55)]" />
              </div>
            ))}

            {/* top card */}
            <div key={top.id} className="absolute inset-0 z-20">
              <div aria-hidden className="aurora" />
              <CandidateCard
                candidate={top}
                top={!fly}
                flyDir={fly?.id === top.id ? fly.dir : null}
                onDecide={handleDecided}
                onExpand={() => setExpanded(true)}
                onSharedChip={() => setSharedSheet("artist")}
              />
            </div>
          </div>
        )}
      </div>

      {/* hint + actions */}
      {queue.length > 0 && (
        <div className="shrink-0 px-4 pb-3 pt-3">
          <p className="mb-2.5 text-center text-[11.5px] text-ink-faint">
            drag to decide · tap the photo for the full fingerprint
          </p>
          <MatrixActions
            onPass={() => requestDecide(-1)}
            onLike={() => requestDecide(1)}
            onResonate={() => requestDecide(0)}
            onRewind={handleRewind}
            canRewind={canRewind}
            canResonate={canResonate}
            resonatesLeft={resonatesLeft}
          />
        </div>
      )}

      {/* full fingerprint — photo morphs via layoutId */}
      <AnimatePresence>
        {expandedCandidate && (
          <ExpandedFingerprint
            candidate={expandedCandidate}
            onClose={() => setExpanded(false)}
            onPass={() => requestDecide(-1)}
            onLike={() => requestDecide(1)}
            onResonate={() => requestDecide(0)}
            onSharedChip={() => setSharedSheet("meme")}
            canResonate={canResonate}
            resonatesLeft={resonatesLeft}
          />
        )}
      </AnimatePresence>

      {/* shared-signal sub-list */}
      <Sheet
        open={sharedSheet !== null}
        onClose={() => setSharedSheet(null)}
        title={sharedTitle}
      >
        <div className="flex flex-col gap-3 pb-2">
          {sharedPool.length === 0 && (
            <p className="text-[13.5px] text-ink-dim">
              A few more are coming — your vectors are still finding each other.
            </p>
          )}
          {sharedPool.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-[16px] border border-hairline bg-panel-2 p-3"
            >
              <Avatar gradient={c.photoGradient} name={c.name} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">
                  {c.name}, {c.age}
                </p>
                <p className="text-[12px] text-ink-faint">
                  {c.distanceKm} km · {c.tasteScore}% taste twins ·{" "}
                  {sharedSheet === "artist" ? c.sharedArtist : c.sharedMemeCategory}
                </p>
              </div>
            </div>
          ))}
          <p className="text-[12.5px] leading-snug text-ink-faint">
            No separate swipe pile here — these signals fold straight into your
            Matrix queue as the fingerprint learns.
          </p>
          <Button variant="outline" onClick={() => setSharedSheet(null)}>
            Got it
          </Button>
        </div>
      </Sheet>

      {/* THE celebration */}
      <AnimatePresence>
        {celebration && (
          <MatchCelebration
            candidate={celebration.candidate}
            matchId={celebration.matchId}
            onKeepSwiping={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({
  onRewind,
  canRewind,
}: {
  onRewind: () => void;
  canRewind: boolean;
}) {
  const router = useRouter();
  const reduced = useAppReduced();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="absolute inset-x-4 inset-y-1 flex flex-col items-center justify-center gap-5 overflow-hidden rounded-[26px] border border-hairline card px-7 text-center"
    >
      <img
        src="/art/empty-queue.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div aria-hidden className="absolute inset-0 bg-canvas/55" />
      <div aria-hidden className="aurora" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-flame/40 bg-flame/10 glow-flame">
        <Flame size={28} className="text-flame" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="display-lg text-ink">
          Queue&apos;s clear
        </h2>
        <p className="mx-auto mt-2 max-w-[270px] text-[14px] leading-relaxed text-ink-dim">
          Your fingerprint gets stronger the more you&apos;re there — go vibe with
          some memes and tracks, then swing back.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <Button variant="flame" size="lg" onClick={() => router.push("/feed")}>
          Hit the Culture Feed
        </Button>
        {canRewind && (
          <Button variant="ghost" onClick={onRewind}>
            <Sparkles size={14} className="text-flame" strokeWidth={2} />
            Rewind the last pass
          </Button>
        )}
      </div>
    </motion.div>
  );
}
