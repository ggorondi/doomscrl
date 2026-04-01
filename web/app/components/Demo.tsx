"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

const AGENT_ORDER = ["baseline", "cortisol"] as const;
const REGION_NAMES = ["LAD", "LAV", "LPD", "LPV", "RAD", "RAV", "RPD", "RPV"];

type AgentSlug = (typeof AGENT_ORDER)[number];

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

interface SessionStep {
  step_idx: number;
  time_seconds: number;
  video_id: string;
  cluster_id: number;
  target_cluster: number;
  scroll: boolean;
  auto_advanced: boolean;
  video_step: number;
  video_length_steps: number;
  watch_frac: number;
  session_frac: number;
  reward: number;
  cumulative_reward: number;
  activation: number;
  delta: number;
  weighted_activation: number;
  weighted_delta: number;
  switch_penalty: number;
  short_dwell_penalty: number;
  tier: string;
  play_count: number;
  digg_count: number;
  duration: number;
  region_activation: number[];
  region_delta: number[];
}

interface DemoSession {
  title: string;
  variant: string;
  seed: number;
  duration_seconds: number;
  feature_rate_hz: number;
  video_fps: number;
  phone_video: string;
  steps: SessionStep[];
}

type SessionsData = Record<AgentSlug, DemoSession>;

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpArray(a: number[], b: number[], t: number) {
  const len = Math.min(a.length, b.length);
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    out[i] = lerp(a[i], b[i], t);
  }
  return out;
}

function BrainRotMeter({
  level,
  minLevel,
  maxLevel,
}: {
  level: number;
  minLevel: number;
  maxLevel: number;
}) {
  const range = Math.max(maxLevel - minLevel, 1e-6);
  const normalized = Math.max(0, Math.min((level - minLevel) / range, 1));
  const displayPct = 70 + normalized * 20;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.82rem",
          marginBottom: "0.25rem",
        }}
      >
        <span style={{ color: "var(--muted)" }}>Brain Rot Level</span>
        <span
          className="mono"
          style={{
            fontWeight: 700,
            color: `hsl(${(1 - displayPct / 100) * 120}, 70%, 40%)`,
          }}
        >
          {Math.round(displayPct)}%
        </span>
      </div>
      <div
        style={{
          height: "0.6rem",
          background: "var(--surface-alt)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            background:
              "linear-gradient(90deg, #000004, #420A68 20%, #932567 40%, #DD513A 60%, #FCA50A 80%, #FCFFA4)",
          }}
          animate={{ width: `${displayPct}%` }}
          transition={{ type: "spring", stiffness: 60 }}
        />
      </div>
    </div>
  );
}

