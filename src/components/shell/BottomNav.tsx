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
    <nav className="safe-b relative z-50 shrink-0 px-4 pb-2.5 pt-2">
      <div className="mx-auto flex h-[62px] w-full max-w-[380px] items-center justify-around rounded-full glass px-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85),0_1px_0_rgba(255,255,255,0.07)_inset]">
        {TABS.map((tab) => {
          const isActive = active === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-12 min-w-[68px] flex-col items-center justify-center gap-1 rounded-full px-3 transition-colors",
                isActive ? "text-flame" : "text-ink-faint hover:text-ink-dim"
              )}
            >
              {isActive && (
                <>
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-flame/12 border border-flame/30 shadow-[0_6px_22px_-8px_rgba(124,92,255,0.55)]"
                    transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                  />
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-flame"
                    transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                  />
                </>
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
