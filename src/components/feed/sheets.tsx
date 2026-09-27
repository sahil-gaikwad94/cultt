"use client";

import { useState } from "react";
import { Send, Sparkles, MapPin } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar, GradientTile } from "@/components/ui/GradientTile";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import type { FeedPost, Match } from "@/lib/types";
import { useAppStore } from "@/lib/store";

/* ── Comments sheet ── */
const MOCK_COMMENTS = [
  { id: "k1", name: "Dev", gradient: "linear-gradient(150deg, #2a9d8f 0%, #0f3d3a 100%)", text: "the slide count is sending me", time: "8m" },
  { id: "k2", name: "Priya", gradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)", text: "I have been personally targeted by this meme", time: "14m" },
  { id: "k3", name: "Jonah", gradient: "linear-gradient(160deg, #8ec5fc 0%, #2b1e66 100%)", text: "saving this for the group chat, sorry", time: "21m" },
];

export function CommentSheet({
  post,
  open,
  onClose,
  extra,
  onAdd,
}: {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
  extra: number;
  onAdd: () => void;
}) {
  const [text, setText] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const toast = useToast();

  return (
    <Sheet open={open && !!post} onClose={onClose} title={`Comments${post ? ` · ${post.commentCount + extra}` : ""}`}>
      <div className="flex flex-col gap-4 pb-2">
        {MOCK_COMMENTS.map((c) => (
          <div key={c.id} className="flex items-start gap-3">
            <Avatar gradient={c.gradient} name={c.name} size={34} />
            <div className="min-w-0 flex-1 rounded-[18px] rounded-tl-[6px] border border-hairline bg-panel-2 px-3.5 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink">{c.name}</span>
                <span className="text-[11px] text-ink-faint">{c.time}</span>
              </div>
              <p className="text-[13.5px] leading-snug text-ink-dim">{c.text}</p>
            </div>
          </div>
        ))}
        {added.map((t, i) => (
          <div key={`a${i}`} className="flex items-start gap-3">
            <Avatar gradient="linear-gradient(135deg, #ff8a5c 0%, #7a2e8e 100%)" name="Alex" size={34} />
            <div className="min-w-0 flex-1 rounded-[18px] rounded-tl-[6px] border border-flame/30 bg-flame/12 px-3.5 py-2.5 shadow-[0_8px_26px_-14px_rgba(255,107,74,0.5)]">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink">You</span>
                <span className="text-[11px] text-ink-faint">now</span>
              </div>
              <p className="text-[13.5px] leading-snug text-ink-dim">{t}</p>
            </div>
          </div>
        ))}

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-hairline bg-panel pt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                setAdded((a) => [...a, text.trim()]);
                onAdd();
                setText("");
                toast("Comment posted");
              }
            }}
            placeholder="Add to the bit…"
            className="glass h-11 flex-1 rounded-full px-4 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-flame/45"
          />
          <button
            aria-label="Send comment"
            onClick={() => {
              if (!text.trim()) return;
              setAdded((a) => [...a, text.trim()]);
              onAdd();
              setText("");
              toast("Comment posted");
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-flame text-flame-ink glow-flame"
          >
            <Send size={17} strokeWidth={2} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ── Share-with-caption composer (in-app: never watermarked) ── */
export function ShareSheet({
  post,
  open,
  onClose,
}: {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const matches = useAppStore((s) => s.matches);
  const toast = useToast();

  const send = () => {
    const who = matches.find((m) => m.id === target)?.name ?? "your Squad";
    toast(`Shared with ${who} — no watermark in-app`);
    setCaption("");
    setTarget(null);
    onClose();
  };

  return (
    <Sheet open={open && !!post} onClose={onClose} title="Share with a caption">
      {post && (
        <div className="flex flex-col gap-4 pb-1">
          <div className="flex gap-3 rounded-[16px] border border-hairline bg-panel-2 p-3">
            <GradientTile gradient={post.gradient} className="h-16 w-16 shrink-0 rounded-[12px]">
              <span className="meme-text absolute inset-0 flex items-center justify-center p-1 text-[9px]">
                {post.memeTop ?? post.trackTitle}
              </span>
            </GradientTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {post.memeTop ?? post.trackTitle}
              </p>
              <p className="truncate text-[12px] text-ink-dim">
                {post.trackArtist ?? `${post.author} · ${post.location}`}
              </p>
            </div>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Say something that makes it funnier…"
            className="resize-none rounded-[16px] border border-hairline bg-panel-2 p-3.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-flame/40 focus:outline-none"
          />

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Send to
            </p>
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              <button
                onClick={() => setTarget(target === "squad" ? null : "squad")}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${
                    target === "squad" ? "border-flame" : "border-hairline"
                  } bg-panel-2`}
                >
                  <Sparkles size={20} className="text-flame" strokeWidth={1.75} />
                </span>
                <span className="text-[11px] text-ink-dim">Squad</span>
              </button>
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTarget(target === m.id ? null : m.id)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span className={`rounded-full border-2 ${target === m.id ? "border-flame" : "border-transparent"}`}>
                    <Avatar gradient={m.gradient} name={m.name} size={54} />
                  </span>
                  <span className="truncate text-[11px] text-ink-dim">{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          <Button variant="flame" size="lg" onClick={send} disabled={!target}>
            Send it
          </Button>
          <p className="text-center text-[11.5px] text-ink-faint">
            Watermarked only if you share outside Cultured — in-app stays clean.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ── "N nearby vibe with this" — soft entry, no evaluation UI ── */
export function NearbySheet({
  post,
  open,
  onClose,
  onOpenMatrix,
}: {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
  onOpenMatrix: () => void;
}) {
  const nearby = [
    { name: "Maya", dist: "2.4 km", score: 87, gradient: "linear-gradient(135deg, #ff6b4a 0%, #2d1b4e 100%)" },
    { name: "Aisha", dist: "3.3 km", score: 84, gradient: "linear-gradient(145deg, #43cbff 0%, #9733ee 100%)" },
    { name: "Theo", dist: "4.9 km", score: 69, gradient: "linear-gradient(150deg, #5f2c82 0%, #49a09d 100%)" },
  ];
  return (
    <Sheet open={open && !!post} onClose={onClose} title={post ? `${post.nearbyCount} nearby vibe with this` : ""}>
      <div className="flex flex-col gap-3 pb-2">
        {nearby.slice(0, post?.nearbyCount ?? 3).map((n) => (
          <div key={n.name} className="flex items-center gap-3 rounded-[16px] border border-hairline bg-panel-2 p-3">
            <Avatar gradient={n.gradient} name={n.name} size={42} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{n.name}</p>
              <p className="flex items-center gap-1 text-[12px] text-ink-faint">
                <MapPin size={11} /> {n.dist} · {n.score}% taste twins
              </p>
            </div>
          </div>
        ))}
        <p className="text-[12.5px] leading-snug text-ink-faint">
          Who-liked-you never shows up in the Feed — judging happens in one place: the Matrix.
        </p>
        <Button
          variant="flame"
          size="lg"
          onClick={() => {
            onClose();
            onOpenMatrix();
          }}
        >
          Open Match Matrix
        </Button>
      </div>
    </Sheet>
  );
}
