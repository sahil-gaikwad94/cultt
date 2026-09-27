"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import gsap from "gsap";
import { ChevronLeft } from "lucide-react";
import { AMBIENT_PALETTES, AmbientCanvas } from "./AmbientCanvas";
import { AuthStep, PhotosBioStep, PermissionsStep, SpotifyStep, VerifyStep } from "./steps";
import { MemeCalibration, MusicCalibration } from "./Calibration";
import { useAppStore, type OnboardingStep } from "@/lib/store";
import { useAppReduced } from "@/lib/motion";
import { useToast } from "@/components/ui/Toaster";
import { Button } from "@/components/ui/Button";

const VinylScene = dynamic(() => import("./VinylScene"), {
  ssr: false,
  loading: () => null,
});

const STEPS: OnboardingStep[] = [
  "welcome", "auth", "verify", "spotify", "meme", "music", "photos", "permissions",
];

const SLIDES = [
  {
    headline: "Match on your humor,\nnot your headshot.",
    sub: "Cultured reads your taste in memes and music before anyone sees a photo. The vibe is the profile.",
  },
  {
    headline: "Every match starts from\na shared laugh or a track.",
    sub: "Every Matrix card shows a Taste Twins score first — compatibility you can read, not infer.",
  },
  {
    headline: "Browse the culture.\nJudge in one place.",
    sub: "The Feed is passive by design. Evaluating people only ever happens in the Match Matrix.",
  },
];

