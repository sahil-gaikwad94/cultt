"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

export default function WelcomePage() {
  const router = useRouter();
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && onboardingDone) router.replace("/feed");
  }, [hydrated, onboardingDone, router]);

  return <OnboardingFlow />;
}
