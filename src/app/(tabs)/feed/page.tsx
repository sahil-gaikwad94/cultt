"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useAppStore } from "@/lib/store";
import FeedView from "@/components/feed/FeedView";

export default function FeedPage() {
  const notifications = useAppStore((s) => s.notifications);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-full pb-4">
      <header className="safe-t sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-canvas/72 px-5 pb-3.5 pt-2 backdrop-blur-2xl">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[24px] font-medium tracking-[-0.02em] text-ink">
            Cultured
          </span>
          <span className="mono-label hidden sm:inline !text-[9.5px] text-ink-faint">
            culture feed
          </span>
        </div>
        <Link
          href="/notifications"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full glass text-ink-dim transition-colors hover:text-ink"
        >
          <Bell size={18} strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-flame ring-2 ring-panel-2" />
          )}
        </Link>
      </header>

      <FeedView />
    </div>
  );
}
