"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type DragState = {
  active: boolean;
  lastX: number;
  lastY: number;
  velX: number;
  velY: number;
  rotX: number;
  rotY: number;
};

function fibonacciSphere(count: number, radius: number): Float32Array {
  const pts = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts[i * 3] = Math.cos(theta) * r * radius;
    pts[i * 3 + 1] = y * radius;
    pts[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return pts;
}

function Orb({
  drag,
  autoSpin,
}: {
  drag: React.MutableRefObject<DragState>;
  autoSpin: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  const violet = useMemo(() => fibonacciSphere(150, 1.0), []);
  const cyan = useMemo(() => fibonacciSphere(42, 1.14), []);

  useFrame((_, delta) => {
    const d = drag.current;
    if (!group.current) return;
    if (!d.active) {
      /* flick momentum with decay */
      d.rotY += d.velX * delta;
      d.rotX += d.velY * delta;
      d.velX *= 0.94;
      d.velY *= 0.94;
      if (autoSpin) d.rotY += delta * 0.16;
    }
    /* damped follow */
    group.current.rotation.y += (d.rotY - group.current.rotation.y) * 0.14;
    group.current.rotation.x += (d.rotX - group.current.rotation.x) * 0.14;
  });

  return (
    <group ref={group}>
      {/* taste points — violet field */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[violet, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          sizeAttenuation
          color="#a78bfa"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* outer accents — culture sparks */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cyan, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.032}
          sizeAttenuation
          color="#22d3ee"
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* faint wire shell */}
      <mesh>
        <icosahedronGeometry args={[1.02, 1]} />
        <meshBasicMaterial
          color="#7c5cff"
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>
      {/* soft core */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.07} />
      </mesh>
      {/* orbit rings */}
      <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[1.3, 0.005, 6, 140]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 1.7, -0.5, 0.4]}>
        <torusGeometry args={[1.42, 0.004, 6, 140]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export default function TasteOrbCanvas({
  drag,
  autoSpin,
}: {
  drag: React.MutableRefObject<DragState>;
  autoSpin: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 3.1], fov: 46 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={1} />
      <Orb drag={drag} autoSpin={autoSpin} />
    </Canvas>
  );
}
