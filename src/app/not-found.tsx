import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-canvas px-8 text-center">
      <span className="font-display text-4xl font-medium text-ink">404</span>
      <p className="max-w-xs text-sm text-ink-dim">
        This page drifted off the matrix. Your fingerprint is safe, though.
      </p>
      <Link href="/feed">
        <Button variant="flame">Back to the Feed</Button>
      </Link>
    </div>
  );
}
