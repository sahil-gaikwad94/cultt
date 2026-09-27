import { cn, initials } from "@/lib/utils";

/**
 * Photo/art placeholder tiles — the ONLY place gradients are allowed
 * (product constraint: no gradients on UI chrome). Meme tiles get
 * Impact-style caption rendering so they read as real memes, not empty boxes.
 */

export function GradientTile({
  gradient,
  src,
  className,
  children,
  square,
}: {
  gradient: string;
  /** Optional AI-art image layered over the gradient (gradient = fallback). */
  src?: string;
  className?: string;
  children?: React.ReactNode;
  square?: boolean;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", square && "aspect-square", className)}
      style={{ background: gradient }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
      ) : null}
      {/* texture: soft light + fine dot grid so tiles feel art-directed */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.5px)",
          backgroundSize: "7px 7px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.18), transparent 55%)",
        }}
      />
      {children}
    </div>
  );
}

export function MemeFace({
  top,
  bottom,
  className,
}: {
  top?: string;
  bottom?: string;
  className?: string;
}) {
  if (!top && !bottom) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col justify-between p-4 text-center sm:p-5",
        className
      )}
    >
      <p className="meme-text">{top}</p>
      <p className="meme-text">{bottom}</p>
    </div>
  );
}

export function Avatar({
  gradient,
  name,
  size = 40,
  className,
}: {
  gradient: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline",
        className
      )}
      style={{ background: gradient, width: size, height: size }}
    >
      <span
        className="font-display font-semibold text-white text-sheet select-none"
        style={{ fontSize: size * 0.36 }}
      >
        {initials(name)}
      </span>
    </div>
  );
}
