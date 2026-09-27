"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BadgeCheck,
  Bell,
  Check,
  Camera,
  Loader2,
  Mail,
  MapPin,
  Music4,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { GradientTile } from "@/components/ui/GradientTile";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toaster";
import { useAppStore } from "@/lib/store";
import { genreOptions, GRADIENTS } from "@/lib/mockData";
import { useAppReduced, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* shared step scaffolding */
export function StepShell({
  title,
  sub,
  children,
  footer,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col px-6">
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-4">
        <h1 className="font-display text-[28px] font-medium leading-[1.15] tracking-tight text-ink">
          {title}
        </h1>
        {sub && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-dim">{sub}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <div className="shrink-0 pt-4">{footer}</div>}
    </div>
  );
}

/* ── 1b. Auth — phone/email + 18+ age gate (client-side format check only) ── */
export function AuthStep({ onDone }: { onDone: () => void }) {
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");
  const [ageOk, setAgeOk] = useState(false);

  const valid =
    method === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
      : /^[+]?[\d\s().-]{7,}$/.test(value);

  return (
    <StepShell
      title="How do we reach you?"
      sub="Standard sign-in, plus a hard 18+ gate. No catfish, no exceptions."
      footer={
        <Button variant="flame" size="lg" className="w-full" disabled={!valid || !ageOk} onClick={onDone}>
          Continue
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          id="auth-method"
          value={method}
          onChange={(m) => {
            setMethod(m);
            setValue("");
          }}
          options={[
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
          ]}
          className="w-full"
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            {method === "email" ? <Mail size={17} /> : <Phone size={17} />}
          </span>
          <input
            type={method === "email" ? "email" : "tel"}
            inputMode={method === "email" ? "email" : "tel"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={method === "email" ? "you@somewhere.com" : "+1 (555) 000-0000"}
            className="h-13 w-full rounded-[16px] border border-hairline bg-panel-2 pl-12 pr-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-flame/50 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setAgeOk((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 rounded-[16px] border p-4 text-left transition-colors",
            ageOk ? "border-flame/50 bg-flame/8" : "border-hairline bg-panel"
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border transition-colors",
              ageOk ? "border-flame bg-flame text-flame-ink" : "border-hairline bg-panel-2"
            )}
          >
            {ageOk && <Check size={15} strokeWidth={3} />}
          </span>
          <span className="text-[14px] leading-snug text-ink-dim">
            I&apos;m 18 or older. Everyone here is too — verification checks it
            again later.
          </span>
        </button>

        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          By continuing you agree to the community guidelines and Safety Center
          policy. We never gate seeing likes or messaging behind a paywall —
          that&apos;s a promise, not a tier.
        </p>
      </div>
    </StepShell>
  );
}

/* ── 1c. Photo verification — fake 2s liveness check ── */
export function VerifyStep({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<"idle" | "checking" | "verified">("idle");
  const reduced = useAppReduced();

  useEffect(() => {
    if (state !== "checking") return;
    const t = setTimeout(() => setState("verified"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <StepShell
      title={state === "verified" ? "Verified." : "Liveness check"}
      sub={
        state === "verified"
          ? "Your selfie matches your profile photos. Verified badge shows as a small check — never a banner."
          : "A quick real-time selfie check keeps scammers and impersonators out of the Matrix. It's mandatory, not optional."
      }
      footer={
        <Button
          variant="flame"
          size="lg"
          className="w-full"
          disabled={state !== "verified"}
          onClick={onDone}
        >
          {state === "verified" ? "Continue" : "Continue"}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="relative">
          <motion.div
            animate={
              state === "checking" && !reduced
                ? { scale: [1, 1.04, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 1, repeat: state === "checking" ? Infinity : 0 }}
            className={cn(
              "flex h-40 w-40 items-center justify-center rounded-full border-2 transition-colors",
              state === "verified"
                ? "border-flame bg-flame/10 text-flame"
                : "border-hairline bg-panel-2 text-ink-dim"
            )}
          >
            {state === "idle" && <Camera size={52} strokeWidth={1.5} />}
            {state === "checking" && <Loader2 size={44} strokeWidth={1.5} className="animate-spin" />}
            {state === "verified" && (
              <motion.span
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : SPRING}
              >
                <BadgeCheck size={64} strokeWidth={1.5} />
              </motion.span>
            )}
          </motion.div>
          {state === "checking" && !reduced && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-flame"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.25 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </div>

        <div className="flex items-center gap-2 text-[13px] text-ink-dim">
          {state === "idle" && (
            <Button onClick={() => setState("checking")} variant="neutral">
              <Camera size={16} /> Start liveness check
            </Button>
          )}
          {state === "checking" && (
            <span className="animate-pulse">blinking… tilting… hold steady</span>
          )}
          {state === "verified" && (
            <span className="flex items-center gap-1.5 text-flame">
              <ShieldCheck size={16} /> identity confirmed
            </span>
          )}
        </div>
      </div>
    </StepShell>
  );
}

/* ── 1d. Spotify connect — stub OAuth + genre fallback ── */
export function SpotifyStep({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "connected" | "manual">("idle");
  const setSpotify = useAppStore((s) => s.setSpotify);
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>([]);

  const connect = () => {
    setPhase("connecting");
    setTimeout(() => {
      setPhase("connected");
      setSpotify(true);
      toast("Top artists synced — you can edit genre tags anytime");
    }, 1200);
  };

  const canContinue = phase === "connected" || (phase === "manual" && picked.length >= 3);

  return (
    <StepShell
      title="What's on repeat?"
      sub="Connect Spotify for a one-time pull of your top artists — or skip and pick genres by hand."
      footer={
        <Button
          variant="flame"
          size="lg"
          className="w-full"
          disabled={!canContinue}
          onClick={() => {
            if (phase === "manual") picked.forEach(() => undefined);
            onDone();
          }}
        >
          Continue
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {(phase === "idle" || phase === "connecting") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[18px] border border-hairline bg-panel p-5"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel-2 text-flame">
                <Music4 size={20} strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[15px] font-medium text-ink">Spotify OAuth</p>
                <p className="text-[12.5px] text-ink-faint">
                  one pull at signup · Last.fm keeps it fresh after
                </p>
              </div>
            </div>
            <Button
              variant="neutral"
              size="lg"
              className="w-full"
              onClick={connect}
              disabled={phase === "connecting"}
            >
              {phase === "connecting" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Connecting…
                </>
              ) : (
                "Connect Spotify"
              )}
            </Button>
            <button
              onClick={() => setPhase("manual")}
              className="mt-3 w-full text-center text-[13px] text-ink-faint underline-offset-4 hover:text-ink-dim hover:underline"
            >
              skip — I&apos;ll pick genres myself
            </button>
          </motion.div>
        )}

        {phase === "connected" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className="rounded-[18px] border border-flame/40 bg-flame/8 p-5 text-center"
          >
            <BadgeCheck size={36} className="mx-auto text-flame" strokeWidth={1.6} />
            <p className="mt-3 text-[15px] font-medium text-ink">Connected</p>
            <p className="mt-1 text-[13px] text-ink-dim">
              Fred again.., SZA, Bad Bunny, Jamie xx, Laufey — that&apos;s your
              music vector seeded.
            </p>
          </motion.div>
        )}

        {phase === "manual" && (
          <div>
            <p className="mb-3 text-[13px] text-ink-dim">
              Pick at least 3 — these seed your music vector cold-start.{" "}
              <span className="text-flame">{picked.length}/3</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {genreOptions.map((g) => (
                <Chip key={g} active={picked.includes(g)} onClick={() => {
                  setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
                }}>
                  {g}
                </Chip>
              ))}
            </div>
            <button
              onClick={() => setPhase("idle")}
              className="mt-4 text-[13px] text-ink-faint underline-offset-4 hover:text-ink-dim hover:underline"
            >
              actually, connect Spotify instead
            </button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

/* ── 1g. Photos & bio ── */
export function PhotosBioStep({ onDone }: { onDone: () => void }) {
  const profileName = useAppStore((s) => s.profileName);
  const profileAge = useAppStore((s) => s.profileAge);
  const profileCity = useAppStore((s) => s.profileCity);
  const profileBio = useAppStore((s) => s.profileBio);
  const lookingFor = useAppStore((s) => s.lookingFor);
  const photoSlots = useAppStore((s) => s.photoSlots);
  const setPhotoSlot = useAppStore((s) => s.setPhotoSlot);
  const setProfile = useAppStore((s) => s.setProfile);
  const toast = useToast();

  const [name, setName] = useState(profileName);
  const [age, setAge] = useState(String(profileAge));
  const [city, setCity] = useState(profileCity);
  const [bio, setBio] = useState(profileBio);
  const filled = photoSlots.filter(Boolean).length;
  const valid = name.trim().length >= 2 && Number(age) >= 18 && city.trim().length >= 2;

  return (
    <StepShell
      title="Photos, bio, basics"
      sub="Equal weight to your fingerprint — never the hero. 2–6 photos does it."
      footer={
        <Button
          variant="flame"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            setProfile({
              profileName: name.trim(),
              profileAge: Math.max(18, Number(age) || 18),
              profileCity: city.trim(),
              profileBio: bio.trim(),
              lookingFor,
            });
            onDone();
          }}
        >
          Continue
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* photo slots */}
        <div className="grid grid-cols-3 gap-2.5">
          {photoSlots.map((slot, i) =>
            slot ? (
              <GradientTile key={i} gradient={slot} square className="rounded-[14px] border border-hairline">
                <button
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotoSlot(i, null)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                >
                  ×
                </button>
              </GradientTile>
            ) : (
              <button
                key={i}
                aria-label={`Add photo ${i + 1}`}
                onClick={() => {
                  setPhotoSlot(i, GRADIENTS[(i * 5 + filled) % GRADIENTS.length]);
                  toast("Photo added (demo roll)");
                }}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-hairline bg-panel text-ink-faint hover:border-flame/40"
              >
                <Camera size={17} />
                <span className="text-[10px]">add</span>
              </button>
            )
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Name" value={name} onChange={setName} className="col-span-2" />
          <Field label="Age" value={age} onChange={setAge} inputMode="numeric" />
        </div>
        <Field label="Location" value={city} onChange={setCity} icon={<MapPin size={15} />} />

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 240))}
            rows={3}
            placeholder="one bit, perfectly executed…"
            className="w-full resize-none rounded-[16px] border border-hairline bg-panel-2 p-3.5 text-[14.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-flame/50 focus:outline-none"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-ink-faint">{bio.length}/240</p>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            I&apos;m here for
          </p>
          <Segmented
            id="looking-for"
            value={lookingFor}
            onChange={(v) => setProfile({ lookingFor: v })}
            options={[
              { value: "dating", label: "Dating" },
              { value: "friends", label: "Friends" },
            ]}
            className="w-full"
          />
          <p className="mt-2 text-[11.5px] text-ink-faint">
            same fingerprint either way — just a different pool and card copy.
          </p>
        </div>
      </div>
    </StepShell>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  icon,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  icon?: React.ReactNode;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">{icon}</span>
        )}
        <input
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 w-full rounded-[14px] border border-hairline bg-panel-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-flame/50 focus:outline-none",
            icon ? "pl-10 pr-3.5" : "px-3.5"
          )}
        />
      </div>
    </div>
  );
}

/* ── 1h. Permissions — asked last, after value is shown ── */
export function PermissionsStep({ onDone }: { onDone: () => void }) {
  const setPermission = useAppStore((s) => s.setPermission);
  const [stage, setStage] = useState<"notifications" | "location" | "done">("notifications");
  const reduced = useAppReduced();

  const card =
    stage === "notifications" ? (
      <PermCard
        icon={<Bell size={30} strokeWidth={1.6} />}
        title="Stay in the loop?"
        body="New resonances and messages — plus an optional Daily Drop ping. You choose the categories next; matches and messages default on, everything else defaults off."
        allowLabel="Allow notifications"
        onAllow={() => {
          setPermission("notifications", true);
          setStage("location");
        }}
        onSkip={() => {
          setPermission("notifications", false);
          setStage("location");
        }}
      />
    ) : stage === "location" ? (
      <PermCard
        icon={<MapPin size={30} strokeWidth={1.6} />}
        title="Distance, not a tracking dot?"
        body="Location powers the km chip and 'near you' signals. We show distance, never a pinpoint — and only after you've seen the app work."
        allowLabel="Allow location"
        onAllow={() => {
          setPermission("location", true);
          setStage("done");
        }}
        onSkip={() => {
          setPermission("location", false);
          setStage("done");
        }}
      />
    ) : (
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
        className="flex flex-col items-center gap-4 rounded-[20px] border border-flame/40 bg-flame/8 px-6 py-10 text-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-flame text-flame-ink">
          <Check size={30} strokeWidth={2.5} />
        </span>
        <div>
          <p className="font-display text-[24px] font-medium text-ink">You&apos;re in.</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-dim">
            Humor vector seeded, music vector calibrated, photos locked — the
            Matrix already has real signal. No cold-start blank profile.
          </p>
        </div>
      </motion.div>
    );

  return (
    <StepShell
      title={stage === "done" ? "Value first, asks last." : "Two quick asks"}
      sub={
        stage === "done"
          ? "Permissions only ever come after the app has shown you something worth allowing for."
          : undefined
      }
      footer={
        stage === "done" ? (
          <Button variant="flame" size="lg" className="w-full" onClick={onDone}>
            Enter the Culture Feed
          </Button>
        ) : undefined
      }
    >
      {card}
    </StepShell>
  );
}

function PermCard({
  icon,
  title,
  body,
  allowLabel,
  onAllow,
  onSkip,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  allowLabel: string;
  onAllow: () => void;
  onSkip: () => void;
}) {
  const reduced = useAppReduced();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="flex flex-col gap-5 rounded-[20px] border border-hairline bg-panel p-6"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-panel-2 text-flame">
        {icon}
      </span>
      <div>
        <p className="font-display text-[21px] font-medium text-ink">{title}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{body}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="flame" size="lg" onClick={onAllow}>
          {allowLabel}
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Maybe later
        </Button>
      </div>
    </motion.div>
  );
}
