"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

const DEMO_VIDEOS = [
  "/videos/v1.mp4",
  "/videos/v2.mp4",
  "/videos/v3.mp4",
  "/videos/v4.mp4",
  "/videos/v5.mp4",
  "/videos/v6.mp4",
];

function BrainRotMeter({ level }: { level: number }) {
  const pct = Math.min(level * 100, 100);
  const label =
    pct < 20
      ? "MINIMAL"
      : pct < 40
        ? "WARMING UP"
        : pct < 60
          ? "ENGAGED"
          : pct < 80
            ? "LOCKED IN"
            : "BRAIN MELTING";

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--muted)]">Brain Rot Level</span>
        <span
          className="mono font-bold"
          style={{
            color: `hsl(${(1 - level) * 120}, 70%, 40%)`,
          }}
        >
          {label}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--border)]/40 overflow-hidden border border-[var(--border)]">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60 }}
          style={{
            background: `linear-gradient(90deg, #000004, #420A68 20%, #932567 40%, #DD513A 60%, #FCA50A 80%, #FCFFA4)`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Swipeable iPhone for Demo ── */
function DemoPhone({
  videoIdx,
  onNext,
  isAgent,
}: {
  videoIdx: number;
  onNext: () => void;
  isAgent: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handler = () => onNext();
    el.addEventListener("ended", handler);
    el.play().catch(() => {});
    return () => el.removeEventListener("ended", handler);
  }, [videoIdx, onNext]);

  const THRESHOLD = 80;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (transitioning || isAgent) return;
      dragStart.current = e.clientY;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [transitioning, isAgent]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStart.current === null || transitioning) return;
      const delta = dragStart.current - e.clientY;
      if (delta > 0) setDragY(delta);
    },
    [transitioning]
  );

  const onPointerUp = useCallback(() => {
    if (dragStart.current === null) return;
    if (dragY > THRESHOLD) {
      setTransitioning(true);
      setDragY(600);
      setTimeout(() => {
        onNext();
        setDragY(0);
        setTransitioning(false);
      }, 280);
    } else {
      setDragY(0);
    }
    dragStart.current = null;
  }, [dragY, onNext]);

  const nextIdx = (videoIdx + 1) % DEMO_VIDEOS.length;

  return (
    <div className="card p-1 max-w-[280px] mx-auto lg:mx-0">
      <div className="relative bg-black rounded-[2rem] p-2.5 overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />

        {/* Screen */}
        <div
          className="relative rounded-[1.5rem] overflow-hidden bg-black select-none"
          style={{ aspectRatio: "9/19.5", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Next video underneath */}
          <video
            key={`demo-next-${nextIdx}`}
            src={DEMO_VIDEOS[nextIdx]}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Current video */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translateY(-${dragY}px)`,
              transition: transitioning
                ? "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)"
                : dragStart.current !== null
                  ? "none"
                  : "transform 0.2s ease-out",
            }}
          >
            <video
              ref={videoRef}
              key={`demo-${videoIdx}`}
              src={DEMO_VIDEOS[videoIdx % DEMO_VIDEOS.length]}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Status bar */}
          <div className="absolute top-2 left-0 right-0 flex items-center justify-between px-4 z-10 pointer-events-none">
            <span className="text-white/60 text-[10px]">9:41</span>
            <span className="text-white text-xs font-bold">brainrotmaxxer</span>
            <span className="text-white/60 text-[10px]">100%</span>
          </div>

          {/* Agent indicator */}
          {isAgent && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[10px] bg-[var(--danger)] text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                🤖 AGENT SCROLLING
              </span>
            </div>
          )}

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10 pointer-events-none">
            <p className="text-white text-[10px] font-bold">@brainrotmaxxer</p>
            <p className="text-white/70 text-[9px] mt-0.5">
              {isAgent ? "agent is optimizing your cortex..." : "↑ swipe to scroll"}
            </p>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full" />
      </div>
    </div>
  );
}

export default function Demo() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activation, setActivation] = useState(0.2);
  const [isAgent, setIsAgent] = useState(false);
  const [totalReward, setTotalReward] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % DEMO_VIDEOS.length);
    setVideoTime(0);
  }, []);

  useEffect(() => {
    // Simulate activation based on video + time
    const baseActivation = [0.7, 0.55, 0.75, 0.4, 0.65, 0.5][currentIdx % 6];
    const novelty = videoTime < 3 ? 0.2 : videoTime < 6 ? 0.1 : -0.05;
    const jitter = (Math.random() - 0.5) * 0.08;
    const newAct = Math.max(0.05, Math.min(1, baseActivation + novelty + jitter));
    setActivation(newAct);
    setTotalReward((r) => r + newAct * 0.01);
  }, [currentIdx, videoTime]);

  useEffect(() => {
    const timer = setInterval(() => setVideoTime((t) => t + 1), 500);
    return () => clearInterval(timer);
  }, []);

  // Agent auto-scroll
  useEffect(() => {
    if (!isAgent) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const shouldScroll = activation < 0.45 || videoTime > 8;
      if (shouldScroll) {
        scroll();
      }
    }, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAgent, activation, videoTime, scroll]);

  return (
    <section id="demo" className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Demo
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-8 max-w-xl">
          Watch the brain light up as the agent optimizes your doomscrolling
          experience. Toggle between manual scrolling and letting the RL agent
          take control.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setIsAgent(false)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                !isAgent
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              Scroll manually
            </button>
            <button
              onClick={() => setIsAgent(true)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                isAgent
                  ? "bg-[var(--danger)] text-white"
                  : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              Let the agent scroll
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-12 items-start">
          {/* Left: iPhone */}
          <DemoPhone videoIdx={currentIdx} onNext={scroll} isAgent={isAgent} />

          {/* Right: Brain + Metrics */}
          <div className="space-y-6">
            {/* Brain visualization */}
            <div className="card overflow-hidden bg-[#111] relative" style={{ height: 380 }}>
              <BrainScene activation={activation} spin={true} />
              <div className="absolute bottom-3 right-3 z-10">
                <span className="mono text-xs text-white/50 bg-black/40 px-2 py-1 rounded">
                  {(activation * 100).toFixed(0)}% cortical
                </span>
              </div>
            </div>

            <BrainRotMeter level={activation} />

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-2xl mono font-bold text-[var(--danger)]">
                  {(activation * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Cortical activation
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl mono font-bold text-[var(--secondary)]">
                  {totalReward.toFixed(2)}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Total reward
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl mono font-bold text-[var(--fg)]">
                  {currentIdx + 1}/{DEMO_VIDEOS.length}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Videos watched
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