function RegionHeatmap({ regions }: { regions: number[] }) {
  const maxVal = Math.max(...regions, 0.001);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "0.25rem",
      }}
    >
      {REGION_NAMES.map((name, i) => {
        const val = regions[i] || 0;
        const intensity = Math.min(val / maxVal, 1);
        const [r, g, b] = sampleInferno(intensity);
        return (
          <div
            key={name}
            style={{
              textAlign: "center",
              padding: "0.25rem",
              background: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${0.25 + intensity * 0.65})`,
            }}
          >
            <p
              className="mono"
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: intensity > 0.5 ? "#fff" : "var(--fg)",
              }}
            >
              {name}
            </p>
            <p
              className="mono"
              style={{
                fontSize: "0.62rem",
                color: intensity > 0.5 ? "#fff" : "var(--muted)",
              }}
            >
              {(val * 1000).toFixed(1)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ActivationPlot({
  steps,
  comparisonSteps,
  currentIndex,
  currentLabel,
  comparisonLabel,
}: {
  steps: SessionStep[];
  comparisonSteps?: SessionStep[];
  currentIndex: number;
  currentLabel: string;
  comparisonLabel?: string;
}) {
  if (!steps.length) return null;

  const width = 420;
  const height = 140;
  const pad = 12;
  const maxY = Math.max(
    ...steps.map((step) => step.activation),
    ...(comparisonSteps?.map((step) => step.activation) ?? []),
    0.001
  );
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const toPath = (values: number[]) =>
    values
      .map((value, index) => {
        const x = pad + (index / Math.max(values.length - 1, 1)) * usableW;
        const y = height - pad - (value / maxY) * usableH;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  const activationPath = toPath(steps.map((step) => step.activation));
  const comparisonPath =
    comparisonSteps && comparisonSteps.length
      ? toPath(comparisonSteps.map((step) => step.activation))
      : null;
  const markerX = pad + (currentIndex / Math.max(steps.length - 1, 1)) * usableW;

  return (
    <div className="card">
      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--muted)",
          marginBottom: "0.5rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Activation Trace
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "140px", display: "block" }}
      >
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={pad}
            y1={pad + usableH * ratio}
            x2={width - pad}
            y2={pad + usableH * ratio}
            stroke="#ececec"
            strokeWidth="1"
          />
        ))}
        {comparisonPath && (
          <path d={comparisonPath} fill="none" stroke="#b8b8b8" strokeWidth="2" />
        )}
        <path d={activationPath} fill="none" stroke="#DD513A" strokeWidth="2.5" />
        <line
          x1={markerX}
          y1={pad}
          x2={markerX}
          y2={height - pad}
          stroke="#111"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "0.5rem",
          fontSize: "0.78rem",
          color: "var(--muted)",
        }}
      >
        {comparisonLabel && <span className="mono">grey: {comparisonLabel}</span>}
        <span className="mono">red: {currentLabel}</span>
      </div>
    </div>
  );
}

function DemoPhone({
  videoRef,
  session,
  currentStep,
  videoPaused,
  onStartPlayback,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  session: DemoSession;
  currentStep: SessionStep;
  videoPaused: boolean;
  onStartPlayback: () => void;
}) {
  return (
    <div
      style={{ width: "100%", maxWidth: "196px", margin: "0 auto" }}
    >
      <div
        style={{
          position: "relative",
          background: "#000",
          borderRadius: "2rem",
          padding: "0.6rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "5rem",
            height: "1.25rem",
            background: "#000",
            borderRadius: "0 0 0.75rem 0.75rem",
            zIndex: 20,
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "1.5rem",
            overflow: "hidden",
            background: "#000",
            aspectRatio: "9/19.5",
            userSelect: "none",
          }}
        >
          <video
            ref={videoRef}
            key={session.phone_video}
            src={session.phone_video}
            muted
            autoPlay
            playsInline
            loop
            preload="metadata"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {videoPaused && (
            <button
              type="button"
              onClick={onStartPlayback}
              className="btn btn-primary"
              style={{
                position: "absolute",
                inset: "auto 50% 1.25rem auto",
                transform: "translateX(50%)",
                zIndex: 20,
                pointerEvents: "auto",
                fontSize: "0.88rem",
              }}
            >
              Start demo
            </button>
          )}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "0.75rem",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.35), transparent)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <p style={{ color: "#fff", fontSize: "0.68rem", fontWeight: 700 }}>
              @{session.title.toLowerCase()}_agent
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: "0.62rem",
                marginTop: "0.15rem",
              }}
            >
              vid {currentStep.video_id.slice(-6)} · cluster {currentStep.cluster_id} ·{" "}
              {currentStep.scroll ? "scroll" : "hold"}
            </p>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "0.25rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "6rem",
            height: "0.2rem",
            background: "rgba(255,255,255,0.3)",
            borderRadius: "9999px",
          }}
        />
      </div>
    </div>
  );
}

export default function Demo() {
  const [sessions, setSessions] = useState<SessionsData | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentSlug>("baseline");
  const [currentTime, setCurrentTime] = useState(0);
  const [videoPaused, setVideoPaused] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineTimeRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);
  const session = sessions?.[activeAgent] ?? null;

  useEffect(() => {
    fetch("/data/demo_sessions.json")
      .then((r) => r.json())
      .then((data: SessionsData) => {
        const withCumulative = Object.fromEntries(
          Object.entries(data).map(([slug, session]) => {
            let running = 0;
            return [
              slug,
              {
                ...session,
                steps: session.steps.map((step) => {
                  running += step.reward;
                  return { ...step, cumulative_reward: running };
                }),
              },
            ];
          })
        ) as SessionsData;
        setSessions(withCumulative);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    timelineTimeRef.current = 0;
    lastTickAtRef.current = null;
    setCurrentTime(0);
    setVideoPaused(true);

    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.pause();
    video.currentTime = 0;
    video.load();
  }, [activeAgent, session?.phone_video]);

  useEffect(() => {
    if (!session) return;

    const duration = Math.max(session.duration_seconds, 0.001);
    const tick = () => {
      const now = performance.now();
      if (lastTickAtRef.current == null) {
        lastTickAtRef.current = now;
        return;
      }

      const deltaSeconds = (now - lastTickAtRef.current) / 1000;
      lastTickAtRef.current = now;
      timelineTimeRef.current = (timelineTimeRef.current + deltaSeconds) % duration;
      setCurrentTime(timelineTimeRef.current);
    };

    const intervalId = window.setInterval(tick, 100);

    return () => {
      window.clearInterval(intervalId);
      lastTickAtRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;

    const syncVideoToTimeline = () => {
      const targetTime = timelineTimeRef.current;
      const maxTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(video.duration - 0.05, 0)
          : session.duration_seconds;
      const clampedTarget = Math.min(targetTime, maxTime);

      if (Math.abs(video.currentTime - clampedTarget) > 0.35) {
        video.currentTime = clampedTarget;
      }
    };

    const tryPlay = () => {
      syncVideoToTimeline();
      video.play().catch(() => { });
    };

    const handlePlay = () => setVideoPaused(false);
    const handlePause = () => setVideoPaused(true);

    tryPlay();

    video.addEventListener("play", handlePlay);
    video.addEventListener("playing", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("canplaythrough", tryPlay);
    video.addEventListener("waiting", tryPlay);
    video.addEventListener("stalled", tryPlay);
    video.addEventListener("pause", tryPlay);

    const intervalId = window.setInterval(() => {
      syncVideoToTimeline();
      if (
        video.paused &&
        !video.ended &&
        video.readyState >= 2
      ) {
        video.play().catch(() => { });
      }
    }, 200);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("playing", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("canplaythrough", tryPlay);
      video.removeEventListener("waiting", tryPlay);
      video.removeEventListener("stalled", tryPlay);
      video.removeEventListener("pause", tryPlay);
      window.clearInterval(intervalId);
    };
  }, [session]);

  const playbackState = useMemo(() => {
    if (!session || !session.steps.length) return null;

    const rawIndex = Math.max(0, currentTime * session.feature_rate_hz);
    const currentIdx = Math.min(session.steps.length - 1, Math.floor(rawIndex));
    const nextIdx = Math.min(session.steps.length - 1, currentIdx + 1);
    const mix = Math.max(0, Math.min(rawIndex - currentIdx, 1));
    const currentStep = session.steps[currentIdx];
    const nextStep = session.steps[nextIdx];

    const interpolatedStep: SessionStep =
      currentIdx === nextIdx
        ? currentStep
        : {
            ...currentStep,
            time_seconds: currentTime,
            reward: lerp(currentStep.reward, nextStep.reward, mix),
            cumulative_reward: lerp(
              currentStep.cumulative_reward,
              nextStep.cumulative_reward,
              mix
            ),
            activation: lerp(currentStep.activation, nextStep.activation, mix),
            delta: lerp(currentStep.delta, nextStep.delta, mix),
            weighted_activation: lerp(
              currentStep.weighted_activation,
              nextStep.weighted_activation,
              mix
            ),
            weighted_delta: lerp(
              currentStep.weighted_delta,
              nextStep.weighted_delta,
              mix
            ),
            switch_penalty: lerp(
              currentStep.switch_penalty,
              nextStep.switch_penalty,
              mix
            ),
            short_dwell_penalty: lerp(
              currentStep.short_dwell_penalty,
              nextStep.short_dwell_penalty,
              mix
            ),
            watch_frac: lerp(currentStep.watch_frac, nextStep.watch_frac, mix),
            session_frac: lerp(currentStep.session_frac, nextStep.session_frac, mix),
            play_count: lerp(currentStep.play_count, nextStep.play_count, mix),
            digg_count: lerp(currentStep.digg_count, nextStep.digg_count, mix),
            duration: lerp(currentStep.duration, nextStep.duration, mix),
            region_activation: lerpArray(
              currentStep.region_activation,
              nextStep.region_activation,
              mix
            ),
            region_delta: lerpArray(
              currentStep.region_delta,
              nextStep.region_delta,
              mix
            ),
          };

    return {
      rawIndex,
      currentStep,
      interpolatedStep,
    };
  }, [session, currentTime]);

  const activationStats = useMemo(() => {
    if (!session || !session.steps.length) {
      return {
        activationMin: 0,
        activationMax: 1,
        weightedActivationMin: 0,
        weightedActivationMax: 1,
      };
    }

    const activationValues = session.steps.map((step) => step.activation);
    const weightedActivationValues = session.steps.map((step) => step.weighted_activation);
    return {
      activationMin: Math.min(...activationValues),
      activationMax: Math.max(...activationValues),
      weightedActivationMin: Math.min(...weightedActivationValues),
      weightedActivationMax: Math.max(...weightedActivationValues),
    };
  }, [session]);

  if (!session || !playbackState) {
    return (
      <section id="demo" style={{ padding: "3rem 0" }}>
        <div className="container-middle" style={{ maxWidth: "900px" }}>
          <p className="separator">✺✺✺</p>
          <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Demo</h2>
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--muted)" }}>Loading real agent rollouts...</p>
          </div>
        </div>
      </section>
    );
  }

  const loadedSessions = sessions as SessionsData;
  const comparisonAgent = activeAgent === "baseline" ? "cortisol" : "baseline";
  const comparisonSession = loadedSessions[comparisonAgent];
  const { rawIndex, currentStep, interpolatedStep } = playbackState;

  const activationRange = Math.max(
    activationStats.activationMax - activationStats.activationMin,
    1e-6
  );
  const brainDisplayActivation = Math.max(
    0.25,
    Math.min(
      1,
      0.25 +
      ((interpolatedStep.activation - activationStats.activationMin) / activationRange) * 0.75
    )
  );

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.currentTime = Math.min(timelineTimeRef.current, Math.max(session.duration_seconds - 0.05, 0));
    video.play().catch(() => { });
  };

  return (
    <section id="demo" style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ maxWidth: "900px" }}>
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Demo</h2>
        <p style={{ color: "var(--muted)", marginBottom: "2rem", maxWidth: "700px" }}>
          Heres a demo of the actual trained agents scrolling for you and curating the feed for a 30-second session.
          Switch between the baseline (dopaminemaxx) and cortisol agents and watch the actual
          selected TikToks and synchronized activations.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: "0.9rem",
              fontWeight: activeAgent === "baseline" ? 700 : 500,
              color: activeAgent === "baseline" ? "#DD513A" : "var(--muted)",
            }}
          >
            Dopamine
          </span>
          <button
            type="button"
            aria-label="Toggle between baseline and cortisol demos"
            onClick={() => {
              setActiveAgent((prev) => (prev === "baseline" ? "cortisol" : "baseline"));
              setCurrentTime(0);
            }}
            style={{
              position: "relative",
              width: "4.15rem",
              height: "2rem",
              borderRadius: "9999px",
              border: "1px solid var(--border)",
              background:
                activeAgent === "baseline"
                  ? "linear-gradient(90deg, #ffe3d7, #ffc7b0)"
                  : "linear-gradient(90deg, #efe3ff, #d4b7ff)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "0.15rem",
                left: activeAgent === "baseline" ? "0.15rem" : "2.25rem",
                width: "1.55rem",
                height: "1.55rem",
                borderRadius: "50%",
                background: activeAgent === "baseline" ? "#DD513A" : "#7A3CF0",
                transition: "left 0.2s ease, background 0.2s ease",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}
            />
          </button>
          <span
            className="mono"
            style={{
              fontSize: "0.9rem",
              fontWeight: activeAgent === "cortisol" ? 700 : 500,
              color: activeAgent === "cortisol" ? "#7A3CF0" : "var(--muted)",
            }}
          >
            {loadedSessions.cortisol.title}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2rem",
            alignItems: "start",
          }}
        >
          <div
            style={{
              flex: "0 0 196px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <DemoPhone
              videoRef={videoRef}
              session={session}
              currentStep={currentStep}
              videoPaused={videoPaused}
              onStartPlayback={startPlayback}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div className="card" style={{ textAlign: "center", padding: "0.85rem 0.6rem" }}>
                <p
                  className="mono"
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--danger)",
                  }}
                >
                  {(interpolatedStep.activation * 1000).toFixed(2)}
                </p>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Mean activation (×10⁻³)
                </p>
              </div>
              <div className="card" style={{ textAlign: "center", padding: "0.85rem 0.6rem" }}>
                <p
                  className="mono"
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--secondary)",
                  }}
                >
                  {interpolatedStep.cumulative_reward.toFixed(3)}
                </p>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Cumulative reward
                </p>
              </div>
              <div className="card" style={{ textAlign: "center", padding: "0.85rem 0.6rem" }}>
                <p className="mono" style={{ fontSize: "1rem", fontWeight: 700 }}>
                  c{currentStep.cluster_id}
                </p>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Cluster
                </p>
              </div>
              <div className="card" style={{ textAlign: "center", padding: "0.85rem 0.6rem" }}>
                <p className="mono" style={{ fontSize: "1rem", fontWeight: 700 }}>
                  {currentStep.scroll ? "YES" : "NO"}
                </p>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Scroll action
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: "1 1 420px" }}>
            <div
              className="demo-brain-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
                gap: "1rem",
                alignItems: "stretch",
              }}
            >
              <div
                className="card"
                style={{
                  overflow: "hidden",
                  background: "#fff",
                  position: "relative",
                  minHeight: "390px",
                  padding: 0,
                }}
              >
                <BrainScene activation={brainDisplayActivation} spin={true} bg="#ffffff" scale={0.58} />
                <div
                  style={{
                    position: "absolute",
                    bottom: "0.75rem",
                    left: "0.75rem",
                    right: "0.75rem",
                    zIndex: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: "0.78rem",
                      color: "rgba(0,0,0,0.5)",
                      background: "rgba(255,255,255,0.7)",
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    activation: {(interpolatedStep.activation * 1000).toFixed(2)}×10⁻³
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "0.78rem",
                      color: "rgba(0,0,0,0.5)",
                      background: "rgba(255,255,255,0.7)",
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    t={currentTime.toFixed(1)}s · sample {currentStep.step_idx + 1}/
                    {session.steps.length}
                  </span>
                </div>
              </div>

              <div
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      marginBottom: "0.5rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Brain Region Activations (×10⁻³)
                  </p>
                  <RegionHeatmap regions={interpolatedStep.region_activation} />
                </div>
                <BrainRotMeter
                  level={interpolatedStep.weighted_activation}
                  minLevel={activationStats.weightedActivationMin}
                  maxLevel={activationStats.weightedActivationMax}
                />
              </div>
            </div>

            <ActivationPlot
              steps={session.steps}
              comparisonSteps={comparisonSession?.steps}
              currentIndex={rawIndex}
              currentLabel={session.title.toLowerCase()}
              comparisonLabel={comparisonSession?.title.toLowerCase()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
