"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft, Headphones, Send, Smile } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { Avatar, GradientTile } from "@/components/ui/GradientTile";
import { ListeningSession } from "@/components/chat/ListeningSession";
import { cn } from "@/lib/utils";
import { useAppReduced } from "@/lib/motion";
import { sceneFor } from "@/lib/art";

const EMOJIS = ["❤️", "😂", "🔥", "👏"];
const CANNED_REPLIES = [
  "ok that's exactly what my humor vector said about you 😄",
  "wait — saying this at 11pm should be illegal",
  "strong affiliative energy. I'm into it.",
  "sending you a track that proves my point",
];

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;
  const reduced = useAppReduced();

  const match = useAppStore((s) => s.matches.find((m) => m.id === matchId));
  const markMatchRead = useAppStore((s) => s.markMatchRead);
  const sendMessage = useAppStore((s) => s.sendMessage);

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [reactTo, setReactTo] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchId) markMatchRead(matchId);
  }, [matchId, markMatchRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [match?.messages.length, typing, reduced]);

  const replies = useRef(0);

  const send = () => {
    const text = draft.trim();
    if (!text || !match) return;
    const msg: Message = {
      id: `${match.id}-${Date.now()}`,
      senderId: "me",
      text,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      reactions: [],
    };
    sendMessage(match.id, msg);
    setDraft("");

    /* presence + canned reply — makes the prototype feel alive */
    setTyping(true);
    const delay = 1400 + Math.random() * 900;
    setTimeout(() => {
      setTyping(false);
      const reply: Message = {
        id: `${match.id}-r-${Date.now()}`,
        senderId: "them",
        text: CANNED_REPLIES[replies.current++ % CANNED_REPLIES.length]!,
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        reactions: [],
      };
      sendMessage(match.id, reply);
    }, delay);
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    if (!match) return;
    const m = match.messages.find((x) => x.id === msgId);
    if (!m) return;
    const reactions = m.reactions?.includes(emoji)
      ? m.reactions.filter((r) => r !== emoji)
      : [...(m.reactions ?? []), emoji];
    /* patch through a send of a no-op? keep local-only via store message copy */
    const idx = match.messages.findIndex((x) => x.id === msgId);
    if (idx >= 0) {
      useAppStore.setState((s) => ({
        matches: s.matches.map((mm) =>
          mm.id === match.id
            ? {
                ...mm,
                messages: mm.messages.map((x, i) =>
                  i === idx ? { ...x, reactions } : x
                ),
              }
            : mm
        ),
      }));
    }
    setReactTo(null);
  };

  const ordered = useMemo(() => match?.messages ?? [], [match?.messages]);

  if (!match) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-[15px] text-ink-dim">This conversation drifted away.</p>
        <button onClick={() => router.replace("/chat")} className="text-flame text-[14px]">
          Back to chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="safe-t z-40 flex shrink-0 items-center gap-3 border-b border-hairline bg-canvas/76 px-3.5 pb-3 pt-2 backdrop-blur-2xl">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full glass text-ink"
        >
          <ChevronLeft size={19} />
        </button>
        <Avatar gradient={match.gradient} name={match.name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight text-ink">
            {match.name}, {match.age}
          </p>
          <p className="truncate text-[11.5px] text-ink-faint">
            {match.tasteScore}% twins · {match.city}
          </p>
        </div>
        <button
          onClick={() => setSessionOpen(true)}
          aria-label="Listen together"
          title="Listen together"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-flame/40 bg-flame/10 text-flame transition-colors hover:bg-flame/20"
        >
          <Headphones size={18} strokeWidth={1.75} />
        </button>
      </header>

      {/* messages */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* auto-attached meme/track that triggered the match */}
        {match.matchedOn && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-6 max-w-[300px] text-center"
          >
            <p className="mb-2.5 text-[12px] text-ink-faint">
              {match.matchedOn.kind === "meme"
                ? "you laughed at the same meme"
                : "you both vibed with this track"}
            </p>
            <div className="overflow-hidden rounded-[20px] border border-flame/40 bg-panel p-3.5 shadow-[0_10px_36px_-14px_rgba(124,92,255,0.35)]">
              <GradientTile gradient={match.matchedOn.gradient} className="aspect-[16/9] rounded-[12px]">
                <span className="meme-text absolute inset-0 flex items-center justify-center p-3 text-center text-[12px]">
                  {match.matchedOn.title}
                </span>
              </GradientTile>
              <p className="mt-2.5 text-[11.5px] text-ink-dim">{match.matchedOn.sub}</p>
            </div>
            <div className="mx-auto mt-3 h-8 w-px bg-gradient-to-b from-flame/50 to-transparent" />
          </motion.div>
        )}

        <div className="flex flex-col gap-3">
          {ordered.map((m, mi) => {
            const mine = m.senderId === "me";
            if (m.attachment) {
              return (
                <motion.div
                key={m.id}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut", delay: Math.min(mi * 0.06, 0.3) }}
                className={cn("flex", mine ? "justify-start" : "justify-start")}
              >
                  <div className="max-w-[78%] overflow-hidden rounded-[18px] border border-hairline bg-panel">
                    <GradientTile gradient={m.attachment.gradient} src={sceneFor(m.id)} className="aspect-[5/4]">
                      <span className="meme-text absolute inset-0 flex items-center justify-center p-3 text-center text-[13px]">
                        {m.attachment.title}
                      </span>
                    </GradientTile>
                    <div className="px-3.5 py-2.5">
                      <p className="text-[13.5px] leading-snug text-ink">{m.attachment.sub}</p>
                      <p className="mt-1 text-[11px] text-ink-faint">attached to this match</p>
                    </div>
                  </div>
                </motion.div>
              );
            }
            return (
              <motion.div
                key={m.id}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut", delay: Math.min(mi * 0.06, 0.3) }}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <button
                  onClick={() => setReactTo(reactTo === m.id ? null : m.id)}
                  className={cn(
                    "max-w-[78%] rounded-[18px] px-4 py-2.5 text-left text-[14.5px] leading-relaxed transition-shadow",
                    mine
                      ? "rounded-br-[6px] bg-flame text-flame-ink"
                      : "rounded-bl-[6px] rounded-[20px] border border-hairline bg-panel-2 text-ink"
                  )}
                >
                  {m.text}
                </button>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10.5px] text-ink-faint">{m.time}</span>
                  {m.reactions && m.reactions.length > 0 && (
                    <span className="rounded-full border border-hairline bg-panel-2 px-1.5 py-0.5 text-[11px]">
                      {m.reactions.join(" ")}
                    </span>
                  )}
                </div>
                {reactTo === m.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="mt-1.5 flex gap-1 rounded-full border border-hairline bg-panel px-2 py-1.5 shadow-lg"
                  >
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(m.id, e)}
                        className="px-1 text-[17px] transition-transform hover:scale-125"
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}

          {typing && (
            <div className="flex items-center gap-1.5 self-start rounded-[20px] rounded-bl-[6px] border border-hairline bg-panel-2 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                  animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="safe-b shrink-0 border-t border-hairline bg-canvas/95 px-3 pb-3 pt-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            aria-label="Emoji"
            className="flex h-11 w-10 items-center justify-center text-ink-faint hover:text-ink"
          >
            <Smile size={19} strokeWidth={1.75} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Message ${match.name}…`}
            className="glass h-11 flex-1 rounded-full px-4 text-[14.5px] text-ink placeholder:text-ink-faint focus:border-flame/45 focus:outline-none"
          />
          <button
            onClick={send}
            aria-label="Send"
            disabled={!draft.trim()}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              draft.trim()
                ? "bg-flame text-flame-ink"
                : "border border-hairline-lit bg-flame text-flame-ink glow-flame"
            )}
          >
            <Send size={17} strokeWidth={2} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-ink-faint">
          {match.matchedOn?.kind === "meme" ? "your icebreaker meme is pinned above ↑" : "first message is always free"}
        </p>
      </div>

      <ListeningSession open={sessionOpen} onClose={() => setSessionOpen(false)} match={match} />
    </div>
  );
}