export default function OnboardingFlow() {
  const router = useRouter();
  const toast = useToast();
  const reduced = useAppReduced();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [dir, setDir] = useState<1 | -1>(1);

  const setStepPersist = useAppStore((s) => s.setOnboardingStep);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const idx = STEPS.indexOf(step);

  const go = (next: OnboardingStep, direction: 1 | -1 = 1) => {
    setDir(direction);
    setStep(next);
    setStepPersist(next);
  };

  const goNext = () => {
    if (idx < STEPS.length - 1) go(STEPS[idx + 1]!, 1);
  };
  const goBack = () => {
    if (idx > 0) go(STEPS[idx - 1]!, -1);
  };

  const finish = () => {
    completeOnboarding();
    router.replace("/feed");
  };

  /* resume mid-flow AFTER mount (no SSR hydration branch) */
  useEffect(() => {
    const saved = useAppStore.getState().onboardingStep;
    if (saved && saved !== step) {
      setStep(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepBody = useMemo(() => {
    switch (step) {
      case "welcome":
        return <WelcomeCarousel onNext={goNext} />;
      case "auth":
        return <AuthStep onDone={goNext} />;
      case "verify":
        return <VerifyStep onDone={goNext} />;
      case "spotify":
        return <SpotifyStep onDone={goNext} />;
      case "meme":
        return <MemeCalibration onDone={goNext} />;
      case "music":
        return <MusicCalibration onDone={goNext} />;
      case "photos":
        return <PhotosBioStep onDone={goNext} />;
      case "permissions":
        return <PermissionsStep onDone={finish} />;
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="fixed inset-0 flex h-[100dvh] flex-col bg-canvas">
      {/* progress dots at top (welcome has its own slide dots) */}
      {step !== "welcome" && (
        <header className="safe-t z-40 flex shrink-0 items-center gap-3 px-4 pb-1 pt-2">
          <button
            onClick={goBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full glass text-ink"
          >
            <ChevronLeft size={19} />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={
                  i === idx
                    ? "h-2.5 w-7 rounded-full bg-flame shadow-[0_0_14px_rgba(255,107,74,0.6)] transition-all"
                    : i < idx
                      ? "h-1.5 w-1.5 rounded-full bg-flame/50 transition-all"
                      : "h-1.5 w-1.5 rounded-full bg-panel-2 border border-hairline transition-all"
                }
              />
            ))}
          </div>
          <span className="w-10 text-right text-[11px] tabular-nums text-ink-faint">
            {idx + 1}/{STEPS.length}
          </span>
        </header>
      )}

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 52, scale: 0.975 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -34, scale: 0.975 }}
            transition={reduced ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {stepBody}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── welcome carousel: ambient canvas + R3F vinyl + GSAP parallax ── */
function WelcomeCarousel({ onNext }: { onNext: () => void }) {
  const reduced = useAppReduced();
  const toast = useToast();
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const widthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 390);
  const [slide, setSlide] = useState(0);
  const x = useMotionValue(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const bgShift = useRef<((v: number) => void) | null>(null);
  const vinylShift = useRef<((v: number) => void) | null>(null);

  /* GSAP: smooth quickTo targets driven by drag progress */
  useEffect(() => {
    if (reduced) return;
    bgShift.current = gsap.quickTo(document.getElementById("onb-ambient"), "x", {
      duration: 0.5,
      ease: "power2.out",
    });
    vinylShift.current = gsap.quickTo(document.getElementById("onb-vinyl"), "x", {
      duration: 0.6,
      ease: "power2.out",
    });
    const unsub = x.on("change", (v) => {
      bgShift.current?.(v * 0.35);
      vinylShift.current?.(v * 0.18);
    });
    return () => {
      unsub();
      gsap.killTweensOf("#onb-ambient, #onb-vinyl");
    };
  }, [x, reduced]);

  /* GSAP headline stagger on slide change */
  useEffect(() => {
    if (reduced) return;
    const lines = document.querySelectorAll(`[data-slide="${slide}"] .onb-line`);
    if (!lines.length) return;
    gsap.fromTo(
      lines,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.09, duration: 0.65, ease: "power3.out", overwrite: true }
    );
  }, [slide, reduced]);

  useEffect(() => {
    const onResize = () => {
      widthRef.current = window.innerWidth;
      x.set(-slide * widthRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [slide, x]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setSlide(clamped);
    if (reduced) x.set(-clamped * widthRef.current);
    else {
      import("motion/react").then(({ animate }) =>
        animate(x, -clamped * widthRef.current, { type: "spring", stiffness: 260, damping: 32 })
      );
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = widthRef.current * 0.22;
    if (info.offset.x < -threshold || info.velocity.x < -500) goTo(slide + 1);
    else if (info.offset.x > threshold || info.velocity.x > 500) goTo(slide - 1);
    else if (!reduced)
      import("motion/react").then(({ animate }) =>
        animate(x, -slide * widthRef.current, { type: "spring", stiffness: 300, damping: 30 })
      );
    else x.set(-slide * widthRef.current);
  };

  return (
    <div ref={stageRef} className="relative h-full overflow-hidden">
      {/* ambient “video” — welcome carousel only */}
      <div id="onb-ambient" className="absolute -inset-x-16 inset-y-0">
        <AmbientCanvas palette={slide} />
      </div>

      {/* THE single 3D surface */}
      {!reduced && (
        <div id="onb-vinyl" className="pointer-events-none absolute inset-0">
          <VinylScene />
        </div>
      )}

      {/* top brand */}
      <div className="safe-t absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 pt-3">
        <span className="font-mono text-[13px] font-semibold tracking-[0.44em] text-white/90 text-sheet">
          CULTURED
        </span>
      </div>

      {/* slide track */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -(SLIDES.length - 1) * widthRef.current, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="absolute inset-y-0 left-0 flex cursor-grab touch-pan-y active:cursor-grabbing"
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            data-slide={i}
            className="flex h-full w-screen flex-col items-center justify-center px-8 text-center"
            style={{ width: widthRef.current }}
          >
            <div className="relative z-10 max-w-[440px]">
              <h1 className="onb-line whitespace-pre-line font-display text-[clamp(32px,9.4vw,46px)] font-medium leading-[1.06] tracking-[-0.025em] text-white text-sheet">
                {s.headline}
              </h1>
              <p className="onb-line mx-auto mt-5 max-w-[350px] text-[15.5px] leading-relaxed text-white/85 text-sheet">
                {s.sub}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* bottom controls */}
      <div className="safe-b absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-5 px-8 pb-6">
        <div className="flex gap-2.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === slide
                  ? "w-8 bg-flame shadow-[0_0_16px_rgba(255,107,74,0.7)]"
                  : "w-2.5 bg-white/35 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
        <div className="w-full max-w-[330px]">
          <Button
            variant="flame"
            size="lg"
            className="w-full shadow-[0_12px_40px_rgba(255,107,74,0.35)]"
            onClick={() => (slide < SLIDES.length - 1 ? goTo(slide + 1) : onNext())}
          >
            {slide < SLIDES.length - 1 ? "Next" : "Get started — I'm 18+"}
          </Button>
          <button
            onClick={() => {
              completeOnboarding();
              toast("Welcome back (demo sign-in)");
              router.replace("/feed");
            }}
            className="mt-3 w-full text-center text-[13.5px] text-white/70 underline-offset-4 hover:text-white hover:underline text-sheet"
          >
            I already have an account
          </button>
        </div>
        <p className="mono-label !text-[9.5px] text-white/55 text-sheet">swipe to explore →</p>
      </div>
    </div>
  );
}
