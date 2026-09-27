"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Camera, Eye, Lock, MapPin, Pencil, Plus, Settings, Sparkles } from "lucide-react";
import { myFingerprint } from "@/lib/mockData";
import { useAppStore } from "@/lib/store";
import { Avatar, GradientTile } from "@/components/ui/GradientTile";
import { Switch } from "@/components/ui/Switch";
import { HumorBars, SectionTitle } from "@/components/matrix/ExpandedFingerprint";
import { useToast } from "@/components/ui/Toaster";
import { useAppReduced, SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { GRADIENTS } from "@/lib/mockData";

type Tab = "photos" | "fingerprint" | "prompts";

export default function ProfileView() {
  const [tab, setTab] = useState<Tab>("fingerprint");
  const reduced = useAppReduced();
  const toast = useToast();

  const profileName = useAppStore((s) => s.profileName);
  const profileAge = useAppStore((s) => s.profileAge);
  const profileCity = useAppStore((s) => s.profileCity);
  const photoSlots = useAppStore((s) => s.photoSlots);
  const setPhotoSlot = useAppStore((s) => s.setPhotoSlot);
  const visibility = useAppStore((s) => s.settings.fingerprintVisibility);
  const setSetting = useAppStore((s) => s.setSetting);
  const [playlists, setPlaylists] = useState(myFingerprint.playlists);

  const tabs: { id: Tab; label: string }[] = [
    { id: "photos", label: "Photos" },
    { id: "fingerprint", label: "Fingerprint" },
    { id: "prompts", label: "Prompts" },
  ];

  return (
    <div className="min-h-full pb-6">
      {/* header */}
      <header className="safe-t sticky top-0 z-40 border-b border-hairline bg-canvas/88 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Your profile
          </span>
          <a
            href="/settings"
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-panel-2 text-ink-dim hover:text-ink"
          >
            <Settings size={17} strokeWidth={1.75} />
          </a>
        </div>

        {/* identity */}
        <div className="flex items-center gap-3.5 px-4 pb-4">
          <Avatar
            gradient={photoSlots[0] ?? GRADIENTS[8]}
            name={profileName}
            size={64}
            className="ring-2 ring-flame/40 ring-offset-2 ring-offset-canvas"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-[24px] font-medium leading-none text-ink">
                {profileName}, {profileAge}
              </h1>
              <BadgeCheck size={18} className="text-flame" strokeWidth={2} aria-label="Verified" />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-ink-dim">
              <MapPin size={12} /> {profileCity}
            </p>
          </div>
        </div>

        {/* privacy toggle — database-enforced guarantee in the real build */}
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[16px] border border-hairline bg-panel px-3.5 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-2 text-flame">
            {visibility === "matches_only" ? <Lock size={16} /> : <Eye size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-ink">
              {visibility === "matches_only"
                ? "Show fingerprint to matches only"
                : "Visible before matching"}
            </p>
            <p className="text-[11.5px] leading-snug text-ink-faint">
              {visibility === "matches_only"
                ? "Discovery previews show your photo + name only"
                : "Your humor bars and artists show on your Matrix card"}
            </p>
          </div>
          <Switch
            checked={visibility === "before_matching"}
            onCheckedChange={(v) => {
              setSetting("fingerprintVisibility", v ? "before_matching" : "matches_only");
              toast(v ? "Fingerprint visible before matching" : "Fingerprint hidden until you match");
            }}
          />
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-4 pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex-1 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors",
                tab === t.id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
              )}
            >
              {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="profile-tab-ink"
                  className="absolute inset-x-3 -bottom-px h-[2.5px] rounded-full bg-flame"
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-5">
        {tab === "photos" && (
          <div className="grid grid-cols-3 gap-2.5">
            {photoSlots.map((slot, i) =>
              slot ? (
                <GradientTile
                  key={i}
                  gradient={slot}
                  square
                  className="rounded-[14px] border border-hairline"
                >
                  <button
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => {
                      setPhotoSlot(i, null);
                      toast("Photo removed");
                    }}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm"
                  >
                    <span className="text-[13px] leading-none">×</span>
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-white">
                    {i === 0 ? "primary" : `${i + 1}`}
                  </span>
                </GradientTile>
              ) : (
                <button
                  key={i}
                  aria-label={`Add photo ${i + 1}`}
                  onClick={() => {
                    setPhotoSlot(i, GRADIENTS[(i * 3 + 5) % GRADIENTS.length]);
                    toast("Photo added (demo roll)");
                  }}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-hairline bg-panel text-ink-faint transition-colors hover:border-flame/40 hover:text-ink-dim"
                >
                  {i === photoSlots.findIndex((s) => s === null) ? (
                    <Camera size={20} strokeWidth={1.75} />
                  ) : (
                    <Plus size={18} strokeWidth={1.75} />
                  )}
                  <span className="text-[10.5px]">add photo</span>
                </button>
              )
            )}
            <p className="col-span-3 mt-2 text-[12px] leading-snug text-ink-faint">
              Photos are equal-weight to the fingerprint here — never the hero
              element. 2–6 slots, first one is your Matrix primary.
            </p>
          </div>
        )}

        {tab === "fingerprint" && (
          <div className="flex flex-col gap-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle>Humor style</SectionTitle>
                <span className="text-[11px] text-ink-faint">
                  updates on every reaction
                </span>
              </div>
              <div className="rounded-[18px] border border-hairline bg-panel p-4">
                <HumorBars humor={myFingerprint.humor} summary={myFingerprint.summary} />
              </div>
            </section>

            <section>
              <SectionTitle>Top 5 artists</SectionTitle>
              <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                {myFingerprint.topArtists.map((a) => (
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
              <SectionTitle>Genre tags</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {myFingerprint.genres.map((g) => (
                  <span
                    key={g}
                    className="inline-flex h-8 items-center rounded-full border border-hairline bg-panel-2 px-3.5 text-[12.5px] text-ink-dim"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle>Pinned playlists</SectionTitle>
                <span className="text-[11px] text-ink-faint">tap pin to override curation</span>
              </div>
              <div className="flex flex-col gap-2">
                {playlists.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 rounded-[14px] border px-3.5 py-3 transition-opacity",
                      p.pinned ? "border-hairline bg-panel-2" : "border-hairline bg-panel opacity-60"
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#332e25] text-flame">
                      <Sparkles size={15} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{p.title}</p>
                      <p className="text-[12px] text-ink-faint">{p.trackCount} tracks</p>
                    </div>
                    <button
                      aria-label={p.pinned ? `Unpin ${p.title}` : `Pin ${p.title}`}
                      onClick={() => {
                        setPlaylists((pl) =>
                          pl.map((x) => (x.id === p.id ? { ...x, pinned: !x.pinned } : x))
                        );
                        toast(p.pinned ? "Unpinned — auto-curation takes over" : "Pinned");
                      }}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                        p.pinned
                          ? "border-flame/50 bg-flame/10 text-flame"
                          : "border-hairline bg-panel text-ink-faint hover:text-ink"
                      )}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17v5" />
                        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Recently vibed with</SectionTitle>
              <div className="grid grid-cols-5 gap-2">
                {myFingerprint.recentMemes.map((m) => (
                  <GradientTile key={m.id} gradient={m.gradient} square className="rounded-[10px]">
                    <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[7.5px] font-black uppercase leading-tight text-white text-sheet">
                      {m.caption.slice(0, 44)}
                    </span>
                  </GradientTile>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                your own curation, not a raw activity log
              </p>
            </section>
          </div>
        )}

        {tab === "prompts" && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-snug text-ink-faint">
              3 of 8 answered — deliberately cultural, never generic.
            </p>
            {myFingerprint.prompts.map((p) => (
              <div key={p.id} className="rounded-[16px] border border-hairline bg-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                      {p.prompt}
                    </p>
                    <p className="font-display mt-1.5 text-[17px] italic leading-snug text-ink">
                      {p.answer}
                    </p>
                  </div>
                  <button
                    aria-label="Edit prompt"
                    onClick={() => toast("Prompt editor would open here")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-panel-2 text-ink-dim hover:text-ink"
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
