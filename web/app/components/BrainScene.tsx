"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

interface BrainMeshData {
  vertices: number[][];
  faces: number[][];
  sulcalDepth: number[];
  nVertices: number;
  nFaces: number;
}

/* ── Inferno colormap (black → purple → red → orange → yellow → white) ── */
const INFERNO_STOPS: [number, number, number][] = [
  [0.001, 0.000, 0.014],
  [0.122, 0.006, 0.315],
  [0.329, 0.039, 0.490],
  [0.533, 0.134, 0.421],
  [0.735, 0.267, 0.265],
  [0.891, 0.434, 0.126],
  [0.981, 0.645, 0.039],
  [0.993, 0.871, 0.318],
  [0.988, 0.998, 0.645],
];

function sampleInferno(t: number): [number, number, number] {
  const n = INFERNO_STOPS.length - 1;
  const idx = Math.min(Math.floor(t * n), n - 1);
  const frac = t * n - idx;
  const a = INFERNO_STOPS[idx];
  const b = INFERNO_STOPS[idx + 1];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
  ];
}

function BrainMesh({
  meshData,
  activation = 0.5,
  spin = true,
  yRotation = 0,
  mouseOffset,
}: {
  meshData: BrainMeshData;
  activation?: number;
  spin?: boolean;
  yRotation?: number;
  mouseOffset?: { x: number; y: number };
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const activationRef = useRef(activation);
  const lastUpdateRef = useRef(0);
  activationRef.current = activation;

  const { geometry, sulcalBase, noisePatterns } = useMemo(() => {
    const n = meshData.nVertices;
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = meshData.vertices[i][0];
      positions[i * 3 + 1] = meshData.vertices[i][1];
      positions[i * 3 + 2] = meshData.vertices[i][2];
    }

    const indices = new Uint32Array(meshData.nFaces * 3);
    for (let i = 0; i < meshData.nFaces; i++) {
      indices[i * 3] = meshData.faces[i][0];
      indices[i * 3 + 1] = meshData.faces[i][1];
      indices[i * 3 + 2] = meshData.faces[i][2];
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    const colors = new Float32Array(n * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const sulc = meshData.sulcalDepth;
    let sMin = sulc[0];
    let sMax = sulc[0];
    for (let i = 1; i < sulc.length; i++) {
      if (sulc[i] < sMin) sMin = sulc[i];
      if (sulc[i] > sMax) sMax = sulc[i];
    }
    const sRange = sMax - sMin || 1;
    const base = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const norm = (sulc[i] - sMin) / sRange;
      base[i] = 0.18 + (1 - norm) * 0.12;
    }

    const noise3D = createNoise3D();
    const NUM_PATTERNS = 4;
    const patterns = Array.from({ length: NUM_PATTERNS }, (_, p) => {
      const pat = new Float32Array(n);
      const phase = p * 17.3;
      for (let i = 0; i < n; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        pat[i] =
          noise3D(x * 0.8 + phase, y * 0.8 + phase * 0.7, z * 0.8) * 0.5 +
          0.5;
      }
      return pat;
    });

    return { geometry: geo, sulcalBase: base, noisePatterns: patterns };
  }, [meshData]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    if (spin) {
      groupRef.current.rotation.y = t * 0.15;
    } else if (mouseOffset) {
      // Smoothly follow mouse
      const targetY = yRotation + mouseOffset.x * 0.4;
      const targetX = mouseOffset.y * 0.15;
      groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05;
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05;
    }

    if (t - lastUpdateRef.current < 1 / 15) return;
    lastUpdateRef.current = t;

    const act = activationRef.current;
    const colors = geometry.attributes.color as THREE.BufferAttribute;
    const n = meshData.nVertices;

    const phase = t * 0.3;
    const np = noisePatterns.length;
    const idx0 = Math.floor(phase) % np;
    const idx1 = (idx0 + 1) % np;
    const blend = phase - Math.floor(phase);
    const p0 = noisePatterns[idx0];
    const p1 = noisePatterns[idx1];

    for (let i = 0; i < n; i++) {
      const wave = p0[i] * (1 - blend) + p1[i] * blend;
      const intensity = Math.min(1, Math.pow(wave, 0.72) * (0.38 + act * 1.7));
      const base = sulcalBase[i];
      const colorMix = Math.min(1, 0.5 + intensity * 0.7);
      const [hr, hg, hb] = sampleInferno(Math.min(0.12 + intensity * 1.05, 1.0));

      colors.array[i * 3] = base * (1 - colorMix) + hr * colorMix;
      colors.array[i * 3 + 1] = base * (1 - colorMix) + hg * colorMix;
      colors.array[i * 3 + 2] = base * (1 - colorMix) + hb * colorMix;
    }
    colors.needsUpdate = true;
  });

  return (
    <group ref={groupRef} rotation={[0, spin ? 0 : yRotation, 0]} scale={0.5}>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <meshStandardMaterial
          vertexColors
          roughness={0.42}
          metalness={0.08}
          emissive={new THREE.Color(0.14, 0.02, 0.06)}
          emissiveIntensity={0.45 + activation * 2.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function SetBackground({ color }: { color: string }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(color);
  }, [scene, color]);
  return null;
}

function BrainContent({
  activation,
  spin,
  yRotation,
  mouseOffset,
}: {
  activation: number;
  spin: boolean;
  yRotation: number;
  mouseOffset?: { x: number; y: number };
}) {
  const [meshData, setMeshData] = useState<BrainMeshData | null>(null);

  useEffect(() => {
    fetch("/brain_mesh.json")
      .then((r) => r.json())
      .then((data: BrainMeshData) => {
        if (data && data.nVertices > 0) setMeshData(data);
      })
      .catch(console.error);
  }, []);

  if (!meshData) return null;

  return (
    <BrainMesh
      meshData={meshData}
      activation={activation}
      spin={spin}
      yRotation={yRotation}
      mouseOffset={mouseOffset}
    />
  );
}

export default function BrainScene({
  activation = 0.4,
  bg = "#111111",
  spin = true,
  yRotation = 0,
  mouseOffset,
}: {
  activation?: number;
  bg?: string;
  spin?: boolean;
  yRotation?: number;
  mouseOffset?: { x: number; y: number };
}) {
  return (
    <Canvas
      camera={{ position: [0, 1, 7], fov: 40 }}
      dpr={[1, 1.25]}
      gl={{ antialias: false, powerPreference: "low-power" }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <SetBackground color={bg} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} />
      <directionalLight position={[-3, -2, -5]} intensity={0.35} />

      <BrainContent
        activation={activation}
        spin={spin}
        yRotation={yRotation}
        mouseOffset={mouseOffset}
      />
    </Canvas>
  );
}
