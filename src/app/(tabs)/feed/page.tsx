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
      <header className="safe-t sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-canvas/88 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[22px] font-medium tracking-tight text-ink">
            Cultured
          </span>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-ink-faint sm:inline">
            culture feed
          </span>
        </div>
        <Link
          href="/notifications"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-panel-2 text-ink-dim transition-colors hover:text-ink"
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
