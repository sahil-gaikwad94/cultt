"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Eye,
  EyeOff,
  Music4,
  RefreshCw,
  Shield,
  Sparkles,
  Download,
  Trash2,
  UserX,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toaster";
import { genreOptions } from "@/lib/mockData";
import { cn } from "@/lib/utils";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {title}
      </h2>
      <div className="card overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  desc,
  right,
  onClick,
  danger,
  last,
}: {
  label: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  /* Structure: div wrapper → button label area + optional sibling `right`
     (Radix switches are buttons too — never nest them inside a button). */
  const wrapperCls = cn(
    "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
    !last && "border-b border-hairline",
    danger && "text-[#e05d5d]"
  );
  const labelArea = (
    <div className="min-w-0 flex-1">
      <p className={cn("text-[14.5px] font-medium", danger ? "text-[#e05d5d]" : "text-ink")}>
        {label}
      </p>
      {desc && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">{desc}</p>}
    </div>
  );
  if (onClick) {
    /* `right` stays a SIBLING of the button — switches are buttons too */
    return (
      <div className={wrapperCls}>
        <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
          {labelArea}
          {!right && <ChevronRight size={16} className="shrink-0 text-ink-faint" />}
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    );
  }
  return (
    <div className={wrapperCls}>
      {labelArea}
      {right}
    </div>
  );
}

function PremiumTag() {
  return (
    <span className="shrink-0 rounded-full border border-flame/50 bg-flame/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-flame">
      Premium
    </span>
  );
}

export default function SettingsView() {
  const toast = useToast();
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const toggleArray = useAppStore((s) => s.toggleArraySetting);
  const resetFingerprint = useAppStore((s) => s.resetFingerprint);
  const spotify = useAppStore((s) => s.spotifyConnected);
  const setSpotify = useAppStore((s) => s.setSpotify);

  const [dangerSheet, setDangerSheet] = useState<"deactivate" | "delete" | "safety" | null>(null);
  const [addGenre, setAddGenre] = useState(false);

  return (
    <div className="min-h-full pb-8">
      <PageHeader title="Settings" />

      <div className="px-4 pt-5">
        {/* Discovery */}
        <Group title="Discovery preferences">
          <div className="border-b border-hairline px-4 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[14.5px] font-medium text-ink">Age range</span>
              <span className="text-[13px] tabular-nums text-flame">
                {settings.ageMin}–{settings.ageMax}
              </span>
            </div>
            <Slider
              label="Age range"
              min={18}
              max={60}
              value={[settings.ageMin, settings.ageMax]}
              onValueChange={([a, b]) => {
                setSetting("ageMin", Math.min(a, b - 1));
                setSetting("ageMax", Math.max(b, a + 1));
              }}
            />
          </div>
          <div className="border-b border-hairline px-4 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[14.5px] font-medium text-ink">Max distance</span>
              <span className="text-[13px] tabular-nums text-flame">
                {settings.maxDistanceKm} km
              </span>
            </div>
            <Slider
              label="Max distance"
              min={1}
              max={100}
              value={[settings.maxDistanceKm]}
              onValueChange={([v]) => setSetting("maxDistanceKm", v)}
            />
          </div>
          <div className="px-4 py-4">
            <p className="mb-2.5 text-[14.5px] font-medium text-ink">Default mode</p>
            <Segmented
              id="settings-mode"
              value={settings.defaultMode}
              onChange={(v) => setSetting("defaultMode", v)}
              options={[
                { value: "dating", label: "Dating" },
                { value: "friends", label: "Friends" },
              ]}
            />
          </div>
        </Group>

        {/* Cultural data */}
        <Group title="Cultural data controls">
          <Row
            label={spotify ? "Spotify connected" : "Reconnect Spotify"}
            desc={
              spotify
                ? "top artists refresh every 7 days via Last.fm"
                : "one-time OAuth pull at signup"
            }
            right={
              spotify ? (
                <BadgeCheck size={18} className="shrink-0 text-flame" />
              ) : (
                <Music4 size={17} className="shrink-0 text-ink-faint" />
              )
            }
            onClick={() => {
              setSpotify(!spotify);
              toast(spotify ? "Spotify disconnected" : "Spotify connected — artists synced");
            }}
          />
          <Row
            label="Export my Fingerprint data"
            desc="everything the vectors know, as JSON"
            right={<Download size={17} className="shrink-0 text-ink-faint" />}
            onClick={() => toast("Export queued — we'll email the file")}
          />
          <Row
            label="Reset humor + music vectors"
            desc="a genuine rebuild, not cosmetic — calibration reruns"
            right={<RefreshCw size={16} className="shrink-0 text-ink-faint" />}
            onClick={() => {
              resetFingerprint();
              toast("Fingerprint wiped — recalibration will rebuild it");
            }}
          />
          <div className="px-4 py-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[14.5px] font-medium text-ink">Genre tags</span>
              <button
                onClick={() => setAddGenre(true)}
                className="text-[12.5px] text-flame"
              >
                + add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.genreTags.length === 0 && (
                <span className="text-[13px] text-ink-faint">
                  none yet — add a few to seed the music vector
                </span>
              )}
              {settings.genreTags.map((g) => (
                <Chip key={g} onClick={() => toggleArray("genreTags", g)}>
                  {g} <span className="ml-1 text-ink-faint">×</span>
                </Chip>
              ))}
            </div>
          </div>
        </Group>

        {/* Anti-genre */}
        <Group title="Anti-genre & anti-humor filters">
          <div className="px-4 py-4">
            <p className="mb-1 text-[13.5px] text-ink-dim">
              “never show me” — blocked tags never even reach the similarity
              search.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {settings.antiGenres.map((g) => (
                <Chip
                  key={g}
                  active
                  onClick={() => {
                    toggleArray("antiGenres", g);
                    toast(`Removed “${g}” from your never-show list`);
                  }}
                >
                  {g} <span className="ml-1 opacity-70">×</span>
                </Chip>
              ))}
              {settings.antiGenres.length === 0 && (
                <span className="text-[13px] text-ink-faint">list is empty</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {genreOptions
                .filter((g) => !settings.antiGenres.includes(g))
                .slice(0, 4)
                .map((g) => (
                  <Chip key={g} onClick={() => toggleArray("antiGenres", g)}>
                    + {g}
                  </Chip>
                ))}
            </div>
          </div>
        </Group>

        {/* Privacy */}
        <Group title="Privacy">
          <div className="flex items-center gap-3.5 border-b border-hairline px-4 py-3.5">
            <span className="shrink-0 text-ink-dim">
              {settings.fingerprintVisibility === "matches_only" ? <EyeOff size={17} /> : <Eye size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium text-ink">Fingerprint visible before matching</p>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                off = matches-only (enforced by RLS, not just UI)
              </p>
            </div>
            <Switch
              checked={settings.fingerprintVisibility === "before_matching"}
              onCheckedChange={(v) => setSetting("fingerprintVisibility", v ? "before_matching" : "matches_only")}
            />
          </div>
          <Row
            label="Incognito browsing"
            desc="visible only to people you resonate with"
            right={
              <div className="flex items-center gap-2">
                <PremiumTag />
                <Switch checked={false} disabled onCheckedChange={() => {}} />
              </div>
            }
            onClick={() => toast("Incognito is a Premium perk — stub for now")}
          />
          <Row
            label="Read receipts"
            desc="off by default, even when subscribed"
            last
            right={
              <div className="flex items-center gap-2">
                <PremiumTag />
                <Switch checked={false} disabled onCheckedChange={() => {}} />
              </div>
            }
            onClick={() => toast("Read receipts are Premium — stub for now")}
          />
        </Group>

        {/* Verification */}
        <Group title="Verification">
          <Row
            label="Photo verification"
            desc="liveness-checked · badge active since today"
            right={<BadgeCheck size={19} className="shrink-0 text-flame" />}
            onClick={() => toast("Re-running liveness check (stub)")}
          />
          <Row
            label="Verified Fingerprint badge"
            desc="separate from photos — proves real, aged account"
            last
            right={<Shield size={17} className="shrink-0 text-flame" />}
            onClick={() => toast("Fingerprint verified — bot engagement filter passed")}
          />
        </Group>

        {/* Subscription */}
        <Group title="Subscription & billing">
          <div className="border-b border-hairline bg-flame/6 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14.5px] font-medium text-ink">Free tier — active</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-dim">
                  Full Feed + Matrix · unlimited messages · 15-min sessions ·
                  3 resonates/day
                </p>
              </div>
              <Sparkles size={18} className="shrink-0 text-flame" />
            </div>
          </div>
          <Row
            label="Cultured Premium"
            desc="unlimited resonates · rewind · receipts · incognito · $9.99/mo"
            right={<ChevronRight size={16} className="text-ink-faint" />}
            onClick={() => toast("Premium checkout — stub")}
          />
          <Row
            label="Playlist Pass"
            desc="removes the 15-min listening cap · one-time $4.99"
            right={<ChevronRight size={16} className="text-ink-faint" />}
            onClick={() => toast("Playlist Pass IAP — stub")}
          />
          <Row
            label="Meme Pack drops"
            desc="licensed packs for the Feed — revenue-safe content"
            right={<ChevronRight size={16} className="text-ink-faint" />}
            onClick={() => toast("Meme Pack store — stub")}
          />
          <Row
            label="Compatibility deep-dive"
            desc="per-match “why you scored 87%” report · $1.99"
            last
            right={<ChevronRight size={16} className="text-ink-faint" />}
            onClick={() => toast("Deep-dive IAP — stub")}
          />
        </Group>

        {/* Safety */}
        <Group title="Safety Center">
          <Row
            label="Policies in plain language"
            desc="reporting, moderation, repeat-infringer policy"
            onClick={() => setDangerSheet("safety")}
          />
          <Row
            label="Share my date's profile with a friend"
            desc="one tap, sends a link outside the app"
            last
            onClick={() => toast("Safety link shared (demo)")}
          />
        </Group>

        {/* Notifications */}
        <Group title="Notification preferences">
          {(
            [
              ["notifMatches", "New matches", true],
              ["notifMessages", "Messages", true],
              ["notifFeed", "Feed activity", false],
              ["notifDailyDrop", "Daily Drop", false],
              ["notifMarketing", "Marketing", false],
            ] as const
          ).map(([key, label, defaultHint], i, arr) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3.5",
                i < arr.length - 1 && "border-b border-hairline"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-ink">{label}</p>
                {!defaultHint && (
                  <p className="mt-0.5 text-[12px] text-ink-faint">defaults off</p>
                )}
              </div>
              <Switch checked={settings[key]} onCheckedChange={(v) => setSetting(key, v)} />
            </div>
          ))}
        </Group>

        {/* Account */}
        <Group title="Account">
          <Row
            label="Deactivate account"
            desc="soft pause — reversible anytime"
            danger
            onClick={() => setDangerSheet("deactivate")}
          />
          <Row
            label="Delete account"
            desc="hard delete with a 7-day cooling-off window"
            danger
            last
            right={<Trash2 size={16} className="shrink-0 text-[#e05d5d]" />}
            onClick={() => setDangerSheet("delete")}
          />
        </Group>

        <p className="px-1 text-center text-[11.5px] leading-relaxed text-ink-faint">
          Cultured · prototype build · core loop free forever
        </p>
      </div>

      {/* add genre sheet */}
      <Sheet open={addGenre} onClose={() => setAddGenre(false)} title="Add genre tag">
        <div className="flex flex-wrap gap-2 pb-3">
          {genreOptions
            .filter((g) => !settings.genreTags.includes(g))
            .map((g) => (
              <Chip
                key={g}
                onClick={() => {
                  toggleArray("genreTags", g);
                  toast(`Added “${g}” to your fingerprint`);
                }}
              >
                + {g}
              </Chip>
            ))}
        </div>
      </Sheet>

      {/* confirm sheets */}
      <Sheet
        open={dangerSheet !== null && dangerSheet !== "safety"}
        onClose={() => setDangerSheet(null)}
        title={dangerSheet === "delete" ? "Delete account?" : "Deactivate account?"}
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink-dim">
            {dangerSheet === "delete"
              ? "Your fingerprint, matches, and messages are scheduled for permanent deletion after a 7-day cooling-off window. Reactivate within 7 days and everything comes back."
              : "Your profile leaves the Matrix immediately. Matches keep their threads — reactivate whenever you like, no penalty."}
          </p>
          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setDangerSheet(null)}>
              Cancel
            </Button>
            <Button
              variant="flame"
              className="flex-1"
              onClick={() => {
                toast(
                  dangerSheet === "delete"
                    ? "Deletion scheduled — 7-day cooling-off started"
                    : "Account deactivated — see you soon"
                );
                setDangerSheet(null);
              }}
            >
              {dangerSheet === "delete" ? "Schedule deletion" : "Deactivate"}
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={dangerSheet === "safety"} onClose={() => setDangerSheet(null)} title="Safety, plainly">
        <div className="flex flex-col gap-3 pb-3 text-[14px] leading-relaxed text-ink-dim">
          <p>• Every profile is liveness-verified before it enters the Matrix.</p>
          <p>• Reports go to a human queue — “vibe-report” quietly recalibrates the algorithm without punishing anyone.</p>
          <p>• Repeat infringers lose posting rights; DMCA takedowns run on a published clock.</p>
          <p>• Never any guilt-trip notifications or engagement dark patterns — those are banned at the product level.</p>
          <div className="pt-1">
            <Button
              variant="flame"
              className="w-full"
              onClick={() => {
                toast("Date profile link copied for your friend");
                setDangerSheet(null);
              }}
            >
              <UserX size={16} /> Share my date's profile
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
