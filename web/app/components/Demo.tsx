"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

const MOCK_VIDEOS = [
  { id: 1, title: "Cute puppy compilation", views: "326M", tier: "top", category: "animals", color: "#f97316" },
  { id: 2, title: "Satisfying slime ASMR", views: "89M", tier: "high", category: "asmr", color: "#a855f7" },
  { id: 3, title: "Cactus toy baby reaction", views: "314M", tier: "top", category: "funny", color: "#ef4444" },
  { id: 4, title: "Storm at North Sea", views: "293M", tier: "top", category: "nature", color: "#3b82f6" },
  { id: 5, title: "POV: math class", views: "2.1M", tier: "random", category: "comedy", color: "#22c55e" },
  { id: 6, title: "Dance challenge viral", views: "158M", tier: "high", category: "dance", color: "#ec4899" },
  { id: 7, title: "Cat vs cucumber", views: "45M", tier: "high", category: "animals", color: "#f97316" },
  { id: 8, title: "Life hack: ice cube trick", views: "890K", tier: "random", category: "lifehack", color: "#14b8a6" },
  { id: 9, title: "Emotional proposal", views: "201M", tier: "top", category: "emotional", color: "#f43f5e" },
  { id: 10, title: "Cooking pasta wrong", views: "5.3M", tier: "random", category: "food", color: "#eab308" },
  { id: 11, title: "Parkour POV rooftop", views: "67M", tier: "high", category: "extreme", color: "#ef4444" },
  { id: 12, title: "Baby first words", views: "412M", tier: "top", category: "cute", color: "#f97316" },
  { id: 13, title: "Optical illusion wall", views: "3.7M", tier: "random", category: "trippy", color: "#8b5cf6" },
  { id: 14, title: "Dog rescue story", views: "178M", tier: "high", category: "animals", color: "#f97316" },
  { id: 15, title: "Cleaning motivation", views: "1.2M", tier: "random", category: "lifestyle", color: "#06b6d4" },
];

function tierBadgeColor(tier: string) {
  if (tier === "top") return "bg-red-500/20 text-red-400";
  if (tier === "high") return "bg-purple-500/20 text-purple-400";
  return "bg-gray-500/20 text-gray-400";
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
          className="font-mono font-bold"
          style={{
            color: `hsl(${(1 - level) * 120}, 80%, 55%)`,
          }}
        >
          {label}
        </span>
      </div>
      <div className="h-3 rounded-full bg-[var(--card)] overflow-hidden border border-[var(--card-border)]">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60 }}
          style={{
            background: `linear-gradient(90deg, #22c55e, #eab308 40%, #ef4444 70%, #ff3366)`,
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
    <section id="demo" className="py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold mb-4"
        >
          Interactive demo
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-[var(--muted)] text-lg mb-12"
        >
          Scroll through the feed manually or let the RL agent take over.
          Watch the brain light up.
        </motion.p>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
          {/* Phone mockup with feed */}
          <div className="card p-1 max-w-sm mx-auto lg:mx-0">
            <div className="bg-black rounded-xl overflow-hidden">
              {/* Status bar */}
              <div className="flex justify-between items-center px-4 py-2 text-xs text-gray-500">
                <span>9:41</span>
                <span className="font-semibold text-gray-300">brainrotmaxxer</span>
                <span>100%</span>
              </div>

              {/* Current video */}
              <div
                className="relative h-80 flex items-end p-4"
                style={{
                  background: `linear-gradient(135deg, ${currentVideo.color}22, ${currentVideo.color}44)`,
                }}
              >
                <div
                  className="absolute top-4 right-4 w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                  style={{ background: `${currentVideo.color}33` }}
                >
                  {currentVideo.category === "animals"
                    ? "\uD83D\uDC36"
                    : currentVideo.category === "funny"
                      ? "\uD83E\uDD23"
                      : currentVideo.category === "dance"
                        ? "\uD83D\uDC83"
                        : currentVideo.category === "nature"
                          ? "\u26C8\uFE0F"
                          : currentVideo.category === "emotional"
                            ? "\uD83D\uDE2D"
                            : currentVideo.category === "food"
                              ? "\uD83C\uDF5D"
                              : currentVideo.category === "extreme"
                                ? "\uD83E\uDD2F"
                                : currentVideo.category === "asmr"
                                  ? "\uD83C\uDF99\uFE0F"
                                  : "\u2728"}
                </div>

                <div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${tierBadgeColor(currentVideo.tier)}`}
                  >
                    {currentVideo.tier}
                  </span>
                  <h3 className="text-white font-semibold mt-2 text-lg">
                    {currentVideo.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {currentVideo.views} views
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={scroll}
                    className="flex-1 py-2.5 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:brightness-110 transition"
                  >
                    Scroll to next
                  </button>
                  <button
                    onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition border ${
                      isAutoScrolling
                        ? "bg-[var(--accent2)] text-white border-transparent"
                        : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent2)]"
                    }`}
                  >
                    {isAutoScrolling ? "Stop agent" : "Let AI scroll"}
                  </button>
                </div>

                {/* Feed preview */}
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {MOCK_VIDEOS.slice(currentIdx + 1, currentIdx + 5).map(
                    (v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-[var(--card)]"
                      >
                        <div
                          className="w-8 h-8 rounded flex-shrink-0"
                          style={{ background: `${v.color}44` }}
                        />
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

          {/* Brain + metrics */}
          <div className="space-y-6">
            <div className="card overflow-hidden" style={{ height: 340 }}>
              <BrainScene activation={activation} />
            </div>

            <BrainRotMeter level={activation} />

            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-2xl font-mono font-bold gradient-text">
                  {(activation * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Cortical activation
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-mono font-bold text-[var(--accent2)]">
                  {totalReward.toFixed(2)}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Total reward
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-mono font-bold text-cyan-400">
                  {currentIdx + 1}/{MOCK_VIDEOS.length}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Videos watched
                </p>
              </div>
            </div>

            {/* Agent log */}
            <div className="card p-4">
              <p className="text-xs text-[var(--muted)] mb-2 font-semibold uppercase tracking-wider">
                Agent log
              </p>
              <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                {scrollLog.length === 0 ? (
                  <p className="text-gray-600">
                    Scroll manually or activate the AI agent...
                  </p>
                ) : (
                  scrollLog.map((line, i) => (
                    <p
                      key={i}
                      className={
                        line.startsWith("  ->")
                          ? "text-[var(--accent2)]"
                          : "text-gray-400"
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
