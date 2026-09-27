"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Lottie from "lottie-react";
import {
  Bookmark,
  Heart,
  Laugh,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Pause,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import type { FeedPost } from "@/lib/types";
import { GRADIENTS } from "@/lib/mockData";
import { Avatar, GradientTile, MemeFace } from "@/components/ui/GradientTile";
import { Waveform } from "./Waveform";
import { Button } from "@/components/ui/Button";
import { cn, formatCount } from "@/lib/utils";
import { likePop } from "@/lib/lottie";
import { useAppReduced } from "@/lib/motion";

/* ── like-pop micro-interaction (lottie, fires once per activation) ── */
function PopLayer({ show, size = 96 }: { show: boolean; size?: number }) {
  const reduced = useAppReduced();
  if (reduced) return null;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          className="pointer-events-none absolute"
        >
          <Lottie
            animationData={likePop}
            loop={false}
            autoplay
            style={{ width: size, height: size }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── reaction row ── */
function ReactionRow({
  post,
  liked,
  laughed,
  saved,
  onToggle,
  onComments,
  onShare,
  extraComments,
}: {
  post: FeedPost;
  liked: boolean;
  laughed: boolean;
  saved: boolean;
  onToggle: (k: "liked" | "laughed" | "saved") => void;
  onComments: () => void;
  onShare: () => void;
  extraComments: number;
}) {
  return (
    <div className="flex items-center gap-1 px-1 pt-1">
      <ReactionButton
        active={laughed}
        count={post.laughCount}
        onClick={() => onToggle("laughed")}
        label="Laugh react"
        icon={<Laugh size={19} strokeWidth={1.75} />}
      />
      <ReactionButton
        active={liked}
        count={post.likeCount}
        onClick={() => onToggle("liked")}
        label="Like"
        icon={<Heart size={19} strokeWidth={1.75} />}
        pop
      />
      <ReactionButton
        active={false}
        count={post.commentCount + extraComments}
        onClick={onComments}
        label="Comments"
        icon={<MessageCircle size={19} strokeWidth={1.75} />}
      />
      <ReactionButton
        active={false}
        count={null}
        onClick={onShare}
        label="Share"
        icon={<Share2 size={19} strokeWidth={1.75} />}
      />
      <button
        onClick={() => onToggle("saved")}
        aria-label="Save"
        aria-pressed={saved}
        className={cn(
          "ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          saved ? "text-flame" : "text-ink-dim hover:text-ink"
        )}
      >
        <Bookmark size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function ReactionButton({
  icon,
  count,
  active,
  onClick,
  label,
  pop,
}: {
  icon: React.ReactNode;
  count: number | null;
  active: boolean;
  onClick: () => void;
  label: string;
  pop?: boolean;
}) {
  const [popOn, setPopOn] = useState(false);
  return (
    <button
      onClick={() => {
        if (pop && !active) {
          setPopOn(true);
          setTimeout(() => setPopOn(false), 820);
        }
        onClick();
      }}
      aria-label={label}
      aria-pressed={pop ? active : undefined}
      className={cn(
        "relative flex h-9 items-center gap-1.5 rounded-full px-2.5 transition-all",
        active ? "text-flame" : "text-ink-dim hover:text-ink"
      )}
      style={{ transform: active && pop ? "scale(1.05)" : undefined }}
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        {icon}
        {pop && <PopLayer show={popOn} />}
      </span>
      {count !== null && (
        <span className="text-[13px] font-medium tabular-nums">{formatCount(count)}</span>
      )}
    </button>
  );
}

function CardShell({
  children,
  className,
  index,
}: {
  children: React.ReactNode;
  className?: string;
  index: number;
}) {
  const reduced = useAppReduced();
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 34, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "card p-4",
        index > 2 && "cv-auto",
        className
      )}
    >
      {children}
    </motion.article>
  );
}

function AuthorRow({ post }: { post: FeedPost }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <Avatar gradient={post.authorGradient} name={post.author} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-ink">{post.author}</span>
        </div>
        <div className="flex items-center gap-1 text-[11.5px] text-ink-faint">
          <MapPin size={11} strokeWidth={2} />
          <span className="truncate">{post.location}</span>
          <span aria-hidden>·</span>
          <span>{post.timeAgo}</span>
        </div>
      </div>
      <button
        aria-label="More"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:text-ink"
      >
        <MoreHorizontal size={17} />
      </button>
    </div>
  );
}

/* ── Daily Drop: pinned once/day, accent border + slow idle glow pulse ── */
export function DailyDropCard({
  post,
  playing,
  onPlayToggle,
  index,
}: {
  post: FeedPost;
  playing: boolean;
  onPlayToggle: () => void;
  index: number;
}) {
  const reduced = useAppReduced();
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <CardShell index={index} className="relative overflow-hidden p-0 card-lift">
      <div aria-hidden className="aurora" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-card border border-flame"
        animate={reduced ? { opacity: 0.6 } : { opacity: [0.35, 0.8, 0.35] }}
        transition={reduced ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex items-center justify-between px-4 pb-2.5 pt-3.5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-flame" strokeWidth={2} />
          <span className="mono-label !text-flame !text-[11px]">✦ Daily Drop</span>
        </div>
        <span className="text-[12px] text-ink-faint">{today} · editors&apos; pick</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-3.5 pb-3.5">
        <GradientTile gradient={post.gradient} src="/art/meme-bg-1.png" className="aspect-[4/5] rounded-[16px]">
          <MemeFace top={post.memeTop} bottom={post.memeBottom} />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            Meme
          </span>
        </GradientTile>

        <div className="flex flex-col gap-2.5">
          <GradientTile gradient={GRADIENTS[3]} src="/art/drop-poster.png" className="aspect-square rounded-[16px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/25 backdrop-blur-sm">
                <Music2 size={22} className="text-white" strokeWidth={1.75} />
              </div>
            </div>
          </GradientTile>
          <div className="rounded-[16px] glass p-3.5">
            <p className="truncate text-[13.5px] font-medium text-ink">{post.trackTitle}</p>
            <p className="truncate text-[12px] text-ink-dim">{post.trackArtist}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={onPlayToggle}
                aria-label={playing ? "Pause" : "Play"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flame text-flame-ink"
              >
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <Waveform seed={7} playing={playing} height={26} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="relative border-t border-hairline px-4 py-3.5 text-[13.5px] italic leading-snug text-ink-dim">
        {post.caption}
      </p>
    </CardShell>
  );
}

/* ── Meme card ── */
export function MemeCard({
  post,
  index,
  liked,
  laughed,
  saved,
  onToggle,
  onComments,
  onShare,
  extraComments,
}: {
  post: FeedPost;
  index: number;
  liked: boolean;
  laughed: boolean;
  saved: boolean;
  onToggle: (k: "liked" | "laughed" | "saved") => void;
  onComments: () => void;
  onShare: () => void;
  extraComments: number;
}) {
  return (
    <CardShell index={index}>
      <AuthorRow post={post} />
      <GradientTile gradient={post.gradient} src="/art/meme-bg-2.png" className="aspect-[5/4] rounded-[16px]">
        <MemeFace top={post.memeTop} bottom={post.memeBottom} />
      </GradientTile>
      <p className="px-1 pb-1 pt-3 text-[14px] leading-snug text-ink-dim">{post.caption}</p>
      <ReactionRow
        post={post}
        liked={liked}
        laughed={laughed}
        saved={saved}
        onToggle={onToggle}
        onComments={onComments}
        onShare={onShare}
        extraComments={extraComments}
      />
    </CardShell>
  );
}

/* ── Track card: play toggles canvas waveform ── */
export function TrackCard({
  post,
  index,
  liked,
  saved,
  playing,
  onPlayToggle,
  onToggle,
  onComments,
  onShare,
  onNearby,
  extraComments,
}: {
  post: FeedPost;
  index: number;
  liked: boolean;
  saved: boolean;
  playing: boolean;
  onPlayToggle: () => void;
  onToggle: (k: "liked" | "laughed" | "saved") => void;
  onComments: () => void;
  onShare: () => void;
  onNearby: () => void;
  extraComments: number;
}) {
  const seed = post.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <CardShell index={index}>
      <AuthorRow post={post} />
      <div className="flex gap-3.5">
        <GradientTile gradient={post.gradient} className="h-[88px] w-[88px] shrink-0 rounded-[14px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-9 w-9 rounded-full border-2 border-white/60 bg-black/30" />
          </div>
        </GradientTile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{post.trackTitle}</p>
          <p className="truncate text-[13px] text-ink-dim">{post.trackArtist}</p>
          <div className="mt-2.5 flex items-center gap-3">
            <button
              onClick={onPlayToggle}
              aria-label={playing ? "Pause preview" : "Play preview"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
                playing
                  ? "border-flame/70 bg-flame/15 text-flame"
                  : "border-hairline bg-panel-2 text-ink"
              )}
            >
              {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <div className="min-w-0 flex-1">
              <Waveform seed={seed} playing={playing} height={36} />
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onNearby}
        className="mt-3 flex w-full items-center gap-2 rounded-[14px] border border-hairline bg-panel-2/70 px-3 py-2.5 text-left transition-colors hover:bg-panel-2"
      >
        <Users size={15} className="text-flame" strokeWidth={1.75} />
        <span className="text-[13px] text-ink-dim">
          <span className="font-semibold text-ink">{post.nearbyCount} nearby</span> vibe with this
        </span>
        <span className="ml-auto text-[12px] text-ink-faint">See who →</span>
      </button>
      <p className="px-1 pb-0.5 pt-3 text-[13.5px] leading-snug text-ink-dim">{post.caption}</p>
      <ReactionRow
        post={post}
        liked={liked}
        laughed={false}
        saved={saved}
        onToggle={onToggle}
        onComments={onComments}
        onShare={onShare}
        extraComments={extraComments}
      />
    </CardShell>
  );
}

/* ── Local discovery card: soft CTA into Matrix, never an inline swipe ── */
export function DiscoveryCard({
  post,
  index,
  onOpenMatrix,
}: {
  post: FeedPost;
  index: number;
  onOpenMatrix: () => void;
}) {
  return (
    <CardShell index={index} className="relative overflow-hidden p-0">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-flame" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-flame">
          Nearby signal
        </span>
        <span className="ml-auto text-[12px] text-ink-faint">{post.location}</span>
      </div>
      <div className="flex gap-3 px-3.5 pb-3.5">
        <GradientTile gradient={post.gradient} className="aspect-square w-[92px] shrink-0 rounded-[14px]">
          <MemeFace top={post.memeTop} />
        </GradientTile>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="text-[14.5px] leading-snug text-ink">{post.caption}</p>
          <p className="text-[12.5px] text-ink-faint">
            Their fingerprints overlap yours. Peek at the Matrix when you&apos;re ready.
          </p>
          <Button size="sm" variant="outline" className="mt-1 self-start" onClick={onOpenMatrix}>
            <Sparkles size={14} strokeWidth={2} className="text-flame" />
            Open Match Matrix
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
