"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";

const VIDEOS = [
  "/videos/v1.mp4",
  "/videos/v2.mp4",
  "/videos/v3.mp4",
  "/videos/v4.mp4",
  "/videos/v5.mp4",
  "/videos/v6.mp4",
];

/* ── Capture a single frame from a video as a texture ── */
function useVideoFrame(src: string, seekTime: number): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 320;

    const handleSeeked = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      }
      video.removeEventListener("seeked", handleSeeked);
      video.pause();
      video.src = "";
    };

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(seekTime, video.duration - 0.1);
    });

    return () => {
      video.pause();
      video.src = "";
    };
  }, [src, seekTime]);

  return texture;
}

/* ── Fibonacci sphere point distribution ── */
function fibonacciSphere(numPoints: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    points.push(
      new THREE.Vector3(
        Math.cos(theta) * radiusAtY * radius,
        y * radius,
        Math.sin(theta) * radiusAtY * radius
      )
    );
  }
  return points;
}

/* ── Single static video frame plane on the sphere ── */
function VideoPlane({
  position,
  videoSrc,
  seekTime,
  sphereCenter,
}: {
  position: THREE.Vector3;
  videoSrc: string;
  seekTime: number;
  sphereCenter: THREE.Vector3;
}) {
  const texture = useVideoFrame(videoSrc, seekTime);

  const quaternion = useMemo(() => {
    const normal = position.clone().sub(sphereCenter).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const fallbackUp = new THREE.Vector3(1, 0, 0);

    const tangentUp = worldUp.projectOnPlane(normal);
    if (tangentUp.lengthSq() < 1e-5) {
      tangentUp.copy(fallbackUp.projectOnPlane(normal));
    }
    tangentUp.normalize();

    const tangentRight = new THREE.Vector3()
      .crossVectors(tangentUp, normal)
      .normalize();

    const basis = new THREE.Matrix4().makeBasis(
      tangentRight,
      tangentUp,
      normal
    );

    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }, [position, sphereCenter]);

  if (!texture) return null;

  return (
    <mesh position={position} quaternion={quaternion}>
      <planeGeometry args={[0.35, 0.62]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent opacity={0.88} />
    </mesh>
  );
}

/* ── Rotating sphere of video frames ── */
function VideoSphere() {
  const groupRef = useRef<THREE.Group>(null!);
  const numVideos = 72;
  const radius = 2.8;

  const points = useMemo(() => fibonacciSphere(numVideos, radius), []);
  const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Pre-compute seek times so each plane shows a different frame
  const seekTimes = useMemo(
    () => Array.from({ length: numVideos }, (_, i) => (i * 1.7) % 12 + 0.5),
    []
  );

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001; // half speed
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((pos, i) => (
        <VideoPlane
          key={i}
          position={pos}
          videoSrc={VIDEOS[i % VIDEOS.length]}
          seekTime={seekTimes[i]}
          sphereCenter={center}
        />
      ))}
    </group>
  );
}

function createBrainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '180px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🧠", canvas.width / 2, canvas.height / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

function FloatingBrainEmoji() {
  const spriteRef = useRef<THREE.Sprite>(null!);
  const texture = useMemo(() => createBrainTexture(), []);

  useFrame(({ clock }) => {
    if (!spriteRef.current) return;
    const t = clock.getElapsedTime();
    const scale = 1.38 + Math.sin(t * 1.2) * 0.04;
    spriteRef.current.scale.set(scale, scale, 1);
  });

  if (!texture) return null;

  return (
    <sprite ref={spriteRef} position={[0, 0, 0]} scale={[1.38, 1.38, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/* ── Background setter ── */
function SetBackground({ color }: { color: string }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(color);
  }, [scene, color]);
  return null;
}

/* ── Main exported component ── */
export default function HeroScene({
  mouseOffset: _mouseOffset,
}: {
  mouseOffset: { x: number; y: number };
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
      frameloop="always"
      dpr={[1, 1.5]}
    >
      <SetBackground color="#ffffff" />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.7} />
      <directionalLight position={[-3, -2, -5]} intensity={0.3} />
      <FloatingBrainEmoji />
      <VideoSphere />
    </Canvas>
  );
}
