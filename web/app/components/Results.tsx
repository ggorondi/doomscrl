"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNearViewport } from "./useNearViewport";

/* ── Types ── */
interface TBSeries {
  steps: number[];
  values: number[];
}

interface EvalResults {
  timesteps: number[];
  results: { mean: number[]; std: number[] };
  ep_lengths: { mean: number[]; std: number[] };
}

type TBData = Record<string, Record<string, TBSeries>>;
type EvalData = Record<string, EvalResults>;

/* ── Chart colors per variant ── */
const VARIANT_COLORS: Record<string, string> = {
  select_baseline: "#DC2626",
  select_recurrent_lstm: "#8B5CF6",
  select_cortisol: "#16A34A",
};

const VARIANT_LABELS: Record<string, string> = {
  select_baseline: "Baseline",
  select_recurrent_lstm: "Recurrent LSTM",
  select_cortisol: "Cortisol Reward",
};

/* ── Canvas line chart ── */
function LineChart({
  data,
  tag,
  title,
  subtitle,
  height = 200,
  variants,
  yLabel,
}: {
  data: TBData;
  tag: string;
  title: string;
  subtitle: string;
  height?: number;
  variants?: string[];
  yLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const variantList = variants || Object.keys(data);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 8, right: 12, bottom: 24, left: 48 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    let allVals: number[] = [];
    let maxStep = 0;
    for (const v of variantList) {
      const series = data[v]?.[tag];
      if (!series) continue;
      allVals = allVals.concat(series.values);
      maxStep = Math.max(maxStep, ...series.steps);
    }

    if (allVals.length === 0) return;

    const yMin = Math.min(...allVals);
    const yMax = Math.max(...allVals);
    const yRange = yMax - yMin || 1;
    const yPad = yRange * 0.05;

    ctx.strokeStyle = "#d1d1d1";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#999";
    ctx.font = "10px 'PT Mono', monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = yMax + yPad - ((yRange + yPad * 2) * i) / 4;
      const y = pad.top + (plotH * i) / 4;
      ctx.fillText(val > 100 ? val.toFixed(0) : val.toFixed(3), pad.left - 4, y + 3);
    }

    ctx.textAlign = "center";
    ctx.fillText("0", pad.left, H - 4);
    ctx.fillText(`${(maxStep / 1000).toFixed(0)}K`, W - pad.right, H - 4);

    for (const v of variantList) {
      const series = data[v]?.[tag];
      if (!series || series.steps.length === 0) continue;

      ctx.strokeStyle = VARIANT_COLORS[v] || "#999";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < series.steps.length; i++) {
        const x = pad.left + (series.steps[i] / maxStep) * plotW;
        const y = pad.top + ((yMax + yPad - series.values[i]) / (yRange + yPad * 2)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [data, tag, variantList]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <p style={{ fontSize: "0.9rem", fontWeight: 700 }}>{title}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{subtitle}</p>
        </div>
        {yLabel && (
          <span className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)", background: "var(--surface-alt)", padding: "0.15rem 0.4rem" }}>
            {yLabel}
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
      />
    </div>
  );
}

/* ── Legend ── */
function Legend({ variants }: { variants: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem" }}>
      {variants.map((v) => (
        <div key={v} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <div
            style={{ width: "0.75rem", height: "3px", borderRadius: "9999px", background: VARIANT_COLORS[v] }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {VARIANT_LABELS[v] || v}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Variant summary card ── */
function VariantSummary({
  name,
  data,
  evalData,
}: {
  name: string;
  data: Record<string, TBSeries>;
  evalData?: EvalResults;
}) {
  const reward = data["rollout/ep_rew_mean"];
  const lastReward = reward?.values[reward.values.length - 1] ?? 0;
  const firstReward = reward?.values[0] ?? 0;
  const improvement = firstReward > 0 ? ((lastReward - firstReward) / firstReward) * 100 : 0;

  const evalMean = evalData?.results?.mean;
  const evalLast = evalMean?.[evalMean.length - 1] ?? null;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div
          style={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", background: VARIANT_COLORS[name] }}
        />
        <h3 style={{ fontSize: "0.9rem", fontWeight: 700 }}>
          {VARIANT_LABELS[name]}
        </h3>
      </div>
      <p className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>{name}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
        <div style={{ textAlign: "center" }}>
          <p className="mono" style={{ fontSize: "1.1rem", fontWeight: 700, color: VARIANT_COLORS[name] }}>
            {lastReward.toFixed(1)}
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Final reward</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p className="mono" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            {improvement > 0 ? "+" : ""}{improvement.toFixed(0)}%
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>vs start</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p className="mono" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)" }}>
            {evalLast !== null ? evalLast.toFixed(1) : "---"}
          </p>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Eval mean</p>
        </div>
      </div>
    </div>
  );
}

export default function Results() {
  const [tbData, setTbData] = useState<TBData | null>(null);
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const shouldLoad = useNearViewport(sectionRef, "600px 0px");

  useEffect(() => {
    if (!shouldLoad) return;

    fetch("/data/tb_data.json")
      .then((r) => r.json())
      .then(setTbData)
      .catch(console.error);
    fetch("/data/eval_data.json")
      .then((r) => r.json())
      .then(setEvalData)
      .catch(console.error);
  }, [shouldLoad]);

  const variants = [
    "select_baseline",
    "select_recurrent_lstm",
    "select_cortisol",
  ];

  return (
    <section id="results" ref={sectionRef} style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ maxWidth: "900px" }}>
        <p className="separator">✺✺✺</p>


        <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
          Training Results
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          <strong>They actually learn!</strong> Kinda. Here's the metrics from training the agents on 878 TikTok
          videos, each for 500K timesteps (equivalent to ~70 hours of doomscrolling).
        </p>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          They basically learned to <strong>reward hack</strong> the env by scrolling as fast as possible (2Hz, the brain models frequency), which conveniently seems to <strong>fry the brain</strong> the most. They learn this behavior even when they have explicit penalties for fast scrolling.
          Technically speaking, this is what we asked for though.
        </p>

        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "44rem", margin: "0 auto" }}>
            <Image
              src="/overfit.png"
              alt="Training metrics showing the agents overfitting"
              width={1200}
              height={700}
              className="image"
            />
          </div>
        </div>

        {!shouldLoad || !tbData ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <p style={{ color: "var(--muted)" }}>
              {shouldLoad ? "Loading training data..." : "Charts load as you scroll."}
            </p>
          </div>
        ) : (
          <>
            <Legend variants={variants} />

            {/* Variant summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              {variants.map((v) => (
                <VariantSummary
                  key={v}
                  name={v}
                  data={tbData[v] || {}}
                  evalData={evalData?.[v]}
                />
              ))}
            </div>

            {/* Main charts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              <LineChart
                data={tbData}
                tag="rollout/ep_rew_mean"
                title="Episode Reward"
                subtitle="Mean reward per episode over training"
                variants={variants}
                yLabel="reward"
                height={220}
              />
              <LineChart
                data={tbData}
                tag="custom/reward_activation"
                title="Cortical Activation"
                subtitle="Mean absolute activation across 20,484 vertices"
                variants={variants}
                yLabel="activation"
                height={220}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              <LineChart
                data={tbData}
                tag="custom/reward_delta"
                title="Activation Delta"
                subtitle="‖Δactivation‖ between timesteps"
                variants={variants}
                yLabel="Δ"
                height={180}
              />
              <LineChart
                data={tbData}
                tag="custom/reward_total"
                title="Reward Total"
                subtitle="Combined α·act + β·Δ reward"
                variants={variants}
                yLabel="reward"
                height={180}
              />
              <LineChart
                data={tbData}
                tag="custom/mean_watch_steps_per_video"
                title="Watch Duration"
                subtitle="Mean steps per video before scrolling"
                variants={variants}
                yLabel="steps"
                height={180}
              />
            </div>

            {/* Region activations */}
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "2rem", marginBottom: "1rem" }}>
              Brain Region Activations
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "1.04rem", marginBottom: "1rem" }}>
              Mean activation per brain region across training (select_baseline).
            </p>
            <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem", minWidth: "832px" }}>
                {["LAD", "LAV", "LPD", "LPV", "RAD", "RAV", "RPD", "RPV"].map(
                  (region) => (
                    <LineChart
                      key={region}
                      data={tbData}
                      tag={`custom/region_activation/${region}`}
                      title={region}
                      subtitle=""
                      variants={["select_baseline", "select_cortisol"]}
                      height={100}
                    />
                  )
                )}
              </div>
            </div>

            {/* Training diagnostics */}
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "2rem", marginBottom: "1rem" }}>
              Training Diagnostics
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <LineChart
                data={tbData}
                tag="train/entropy_loss"
                title="Entropy Loss"
                subtitle="Policy exploration level"
                variants={variants}
                height={140}
              />
              <LineChart
                data={tbData}
                tag="train/explained_variance"
                title="Explained Variance"
                subtitle="Value function quality (1.0 = perfect)"
                variants={variants}
                height={140}
              />
              <LineChart
                data={tbData}
                tag="train/clip_fraction"
                title="Clip Fraction"
                subtitle="PPO clipping rate"
                variants={variants}
                height={140}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
