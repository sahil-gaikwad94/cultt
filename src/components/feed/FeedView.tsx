"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Lenis from "lenis";
import { getFeedBatch } from "@/lib/mockData";
import type { FeedPost } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useAppReduced } from "@/lib/motion";
import { DailyDropCard, DiscoveryCard, MemeCard, TrackCard } from "./cards";
import { CommentSheet, NearbySheet, ShareSheet } from "./sheets";
import { dailyDrop as dropPost } from "@/lib/mockData";

function Skeleton({ className }: { className?: string }) {
  return <div className={`shimmer rounded-card border border-hairline ${className ?? ""}`} />;
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-5 pt-3" aria-busy="true" aria-label="Loading feed">
      <Skeleton className="h-[320px] !rounded-[26px]" />
      <Skeleton className="h-[400px] !rounded-[26px]" />
      <div className="flex gap-4 px-2">
        <Skeleton className="h-4 w-24 !rounded-full" />
        <Skeleton className="h-4 w-32 !rounded-full" />
      </div>
    </div>
  );
}

export default function FeedView() {
  const router = useRouter();
  const reduced = useAppReduced();
  const contentRef = useRef<HTMLDivElement>(null);

  const cursor = useAppStore((s) => s.feedCursor);
  const bumpFeed = useAppStore((s) => s.bumpFeed);
  const toggleReaction = useAppStore((s) => s.toggleReaction);
  const liked = useAppStore((s) => s.likedPosts);
  const laughed = useAppStore((s) => s.laughedPosts);
  const saved = useAppStore((s) => s.savedPosts);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const [sheet, setSheet] = useState<
    { kind: "comments" | "share" | "nearby"; post: FeedPost } | null
  >(null);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  /* initial shimmer load — never a bare spinner */
  useEffect(() => {
    const t = setTimeout(() => {
      const batch = getFeedBatch(cursorRef.current, 5);
      setPosts(batch.posts);
      bumpFeed(batch.next);
      setLoading(false);
    }, 650);
    return () => clearTimeout(t);
  }, [bumpFeed]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      const batch = getFeedBatch(cursorRef.current, 4);
      setPosts((prev) => [...prev, ...batch.posts]);
      bumpFeed(batch.next);
      setLoadingMore(false);
    }, 550);
  }, [bumpFeed]);

  /* Lenis smooth scroll — wraps this feed only; disabled for reduced motion */
  useEffect(() => {
    if (reduced) return;
    const content = contentRef.current;
    const wrapper = content?.parentElement as HTMLElement | null | undefined;
    if (!content || !wrapper || wrapper.scrollHeight <= wrapper.clientHeight + 40) return;
    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: false,
      duration: 1.05,
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduced, loading]);

  /* infinite scroll sentinel */
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) loadMore();
      },
      { rootMargin: "500px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, loadingMore, loadMore, posts.length]);

  const openSheet = (kind: "comments" | "share" | "nearby", post: FeedPost) =>
    setSheet({ kind, post });

  const extra = useMemo(() => commentCounts, [commentCounts]);

  if (loading) return <FeedSkeleton />;

  return (
    <>
      <div ref={contentRef} className="flex flex-col gap-5 px-5 pb-10 pt-3">
        {/* culture ticker — editorial energy, pure transform animation */}
        <div className="marquee -mx-5 px-5" aria-hidden>
          <span className="mono-label !text-[10px] !text-ink-faint whitespace-nowrap">
            <span>TRENDING IN THE CULTURE</span>
            <span className="!text-flame">✦</span>
            <span>REGGAETON SUMMER</span>
            <span>✦</span>
            <span>GROUP CHAT MEMES</span>
            <span>✦</span>
            <span>UK GARAGE REVIVAL</span>
            <span>✦</span>
            <span>SLOW SUNDAYS</span>
            <span>✦</span>
            <span>TRENDING IN THE CULTURE</span>
            <span className="!text-flame">✦</span>
            <span>REGGAETON SUMMER</span>
            <span>✦</span>
            <span>GROUP CHAT MEMES</span>
            <span>✦</span>
            <span>UK GARAGE REVIVAL</span>
            <span>✦</span>
            <span>SLOW SUNDAYS</span>
            <span>✦</span>
          </span>
        </div>

        {/* Daily Drop — pinned once per day */}
        <DailyDropCard
          post={dropPost}
          index={0}
          playing={playingId === "drop"}
          onPlayToggle={() => setPlayingId((p) => (p === "drop" ? null : "drop"))}
        />

        {/* section divider — editorial rhythm */}
        <div className="flex items-center gap-3 pt-1">
          <span className="mono-label !text-[9.5px] text-ink-faint">fresh in the culture</span>
          <span className="h-px flex-1 bg-hairline" />
          <span className="numeral text-[12px] text-ink-faint">{posts.length}</span>
        </div>

        {posts.map((post, i) => {
          const common = {
            post,
            index: i + 1,
            liked: liked.includes(post.id),
            saved: saved.includes(post.id),
            extraComments: extra[post.id] ?? 0,
            onToggle: (k: "liked" | "laughed" | "saved") => toggleReaction(k, post.id),
            onComments: () => openSheet("comments", post),
            onShare: () => openSheet("share", post),
          };
          if (post.type === "meme") {
            return (
              <MemeCard
                key={post.id}
                {...common}
                laughed={laughed.includes(post.id)}
              />
            );
          }
          if (post.type === "track") {
            return (
              <TrackCard
                key={post.id}
                {...common}
                playing={playingId === post.id}
                onPlayToggle={() =>
                  setPlayingId((p) => (p === post.id ? null : post.id))
                }
                onNearby={() => openSheet("nearby", post)}
              />
            );
          }
          if (post.type === "discovery") {
            return (
              <DiscoveryCard
                key={post.id}
                post={post}
                index={i + 1}
                onOpenMatrix={() => router.push("/matrix")}
              />
            );
          }
          return null;
        })}

        <div ref={sentinelRef} className="h-4" />
        {loadingMore && (
          <div className="flex items-center gap-3 px-2 pb-2">
            <div className="shimmer h-9 w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="shimmer h-3 w-1/3 rounded-full" />
              <div className="shimmer h-3 w-1/2 rounded-full" />
            </div>
          </div>
        )}
        <p className="pb-2 text-center text-[11.5px] text-ink-faint">
          your fingerprint gets stronger the more you&apos;re here
        </p>
      </div>

      <CommentSheet
        post={sheet?.kind === "comments" ? sheet.post : null}
        open={sheet?.kind === "comments"}
        extra={sheet ? extra[sheet.post.id] ?? 0 : 0}
        onAdd={() =>
          sheet &&
          setCommentCounts((c) => ({ ...c, [sheet.post.id]: (c[sheet.post.id] ?? 0) + 1 }))
        }
        onClose={() => setSheet(null)}
      />
      <ShareSheet
        post={sheet?.kind === "share" ? sheet.post : null}
        open={sheet?.kind === "share"}
        onClose={() => setSheet(null)}
      />
      <NearbySheet
        post={sheet?.kind === "nearby" ? sheet.post : null}
        open={sheet?.kind === "nearby"}
        onClose={() => setSheet(null)}
        onOpenMatrix={() => router.push("/matrix")}
      />
    </>
  );
}
