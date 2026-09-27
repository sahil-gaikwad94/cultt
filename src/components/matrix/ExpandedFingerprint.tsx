"use client";

import { motion } from "motion/react";
import { BadgeCheck, Lock, MapPin, Pin, Sparkles, X } from "lucide-react";
import type { Candidate, HumorVector } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { Avatar, GradientTile } from "@/components/ui/GradientTile";
import { useAppReduced } from "@/lib/motion";
import { Portal } from "@/components/ui/Portal";

/* ── humor style bars (4 dims, one-line Fraunces-italic summary) ── */
export function HumorBars({
  humor,
  summary,
  compact,
}: {
  humor: HumorVector;
  summary: string;
  compact?: boolean;
}) {
  const rows: { key: keyof HumorVector; label: string }[] = [
    { key: "affiliative", label: "Affiliative" },
    { key: "selfEnhancing", label: "Self-enhancing" },
    { key: "aggressive", label: "Aggressive" },
    { key: "selfDefeating", label: "Self-defeating" },
  ];
  const top = rows.reduce((a, b) => (humor[a.key] >= humor[b.key] ? a : b));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const v = humor[r.key];
        const isTop = r.key === top.key;
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span
              className={`w-[112px] shrink-0 text-[12.5px] ${
                isTop ? "font-semibold text-ink" : "text-ink-dim"
              }`}
            >
              {r.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-panel-2 border border-hairline shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(v * 100)}%` }}
                transition={{ duration: compact ? 0.5 : 0.7, ease: "easeOut", delay: 0.1 }}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isTop ? "bg-flame shadow-[0_0_14px_rgba(124,92,255,0.55)]" : "bg-[#2b2c3d]"
                }`}
              />
            </div>
            <span className="numeral w-8 text-right text-[13px] text-ink-dim">
              {Math.round(v * 100)}
            </span>
          </div>
        );
      })}
      <p className="font-display text-[15px] italic leading-snug text-ink-dim pt-1">
        “{summary}”
      </p>
    </div>
  );
}

