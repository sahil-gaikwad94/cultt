"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Layers,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY, useAppReduced } from "@/lib/motion";
import { useAppStore } from "@/lib/store";

const TABS = [
  { href: "/feed", label: "Feed", icon: Flame },
  { href: "/matrix", label: "Matrix", icon: Layers },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

const DRILL_PARENT: Record<string, string> = {
  "/feed": "/feed",
  "/notifications": "/feed",
  "/matrix": "/matrix",
  "/chat": "/chat",
  "/profile": "/profile",
  "/settings": "/profile",
};

export function activeTabFor(pathname: string): string {
  if (DRILL_PARENT[pathname]) return DRILL_PARENT[pathname];
  const seg = "/" + pathname.split("/")[1];
  return seg;
}

/** Floating pill bottom nav — 4 tabs, icon + label, accent active state. */
export default function BottomNav() {
  const pathname = usePathname();
  const active = activeTabFor(pathname);
  const reduced = useAppReduced();
  const unreadMatches = useAppStore((s) =>
    s.matches.reduce((n, m) => n + (m.unread > 0 ? 1 : 0), 0)
  );

  return (
    <nav className="safe-b relative z-50 shrink-0 px-4 pb-2 pt-1.5">
      <div className="mx-auto flex h-[58px] w-full max-w-md items-center justify-around rounded-full border border-hairline bg-[#1a1712]/95 px-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const isActive = active === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-11 min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-full px-3 transition-colors",
                isActive ? "text-flame" : "text-ink-faint hover:text-ink-dim"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-flame/10 border border-flame/25"
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <span className="relative">
                <Icon size={20} strokeWidth={1.75} />
                {tab.href === "/chat" && unreadMatches > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-flame px-0.5 text-[9px] font-bold text-flame-ink">
                    {unreadMatches}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
