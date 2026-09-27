"use client";

import { useEffect, useRef } from "react";
import { useAppReduced } from "@/lib/motion";

/**
 * Muted ambient background for the welcome carousel — procedurally animated
 * mesh-gradient blobs (stands in for looping video: same role, zero payload,
 * no autoplay-video battery cost). One instance; palette lerps per slide.
 */

export type AmbientPalette = {
  blobs: [number, number, number][]; // rgb triples
  bg: string;
};

export const AMBIENT_PALETTES: AmbientPalette[] = [
  {
    bg: "#17130f",
    blobs: [
      [255, 107, 74],
      [122, 46, 142],
      [232, 71, 109],
    ],
  },
  {
    bg: "#0f1417",
    blobs: [
      [42, 157, 143],
      [66, 114, 198],
      [255, 107, 74],
    ],
  },
  {
    bg: "#14101c",
    blobs: [
      [151, 51, 238],
      [67, 203, 255],
      [255, 107, 74],
    ],
  },
];

export function AmbientCanvas({ palette }: { palette: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef(palette);
  const reduced = useAppReduced();
  paletteRef.current = palette;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // smoothed color state per blob
    const current: number[][] = AMBIENT_PALETTES[paletteRef.current].blobs.map((b) => [...b]);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const pal = AMBIENT_PALETTES[paletteRef.current];

      // ease palette toward target
      pal.blobs.forEach((target, i) => {
        for (let c = 0; c < 3; c++) {
          current[i]![c] = current[i]![c]! + (target[c]! - current[i]![c]!) * 0.04;
        }
      });

      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < 3; i++) {
        const phase = t * 0.00022 + i * 2.1;
        const cx = w * (0.5 + 0.32 * Math.sin(phase * 1.3 + i));
        const cy = h * (0.5 + 0.34 * Math.cos(phase + i * 1.7));
        const r = Math.max(w, h) * (0.42 + 0.1 * Math.sin(phase * 0.7));
        const [cr, cg, cb] = current[i]!;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, 0.55)`);
        g.addColorStop(1, `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "source-over";
      // vignette for text legibility
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    };

    if (reduced) {
      draw();
    } else {
      const loop = (ts: number) => {
        t = ts;
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
}
