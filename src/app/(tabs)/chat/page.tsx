"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music2, Search, Smile } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Avatar } from "@/components/ui/GradientTile";
import { cn } from "@/lib/utils";

export default function ChatList() {
  const matches = useAppStore((s) => s.matches);
  const router = useRouter();
  const newMatches = matches.slice(0, 4);

  useEffect(() => {
    document.title = "Chat — Cultured";
  }, []);

  return (
    <div className="min-h-full pb-4">
      <header className="safe-t sticky top-0 z-40 border-b border-hairline bg-canvas/72 px-5 pb-3.5 backdrop-blur-2xl">
        <div className="flex items-center justify-between pt-1.5">
          <h1 className="display-lg text-ink">Chat</h1>
          <button
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full glass text-ink-dim hover:text-ink"
          >
            <Search size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* new matches strip */}
      <section className="px-4 pt-4">
        <h2 className="mono-label mb-3.5">
          New resonances
        </h2>
        <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1">
          {newMatches.map((m) => (
            <Link key={m.id} href={`/chat/${m.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <span className="halo relative rounded-full p-[2.5px] ring-2 ring-flame/70 ring-offset-2 ring-offset-canvas">
                <Avatar gradient={m.gradient} name={m.name} size={56} />
              </span>
              <span className="w-full truncate text-center text-[11.5px] text-ink-dim">
                {m.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* conversation list */}
      <section className="mt-5 px-4">
        <h2 className="mono-label mb-2">
          Messages
        </h2>
        <div className="flex flex-col">
          {matches.map((m) => {
            const last = m.messages[m.messages.length - 1];
            const preview = last?.attachment
              ? `Matched over “${last.attachment.title.slice(0, 34)}${last.attachment.title.length > 34 ? "…" : ""}”`
              : last?.senderId === "me"
                ? `You: ${last.text}`
                : last?.text ?? "";
            return (
              <Link
                key={m.id}
                href={`/chat/${m.id}`}
                className={cn(
                  "flex items-center gap-3.5 rounded-[20px] px-2.5 py-3.5 transition-colors hover:bg-panel/80",
                  m.unread > 0 && "glass border-flame/25 px-3"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar gradient={m.gradient} name={m.name} size={52} />
                  {m.unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-flame ring-[3px] ring-canvas" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {m.name}, {m.age}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-ink-faint">{m.lastActive}</span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[13.5px]",
                      m.unread > 0 ? "text-ink" : "text-ink-faint"
                    )}
                  >
                    {preview}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10.5px] text-ink-dim">
                      <Smile size={10} strokeWidth={2} />
                      {m.tasteScore}% twins
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10.5px] text-ink-dim">
                      {m.mode === "dating" ? "dating" : "friends"}
                    </span>
                    {m.matchedOn?.kind === "track" && (
                      <span className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5 text-[10.5px] text-ink-dim">
                        <Music2 size={10} strokeWidth={2} /> track
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mono-label mt-6 text-center !text-[9.5px] !tracking-[0.1em] leading-relaxed text-ink-faint">
          messaging is never paywalled — first message included,
          <br />
          every tier, every day
        </p>
      </section>
    </div>
  );
}
