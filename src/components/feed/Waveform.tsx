"use client";

import { useEffect, useRef } from "react";
import { makeWave } from "@/lib/utils";
import { useAppReduced } from "@/lib/motion";

/**
 * Canvas waveform driven by a mock amplitude array on requestAnimationFrame.
 * Starts/stops on play/pause — NOT a video (spec).
 */
export function Waveform({
  seed,
  playing,
  height = 44,
  className,
  progress = -1,
}: {
  seed: number;
  playing: boolean;
  height?: number;
  className?: string;
  /** 0..1 — when provided, bars after progress render dim */
  progress?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ampsRef = useRef<number[]>(makeWave(seed));
  const rafRef = useRef(0);
  const phaseRef = useRef(0);
  const reduced = useAppReduced();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.scale(dpr, dpr);

    const amps = ampsRef.current;
    const gap = 3;
    const barW = Math.max(2, (w - gap * (amps.length - 1)) / amps.length);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < amps.length; i++) {
        const idle = amps[i];
        const wobble =
          playing && !reduced
            ? 0.75 + 0.25 * Math.sin(phaseRef.current + i * 0.55)
            : 1;
        const bh = Math.max(3, idle * (h - 6) * wobble);
        const x = i * (barW + gap);
        const y = (h - bh) / 2;
        const past = progress >= 0 ? i / amps.length <= progress : true;
        ctx.fillStyle = past
          ? playing
            ? "#7C5CFF"
            : "rgba(245,241,234,0.55)"
          : "rgba(245,241,234,0.16)";
        ctx.beginPath();
        const r = Math.min(barW / 2, 2);
        ctx.roundRect(x, y, barW, bh, r);
        ctx.fill();
      }
    };

    const loop = () => {
      phaseRef.current += 0.14;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    if (playing && !reduced) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, height, progress, reduced]);

  return <canvas ref={canvasRef} className={className} style={{ height, width: "100%" }} />;
}
