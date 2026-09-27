"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useAppReduced } from "@/lib/motion";

/**
 * THE one 3D surface in the whole app: a slowly rotating vinyl record with
 * a floating meme-card cluster, behind the onboarding welcome headline.
 * Lazy-loaded (dynamic import, ssr: false) so it never blocks first paint.
 */

function Vinyl() {
  const spin = useRef<THREE.Group>(null);
  const reduced = useAppReduced();
  useFrame((state, delta) => {
    if (spin.current && !reduced) spin.current.rotation.z += delta * 0.55;
    if (spin.current && !reduced) {
      spin.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;
      spin.current.rotation.y = Math.cos(state.clock.elapsedTime * 0.3) * 0.16;
    }
  });

  const grooves = [];
  for (let r = 0.78; r <= 1.62; r += 0.07) {
    grooves.push(
      <mesh key={r}>
        <ringGeometry args={[r, r + 0.012, 96]} />
        <meshBasicMaterial color="#1a1b27" transparent opacity={0.9} />
      </mesh>
    );
  }

  return (
    <group ref={spin}>
      {/* disc */}
      <mesh>
        <circleGeometry args={[1.7, 96]} />
        <meshStandardMaterial color="#0d0e16" roughness={0.35} metalness={0.25} />
      </mesh>
      {grooves}
      {/* label */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[0.58, 64]} />
        <meshStandardMaterial color="#7C5CFF" roughness={0.55} />
      </mesh>
      {/* spindle hole */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial color="#0A0B12" />
      </mesh>
      {/* sheen */}
      <mesh position={[0, 0, 0.03]} rotation={[0, 0, 0.4]}>
        <planeGeometry args={[3.1, 0.5]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

function MemeCards() {
  const group = useRef<THREE.Group>(null);
  const reduced = useAppReduced();
  useFrame((state) => {
    if (!group.current || reduced) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.12;
    group.current.children.forEach((child, i) => {
      child.position.y += Math.sin(t * 0.7 + i * 1.8) * 0.0016;
      child.rotation.z = Math.sin(t * 0.5 + i) * 0.18;
    });
  });

  const cards: { pos: [number, number, number]; color: string; rot: number }[] = [
    { pos: [-2.5, 1.35, -0.4], color: "#7C5CFF", rot: 0.28 },
    { pos: [2.55, -0.4, -0.6], color: "#A78BFA", rot: -0.32 },
    { pos: [-2.2, -1.5, -0.2], color: "#22D3EE", rot: -0.18 },
    { pos: [2.1, 1.6, -0.9], color: "#5B5FE0", rot: 0.4 },
    { pos: [-2.9, -1.9, -1.1], color: "#8B7BF7", rot: 0.1 },
  ];

  return (
    <group ref={group}>
      {cards.map((c, i) => (
        <group key={i} position={c.pos} rotation={[0, 0, c.rot]}>
          <RoundedBox args={[1.15, 1.45, 0.05]} radius={0.09} smoothness={4}>
            <meshStandardMaterial color={c.color} roughness={0.5} metalness={0.05} />
          </RoundedBox>
          {/* caption lines on the mini meme cards */}
          <mesh position={[0, 0.4, 0.03]}>
            <planeGeometry args={[0.75, 0.07]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.2, 0.03]}>
            <planeGeometry args={[0.5, 0.07]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, -0.42, 0.03]}>
            <planeGeometry args={[0.68, 0.07]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function VinylScene() {
  const reduced = useAppReduced();
  if (reduced) return null; // 3D disabled under prefers-reduced-motion
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5.4], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#7C5CFF" />
      <group position={[0.1, 0.62, 0]} scale={0.82}>
        <Vinyl />
      </group>
      <MemeCards />
    </Canvas>
  );
}
