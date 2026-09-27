"use client";

import { motion } from "motion/react";
import { Bell, Heart, MessageCircle, Music2, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { NotificationItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, GradientTile } from "@/components/ui/GradientTile";
import { useToast } from "@/components/ui/Toaster";
import { useAppReduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

const SECTIONS: { id: NotificationItem["section"]; label: string; note: string }[] = [
  { id: "matches", label: "Matches & messages", note: "the romantic lane, kept separate" },
  { id: "feed", label: "Feed activity", note: "social, never romantic" },
  { id: "fingerprint", label: "Fingerprint updates", note: "light nudges only — no guilt trips" },
];

export default function NotificationsView() {
  const notifications = useAppStore((s) => s.notifications);
  const dismiss = useAppStore((s) => s.dismissNotification);
  const toast = useToast();
  const reduced = useAppReduced();

  return (
    <div className="min-h-full pb-6">
      <PageHeader title="Notifications" />

      <div className="flex flex-col gap-8 px-5 pt-5">
        {SECTIONS.map((sec) => {
          const items = notifications.filter((n) => n.section === sec.id);
          return (
            <section key={sec.id}>
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="mono-label !text-ink">
                  {sec.label}
                </h2>
                <span className="text-[11px] text-ink-faint">{items.length}</span>
              </div>
              <p className="mb-3 text-[11.5px] text-ink-faint">{sec.note}</p>

              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <div className="rounded-[16px] border border-dashed border-hairline px-4 py-5 text-center text-[13px] text-ink-faint">
                    All clear here.
                  </div>
                )}
                {items.map((n) => (
                  <motion.div
                    key={n.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className={cn(
                      "relative flex items-start gap-3 rounded-[20px] border p-4 pr-10",
                      n.unread
                        ? "border-flame/35 bg-flame/8 shadow-[0_8px_30px_-14px_rgba(255,107,74,0.45)]"
                        : "border-hairline bg-panel"
                    )}
                  >
                    <div className="shrink-0">
                      {n.gradient ? (
                        <Avatar gradient={n.gradient} name={n.title} size={40} />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-panel-2 text-flame">
                          {sec.id === "matches" ? (
                            <Heart size={17} strokeWidth={1.75} />
                          ) : sec.id === "feed" ? (
                            <MessageCircle size={17} strokeWidth={1.75} />
                          ) : (
                            <Sparkles size={17} strokeWidth={1.75} />
                          )}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="truncate text-[14px] font-medium text-ink">{n.title}</p>
                        <span className="ml-auto shrink-0 text-[11px] text-ink-faint">{n.time}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-dim">
                        {n.body}
                      </p>
                      {sec.id === "fingerprint" && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <Sparkles size={10} /> dismissed forever after this
                        </p>
                      )}
                    </div>
                    {sec.id === "fingerprint" ? (
                      <button
                        aria-label="Dismiss"
                        onClick={() => {
                          dismiss(n.id);
                          toast("Dismissed — no more of these");
                        }}
                        className="absolute right-2.5 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:text-ink"
                      >
                        <X size={15} />
                      </button>
                    ) : n.unread ? (
                      <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-flame" />
                    ) : null}
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}

        <div className="rounded-[16px] border border-hairline bg-panel-2 p-4 text-center">
          <p className="text-[12.5px] leading-relaxed text-ink-dim">
            <span className="text-ink">No dark patterns live here.</span> Never
            “3 people are waiting for you!” — notification categories are all
            toggleable in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
