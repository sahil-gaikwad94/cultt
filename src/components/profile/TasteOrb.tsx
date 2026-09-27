"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useAppReduced } from "@/lib/motion";

const TasteOrbCanvas = dynamic(() => import("./TasteOrbCanvas"), {
  ssr: false,
});

/**
 * Interactive 3D taste fingerprint — a draggable constellation sphere.
 * The canvas is lazy (ssr:false); pointer velocity lives in a shared ref
 * so the R3F loop can damp flicks without re-renders.
 */
export default function TasteOrb() {
  const reduced = useAppReduced();
  const drag = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
    rotX: -0.18,
    rotY: 0.4,
  });

  const onDown = (e: React.PointerEvent) => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    drag.current.velX = 0;
    drag.current.velY = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.rotY += dx * 0.008;
    d.rotX += dy * 0.006;
    d.velX = dx * 0.35;
    d.velY = dy * 0.28;
  };
  const onUp = () => {
    drag.current.active = false;
  };

  return (
    <div className="card relative h-[236px] overflow-hidden !rounded-[24px]">
      <div aria-hidden className="aurora" />
      <span className="mono-label absolute left-4 top-3.5 z-10 !text-[9.5px]">
        taste fingerprint · 3d
      </span>
      <div
        className="absolute inset-0 touch-none"
        style={{ cursor: reduced ? "default" : "grab" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <TasteOrbCanvas drag={drag} autoSpin={!reduced} />
      </div>
      <span className="mono-label absolute bottom-3 left-1/2 z-10 -translate-x-1/2 !text-[9px] !text-ink-faint">
        {reduced ? "your culture, in orbit" : "drag to spin · your culture in orbit"}
      </span>
    </div>
  );
}
