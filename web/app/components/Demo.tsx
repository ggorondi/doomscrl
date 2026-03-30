"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

const MOCK_VIDEOS = [
  { id: 1, title: "Cute puppy compilation", views: "326M", tier: "top", category: "animals" },
  { id: 2, title: "Satisfying slime ASMR", views: "89M", tier: "high", category: "asmr" },
  { id: 3, title: "Cactus toy baby reaction", views: "314M", tier: "top", category: "funny" },
  { id: 4, title: "Storm at North Sea", views: "293M", tier: "top", category: "nature" },
  { id: 5, title: "POV: math class", views: "2.1M", tier: "random", category: "comedy" },
  { id: 6, title: "Dance challenge viral", views: "158M", tier: "high", category: "dance" },
  { id: 7, title: "Cat vs cucumber", views: "45M", tier: "high", category: "animals" },
  { id: 8, title: "Life hack: ice cube trick", views: "890K", tier: "random", category: "lifehack" },
  { id: 9, title: "Emotional proposal", views: "201M", tier: "top", category: "emotional" },
  { id: 10, title: "Cooking pasta wrong", views: "5.3M", tier: "random", category: "food" },
  { id: 11, title: "Parkour POV rooftop", views: "67M", tier: "high", category: "extreme" },
  { id: 12, title: "Baby first words", views: "412M", tier: "top", category: "cute" },
  { id: 13, title: "Optical illusion wall", views: "3.7M", tier: "random", category: "trippy" },
  { id: 14, title: "Dog rescue story", views: "178M", tier: "high", category: "animals" },
  { id: 15, title: "Cleaning motivation", views: "1.2M", tier: "random", category: "lifestyle" },
];

function tierBadgeClass(tier: string) {
  if (tier === "top") return "bg-red-100 text-red-700";
  if (tier === "high") return "bg-violet-100 text-violet-700";
  return "bg-gray-100 text-gray-600";
}

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
            background: `linear-gradient(90deg, #16A34A, #D97706 40%, #DC2626 70%, #991B1B)`,
          }}
        />
      </div>
    </div>
  );
}

export default function Demo() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activation, setActivation] = useState(0.2);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollLog, setScrollLog] = useState<string[]>([]);
  const [totalReward, setTotalReward] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    setCurrentIdx((prev) => {
      const next = (prev + 1) % MOCK_VIDEOS.length;
      const video = MOCK_VIDEOS[next];
      setScrollLog((log) => [
        `Scrolled to: ${video.title} [${video.tier}]`,
        ...log.slice(0, 8),
      ]);
      return next;
    });
    setVideoTime(0);
  }, []);

  useEffect(() => {
    const video = MOCK_VIDEOS[currentIdx];
    const baseActivation =
      video.tier === "top" ? 0.7 : video.tier === "high" ? 0.5 : 0.3;
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

  useEffect(() => {
    if (!isAutoScrolling) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const shouldScroll = activation < 0.45 || videoTime > 8;
      if (shouldScroll) {
        scroll();
        setScrollLog((log) => [
          "  -> Agent decided: SCROLL (activation dropping)",
          ...log.slice(0, 8),
        ]);
      } else {
        setScrollLog((log) => [
          "  -> Agent decided: KEEP WATCHING",
          ...log.slice(0, 8),
        ]);
      }
    }, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoScrolling, activation, videoTime, scroll]);

  const currentVideo = MOCK_VIDEOS[currentIdx];

  return (
    <section id="demo" className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Demo
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-10 max-w-xl">
          Manual scroll or agent. Brain view updates with mock activation.
        </p>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-10">
          <div className="card p-1 max-w-sm mx-auto lg:mx-0">
            <div className="bg-[#111] rounded-lg overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 text-xs text-gray-500">
                <span>9:41</span>
                <span className="font-semibold text-gray-300">brainrotmaxxer</span>
                <span>100%</span>
              </div>

              <div
                className="relative h-80 flex items-end p-4"
                style={{
                  background: `linear-gradient(135deg, rgba(17,17,17,0.9), rgba(30,30,30,0.95))`,
                }}
              >
                <div className="absolute top-4 right-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${tierBadgeClass(currentVideo.tier)}`}>
                    {currentVideo.tier}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {currentVideo.category}
                  </p>
                  <h3 className="text-white font-semibold text-lg">
                    {currentVideo.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {currentVideo.views} views
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={scroll}
                    className="flex-1 py-2.5 bg-white text-[#111] text-sm font-semibold rounded-md hover:bg-gray-200 transition"
                  >
                    Scroll to next
                  </button>
                  <button
                    onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition border ${
                      isAutoScrolling
                        ? "bg-[var(--danger)] text-white border-transparent"
                        : "border-gray-600 text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {isAutoScrolling ? "Stop agent" : "Let AI scroll"}
                  </button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {MOCK_VIDEOS.slice(currentIdx + 1, currentIdx + 5).map(
                    (v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 p-2 rounded bg-[#1a1a1a]"
                      >
                        <div className="w-8 h-8 rounded bg-[#222] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 truncate">
                            {v.title}
                          </p>
                          <p className="text-xs text-gray-600">{v.views}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card overflow-hidden bg-[#111] relative min-h-[280px] h-[340px]">
              <BrainScene activation={activation} />
            </div>

            <BrainRotMeter level={activation} />

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
                  {currentIdx + 1}/{MOCK_VIDEOS.length}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Videos watched
                </p>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-xs text-[var(--muted)] mb-2 font-semibold uppercase tracking-wider">
                Agent log
              </p>
              <div className="space-y-1 mono text-xs max-h-40 overflow-y-auto">
                {scrollLog.length === 0 ? (
                  <p className="text-[var(--muted)]">
                    Scroll manually or activate the AI agent...
                  </p>
                ) : (
                  scrollLog.map((line, i) => (
                    <p
                      key={i}
                      className={
                        line.startsWith("  ->")
                          ? "text-[var(--secondary)]"
                          : "text-[var(--muted)]"
                      }
                    >
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