/* ── shared body: candidate's fingerprint, read-only ── */
export function FingerprintBody({ c }: { c: Candidate }) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <section>
        <SectionTitle>Humor style</SectionTitle>
        <HumorBars humor={c.humor} summary={c.humorSummary} />
      </section>

      <section>
        <SectionTitle>Top 5 artists</SectionTitle>
        <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
          {c.topArtists.map((a) => (
            <div key={a.name} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <Avatar gradient={a.gradient} name={a.name} size={58} />
              <span className="w-full truncate text-center text-[11px] text-ink-dim">
                {a.name}
              </span>
              <span className="w-full truncate text-center text-[10px] text-ink-faint">
                {a.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Pinned playlists</SectionTitle>
        <div className="flex flex-col gap-2">
          {c.playlists.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-[16px] glass px-3.5 py-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#332e25] text-flame">
                <Pin size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{p.title}</p>
                <p className="text-[12px] text-ink-faint">{p.trackCount} tracks</p>
              </div>
              <span className="text-[12px] text-ink-faint">30s preview</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Recently vibed with</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {c.recentMemes.map((m) => (
            <GradientTile
              key={m.id}
              gradient={m.gradient}
              square
              className="rounded-[10px]"
            >
              <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[7.5px] font-black uppercase leading-tight text-white text-sheet">
                {m.caption.slice(0, 44)}
              </span>
            </GradientTile>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Prompts</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {c.prompts.map((p) => (
            <div key={p.id} className="rounded-[18px] card p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                {p.prompt}
              </p>
              <p className="font-display mt-1 text-[15.5px] italic leading-snug text-ink">
                {p.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* locked deep-dive preview — unlocks when you match */}
      <section className="relative overflow-hidden rounded-[16px] border border-hairline bg-panel-2 p-4">
        <div className="pointer-events-none absolute inset-0 select-none blur-[6px]" aria-hidden>
          <div className="flex h-full flex-col justify-center gap-3 px-4">
            <div className="h-3 w-3/4 rounded-full bg-flame/50" />
            <div className="h-3 w-2/3 rounded-full bg-[#2b2c3d]" />
            <div className="h-3 w-1/2 rounded-full bg-[#2b2c3d]" />
            <p className="font-display text-[15px] italic text-ink-dim">
              “both of you keep replaying the same 3-second bridge…”
            </p>
          </div>
        </div>
        <div className="relative flex flex-col items-center gap-1.5 py-4 text-center">
          <Lock size={18} className="text-ink-dim" strokeWidth={1.75} />
          <p className="text-[13.5px] font-medium text-ink">
            Compatibility deep-dive unlocks when you match
          </p>
          <p className="text-[12px] text-ink-faint">
            humor overlap · shared micro-genres · the “why 87%”
          </p>
        </div>
      </section>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mono-label mb-3.5">
      {children}
    </h3>
  );
}

/* ── full-screen expansion: photo morphs via layoutId, no hard cut ── */
export function ExpandedFingerprint({
  candidate,
  onClose,
  onPass,
  onLike,
  onResonate,
  onSharedChip,
  canResonate,
  resonatesLeft,
}: {
  candidate: Candidate;
  onClose: () => void;
  onPass: () => void;
  onLike: () => void;
  onResonate: () => void;
  onSharedChip: () => void;
  canResonate: boolean;
  resonatesLeft: number;
}) {
  const reduced = useAppReduced();
  return (
    <Portal>
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 26 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[240] flex flex-col bg-canvas"
    >
      <div className="safe-t relative shrink-0 px-4 pb-3">
        <button
          onClick={onClose}
          aria-label="Collapse fingerprint"
          className="absolute right-4 top-[max(14px,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full glass text-ink"
        >
          <X size={18} />
        </button>
      </div>

      {/* hero photo — SAME layoutId as the card photo → morph */}
      <div className="relative mx-5 h-[280px] shrink-0">
        <motion.div
          layoutId={`photo-${candidate.id}`}
          className="absolute inset-0 overflow-hidden rounded-[24px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
          style={{ background: candidate.photoGradient }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.5px)",
              backgroundSize: "7px 7px",
            }}
          />
        </motion.div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-[20px] bg-gradient-to-t from-black/80 via-black/45 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[34px] font-medium leading-none tracking-[-0.02em] text-white text-sheet">
                {candidate.name}, {candidate.age}
              </h2>
              {candidate.verified && (
                <BadgeCheck size={20} className="text-flame" strokeWidth={2} />
              )}
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-white/85">
              <MapPin size={12} /> {candidate.city} · {candidate.distanceKm} km
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <Sparkles size={13} className="text-flame" strokeWidth={2} />
            <span className="text-[12.5px] font-semibold text-white">
              {candidate.tasteScore}% taste twins
            </span>
          </div>
        </div>
      </div>

      {/* shared signals */}
      <div className="no-scrollbar mt-3.5 flex shrink-0 gap-2 overflow-x-auto px-5">
        <Chip onClick={onSharedChip} className="border-flame/40 bg-flame/10 text-flame">
          ♫ shared artist · {candidate.sharedArtist}
        </Chip>
        <Chip onClick={onSharedChip} className="border-flame/40 bg-flame/10 text-flame">
          😂 {candidate.sharedMemeCategory} humor
        </Chip>
      </div>

      <div className="no-scrollbar mt-4 flex-1 overflow-y-auto px-5">
        <p className="mb-5 text-[14px] leading-relaxed text-ink-dim">{candidate.blurb}</p>
        <FingerprintBody c={candidate} />
      </div>

      {/* actions — never forced into blind swiping */}
      <div className="safe-b flex shrink-0 items-center gap-2.5 border-t border-hairline bg-canvas/80 px-5 pb-3 pt-3.5 backdrop-blur-2xl">
        <button
          onClick={onPass}
          aria-label="Pass"
          className="flex h-13 flex-1 items-center justify-center rounded-full glass text-[15px] font-medium text-ink hover:bg-panel-3"
        >
          Pass
        </button>
        <button
          onClick={onLike}
          aria-label="Vibe"
          className="flex h-13 flex-1 items-center justify-center rounded-full glass text-[15px] font-medium text-ink hover:bg-panel-3"
        >
          Vibe
        </button>
        <button
          onClick={onResonate}
          disabled={!canResonate}
          aria-label="Resonate"
          className="flex h-13 flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-flame text-[15px] font-semibold text-flame-ink glow-flame disabled:opacity-40 disabled:shadow-none"
        >
          <Sparkles size={17} strokeWidth={2} />
          Resonate · {resonatesLeft} left
        </button>
      </div>
    </motion.div>
    </Portal>
  );
}
