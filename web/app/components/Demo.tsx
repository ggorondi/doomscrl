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

function BrainRotMeter({ level }: { level: number }) {
  const displayPct = Math.min(level * 2000, 100);
  const label =
    displayPct < 20
      ? "MINIMAL"
      : displayPct < 40
        ? "WARMING UP"
        : displayPct < 60
          ? "ENGAGED"
          : displayPct < 80
            ? "LOCKED IN"
            : "BRAIN MELTING";

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.75rem",
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
          {label}
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
        gridTemplateColumns: "repeat(4, 1fr)",
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
                fontSize: "0.6rem",
                fontWeight: 700,
                color: intensity > 0.5 ? "#fff" : "var(--fg)",
              }}
            >
              {name}
            </p>
            <p
              className="mono"
              style={{
                fontSize: "0.55rem",
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
  currentIndex,
}: {
  steps: SessionStep[];
  currentIndex: number;
}) {
  if (!steps.length) return null;

  const width = 420;
  const height = 140;
  const pad = 12;
  const maxY = Math.max(
    ...steps.map((step) => Math.max(step.activation, step.weighted_activation)),
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
  const weightedPath = toPath(steps.map((step) => step.weighted_activation));
  const markerX = pad + (currentIndex / Math.max(steps.length - 1, 1)) * usableW;

  return (
    <div className="card">
      <p
        style={{
          fontSize: "0.7rem",
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
        <path d={weightedPath} fill="none" stroke="#932567" strokeWidth="2.5" />
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
          fontSize: "0.7rem",
          color: "var(--muted)",
        }}
      >
        <span className="mono">orange: mean activation</span>
        <span className="mono">purple: weighted activation</span>
      </div>
    </div>
  );
}

function DemoPhone({
  videoRef,
  session,
  currentStep,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  session: DemoSession;
  currentStep: SessionStep;
}) {
  return (
    <div
      className="card"
      style={{ padding: "0.25rem", width: "100%", maxWidth: "280px", margin: "0 auto" }}
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
            preload="auto"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "0.5rem",
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1rem",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.6rem" }}>
              9:41
            </span>
            <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>
              {session.title}
            </span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.6rem" }}>
              100%
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              top: "2.5rem",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                background: "var(--danger)",
                color: "#fff",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
            >
              {session.title.toUpperCase()} AGENT
            </span>
          </div>
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
            <p style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>
              @{session.title.toLowerCase()}_agent
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: "0.55rem",
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
  const [isInView, setIsInView] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldPlayRef = useRef(false);
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
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.currentTime = 0;
    video.load();
  }, [activeAgent, session?.phone_video]);

  useEffect(() => {
    shouldPlayRef.current = isInView;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (!shouldPlayRef.current) return;
      video.play().catch(() => { });
    };

    if (isInView) {
      tryPlay();
    } else {
      video.pause();
    }

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, [isInView, activeAgent, sessions]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => setCurrentTime(video.currentTime);
    const reset = () => setCurrentTime(0);
    const intervalId = window.setInterval(() => {
      sync();
      if (
        shouldPlayRef.current &&
        video.paused &&
        !video.ended &&
        video.readyState >= 2
      ) {
        video.play().catch(() => { });
      }
    }, 120);

    video.addEventListener("timeupdate", sync);
    video.addEventListener("seeked", sync);
    video.addEventListener("loadedmetadata", reset);
    video.addEventListener("loadeddata", sync);
    video.addEventListener("ended", reset);

    return () => {
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("seeked", sync);
      video.removeEventListener("loadedmetadata", reset);
      video.removeEventListener("loadeddata", sync);
      video.removeEventListener("ended", reset);
      window.clearInterval(intervalId);
    };
  }, [activeAgent, sessions]);

  const currentStep = useMemo(() => {
    if (!session || !session.steps.length) return null;
    const idx = Math.min(
      session.steps.length - 1,
      Math.floor(currentTime * session.feature_rate_hz)
    );
    return session.steps[idx];
  }, [session, currentTime]);

  if (!session || !currentStep) {
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

  const brainDisplayActivation = Math.min(
    0.9,
    Math.max(0.1, (currentStep.activation - 0.005) / 0.045 * 0.8 + 0.1)
  );

  return (
    <section ref={sectionRef} id="demo" style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ maxWidth: "900px" }}>
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Demo</h2>
        <p style={{ color: "var(--muted)", marginBottom: "2rem", maxWidth: "700px" }}>
          Heres a demo of the actual trained agents scrolling for you for a 30-second session.
          Switch between the baseline and cortisol agents and watch the actual
          selected TikToks and synchronized activations.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
          }}
        >
          {AGENT_ORDER.map((slug) => {
            const item = loadedSessions[slug];
            const isActive = slug === activeAgent;
            return (
              <button
                key={slug}
                onClick={() => {
                  setActiveAgent(slug);
                  setCurrentTime(0);
                }}
                className={isActive ? "btn btn-primary" : "btn"}
                style={{ cursor: "pointer" }}
              >
                {item.title}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "2rem",
            alignItems: "start",
          }}
        >
          <DemoPhone
            videoRef={videoRef}
            session={session}
            currentStep={currentStep}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                  minHeight: "380px",
                  padding: 0,
                }}
              >
                <BrainScene activation={brainDisplayActivation} spin={true} bg="#ffffff" />
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
                      fontSize: "0.7rem",
                      color: "rgba(0,0,0,0.5)",
                      background: "rgba(255,255,255,0.7)",
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    activation: {(currentStep.activation * 1000).toFixed(2)}×10⁻³
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "0.7rem",
                      color: "rgba(0,0,0,0.5)",
                      background: "rgba(255,255,255,0.7)",
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    t={currentTime.toFixed(1)}s · step {currentStep.step_idx + 1}/
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
                      fontSize: "0.7rem",
                      color: "var(--muted)",
                      marginBottom: "0.5rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Brain Region Activations (×10⁻³)
                  </p>
                  <RegionHeatmap regions={currentStep.region_activation} />
                </div>
                <BrainRotMeter level={currentStep.weighted_activation} />
              </div>
            </div>

            <ActivationPlot
              steps={session.steps}
              currentIndex={currentStep.step_idx}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
              }}
            >
              <div className="card" style={{ textAlign: "center" }}>
                <p
                  className="mono"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--danger)",
                  }}
                >
                  {(currentStep.activation * 1000).toFixed(2)}
                </p>
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Mean activation (×10⁻³)
                </p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <p
                  className="mono"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--secondary)",
                  }}
                >
                  {currentStep.cumulative_reward.toFixed(4)}
                </p>
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Cumulative reward
                </p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <p className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  c{currentStep.cluster_id}
                </p>
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Selected cluster
                </p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <p className="mono" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  {currentStep.scroll ? "YES" : "NO"}
                </p>
                <p
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Scroll action
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>


    </section>
  );
}
