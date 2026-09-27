"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Pause, Play, Sparkles, X } from "lucide-react";
import type { Match } from "@/lib/types";
import { Waveform } from "@/components/feed/Waveform";
import { Avatar } from "@/components/ui/GradientTile";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/Portal";
import { useAppReduced } from "@/lib/motion";

const CAP_SECONDS = 900; // 15-minute free-tier cap

const SESSION_TRACKS = [
  { id: "t1", title: "places to be", artist: "Fred again..", duration: 205, gradient: "linear-gradient(135deg, #7c5cff 0%, #a855f7 48%, #1e1b4b 100%)" },
  { id: "t2", title: "Valentine", artist: "Laufey", duration: 178, gradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)" },
  { id: "t3", title: "Lite Spots", artist: "KAYTRANADA", duration: 216, gradient: "linear-gradient(145deg, #43cbff 0%, #9733ee 100%)" },
];

const DROP_EMOJIS = ["❤️", "😂", "🔥", "😭", "✨"];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Listening Session — canvas waveform scrubber driven by rAF (never video),
 * 15-min free cap with Playlist Pass upsell, timestamped emoji drops,
 * auto-logged to the pair's private “Our Soundtrack”.
 */
export function ListeningSession({
  open,
  onClose,
  match,
}: {
  open: boolean;
  onClose: () => void;
  match: Match;
}) {
  const reduced = useAppReduced();
  const toast = useToast();
  const [trackId, setTrackId] = useState(SESSION_TRACKS[0]!.id);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drops, setDrops] = useState<{ t: number; e: string; id: number }[]>([]);
  const [soundtrack, setSoundtrack] = useState<string[]>([]);
  const [upsell, setUpsell] = useState(false);
  const dropId = useRef(0);

  const track = useMemo(
    () => SESSION_TRACKS.find((t) => t.id === trackId) ?? SESSION_TRACKS[0]!,
    [trackId]
  );

  /* playback clock + cap enforcement */
  useEffect(() => {
    if (!open || !playing) return;
    const iv = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= CAP_SECONDS) {
          setPlaying(false);
          setUpsell(true);
          return CAP_SECONDS;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [open, playing]);

  /* session start logs the track to Our Soundtrack */
  useEffect(() => {
    if (!open) return;
    setSoundtrack((s) => (s.includes(track.title) ? s : [...s, track.title]));
  }, [open, track.title]);

  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);

  const progress = Math.min(1, elapsed / track.duration);
  const atCap = elapsed >= CAP_SECONDS;

  return (
    <Portal>
      <AnimatePresence>
        {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-[260] max-h-[92dvh] overflow-hidden rounded-t-sheet border border-hairline bg-panel shadow-[0_-20px_70px_rgba(0,0,0,0.6)]"
        >
          <div className="mx-auto mt-3 h-1 w-11 rounded-full bg-flame/50 shadow-[0_0_12px_rgba(124,92,255,0.5)] glow-flame" />
          <div className="no-scrollbar max-h-[88dvh] overflow-y-auto px-5 pb-7 pt-3">
            {/* header */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                <Avatar gradient={match.gradient} name={match.name} size={34} className="ring-2 ring-panel" />
                <Avatar gradient="linear-gradient(135deg, #7c5cff 0%, #312e81 100%)" name="Alex" size={34} className="ring-2 ring-panel" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[20px] font-medium leading-tight tracking-[-0.01em] text-ink">
                  Listen together
                </h2>
                <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      playing ? "bg-flame" : "bg-ink-faint"
                    )}
                  />
                  synced live with {match.name}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close session"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 border border-hairline text-ink-dim hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {/* track picker */}
            <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1">
              {SESSION_TRACKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTrackId(t.id);
                    setElapsed(0);
                    setDrops([]);
                  }}
                  className={cn(
                    "flex w-[190px] shrink-0 items-center gap-2.5 rounded-[14px] border p-2.5 text-left transition-colors",
                    t.id === trackId
                      ? "border-flame/60 bg-flame/8"
                      : "border-hairline bg-panel-2 hover:bg-[#2e2a22]"
                  )}
                >
                  <span
                    className="h-10 w-10 shrink-0 rounded-[10px]"
                    style={{ background: t.gradient }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{t.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">{t.artist}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* waveform scrubber — canvas, rAF-driven, timestamp drops */}
            <div className="mt-4 rounded-[20px] glass p-4">
              <div className="relative">
                <Waveform
                  seed={track.title.length * 13 + 7}
                  playing={playing}
                  height={72}
                  progress={progress}
                />
                {/* timestamped emoji markers */}
                {drops.map((d) => {
                  const pos = Math.min(0.98, d.t / track.duration);
                  return (
                    <span
                      key={d.id}
                      className="absolute -top-1 text-[13px]"
                      style={{ left: `${pos * 100}%`, transform: "translateX(-50%)" }}
                      title={`at ${fmt(d.t)}`}
                    >
                      {d.e}
                    </span>
                  );
                })}
                {/* playhead */}
                <span
                  className="absolute inset-y-0 w-px bg-flame/70"
                  style={{ left: `${progress * 100}%` }}
                />
                <span className="sr-only">{drops.length ? `${drops.length} reactions` : ""}</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] tabular-nums text-ink-dim">
                <span>{fmt(elapsed)}</span>
                <span className="flex items-center gap-1 text-ink-faint">
                  <Clock size={11} /> free tier · {fmt(CAP_SECONDS - elapsed)} left
                </span>
                <span>{fmt(track.duration)}</span>
              </div>

              {/* controls */}
              <div className="mt-4 flex items-center justify-center gap-5">
                <button
                  onClick={() => {
                    setElapsed(0);
                    setDrops([]);
                  }}
                  aria-label="Restart"
                  className="text-[12.5px] text-ink-faint hover:text-ink"
                >
                  restart
                </button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => !atCap && setPlaying((p) => !p)}
                  disabled={atCap}
                  aria-label={playing ? "Pause" : "Play"}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                    playing
                      ? "border border-flame/70 bg-flame/18 text-flame shadow-[0_0_28px_rgba(124,92,255,0.55)]"
                      : "bg-flame text-flame-ink glow-flame",
                    atCap && "opacity-40"
                  )}
                >
                  {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </motion.button>
                <button
                  onClick={() => setElapsed((e) => Math.min(CAP_SECONDS, e + 30))}
                  aria-label="Forward 30s"
                  className="text-[12.5px] text-ink-faint hover:text-ink"
                >
                  +30s
                </button>
              </div>
            </div>

            {/* timestamped emoji reactions */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[12px] text-ink-faint">drop a reaction:</span>
              <div className="flex gap-1.5">
                {DROP_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setDrops((d) => [...d, { t: elapsed, e, id: ++dropId.current }]);
                      toast(`${e} dropped at ${fmt(elapsed)}`);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-panel-2 text-[16px] transition-transform hover:scale-110"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* cap upsell — never gates messaging, just session length */}
            {(upsell || atCap) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-3 rounded-[16px] border border-flame/40 bg-flame/8 p-4"
              >
                <Sparkles size={20} className="shrink-0 text-flame" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">
                    15-minute cap reached
                  </p>
                  <p className="text-[12px] leading-snug text-ink-dim">
                    Playlist Pass removes the cap for this session — one-time, no
                    subscription.
                  </p>
                </div>
                <Button size="sm" variant="flame" onClick={() => toast("Playlist Pass — IAP stub")}>
                  Unlock
                </Button>
              </motion.div>
            )}
            <p className="mt-3 text-center text-[11.5px] text-ink-faint">
              sessions up to {fmt(CAP_SECONDS)} are free, forever · Playlist Pass lifts the cap
            </p>

            {/* Our Soundtrack log */}
            <div className="mt-5 border-t border-hairline pt-4">
              <h3 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Our Soundtrack
              </h3>
              <div className="flex flex-col gap-1.5">
                {soundtrack.map((t, i) => (
                  <div key={t} className="flex items-center gap-3 rounded-[12px] bg-panel-2 px-3 py-2">
                    <span className="w-5 text-[12px] tabular-nums text-ink-faint">{i + 1}</span>
                    <span className="flex-1 truncate text-[13.5px] text-ink">{t}</span>
                    <span className="text-[11px] text-ink-faint">played together</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                private — only the two of you can see this list
              </p>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </Portal>
  );
}