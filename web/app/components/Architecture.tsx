"use client";

import Image from "next/image";
import dynamic from "next/dynamic";

const PipelineDiagram = dynamic(() => import("./PipelineDiagram"), { ssr: false });

/* ── Pipeline node data ── */
const pipelineNodes = [
  {
    id: "videos",
    label: "TikTok Videos",
    detail: "878 videos selected from the TikTok-10M dataset",
    sub: "Clustered into 9 groups by similarity",
  },
  {
    id: "brain",
    label: "Brain Model",
    detail: "TRIBE v2 FmriEncoder predicts cortical response.",
    sub: "20,484 surface vertices",
  },
  {
    id: "agent",
    label: "RL Scrolling Agent",
    detail: "PPO learns when to scroll and what video cluster to select next",
    sub: "Reward = avg activation + delta",
  },
];

/* ── Technical details below the pipeline ── */
const techDetails = [
  {
    title: "Feature Extraction (Preprocessing)",
    items: [
      "V-JEPA 2 — 8 layer groups × 1,280-dim visual features",
      "Wav2Vec-BERT 2.0 — 9 layer groups × 1,024-dim audio features",
      "Concatenated per-modality, projected into shared 1,152-dim space"
    ],
  },
  {
    title: "Brain Model (runs during RL)",
    items: [
      "FmriEncoder: 8 transformer blocks with RoPE, ScaleNorm, scaled residuals",
      "Low-rank projection head → 2,048 dims before final prediction",
      "Subject-averaged readout layer → 20,484 cortical surface vertices (fsaverage5)"
    ],
  },
  {
    title: "Reward Signal",
    items: [
      "DopamineReward: α × mean(|activation|) + β × ‖Δactivation‖",
      "CortisolReward variant: region-weighted activation (anterior-ventral 2.2×)",
      "Optional switch penalty + minimum dwell time enforcement"
    ],
  },
];

/* ── Agent variants ── */
const variants = [
  {
    id: "a",
    name: "select_baseline",
    env: "ScrollSelect",
    desc: "Baseline select policy — PPO + MLP, no penalties, dopamine reward",
  },
  {
    id: "b",
    name: "select_recurrent_lstm",
    env: "ScrollSelect",
    desc: "LSTM policy with brain region observation, has richer context",
  },
  {
    id: "c",
    name: "select_cortisol",
    env: "ScrollSelect",
    desc: "Cortisol reward: weights anterior-ventral regions 2.2× for stress-like activation",
  },
];

export default function Architecture() {
  return (
    <section style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ maxWidth: "900px" }}>
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.95rem", marginBottom: "0.5rem" }}>
          How?
        </h2>

        {/* ── Pipeline ── */}
        <div style={{ display: "flex", alignItems: "stretch", gap: "0.75rem", marginBottom: "2.5rem" }}>
          {pipelineNodes.map((node, i) => (
            <div key={node.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
              <div className="card" style={{ flex: 1 }}>
                <p className="mono" style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--muted)" }}>
                  {String(i + 1)}
                </p>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.35rem" }}>{node.label}</h3>
                <p style={{ fontSize: "1.02rem", color: "var(--muted)", marginBottom: "0.35rem" }}>{node.detail}</p>
                <p style={{ fontSize: "0.95rem", color: "var(--muted)", opacity: 0.7 }}>
                  {node.sub}
                </p>
              </div>
              {i < pipelineNodes.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    alignSelf: "center",
                    color: "var(--muted)",
                    fontSize: "1.35rem",
                    flexShrink: 0,
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: "1.06rem", color: "var(--muted)", marginBottom: "2rem" }}>
        We simulate how each moment in a TikTok session would activate the brain with a <strong>pretrained FmriEncoder</strong>, derive a heuristic for <em>dopamine usage</em> to use as a reward signal, and then train an RL agent to discover the scrolling behavior that produces the <strong>highest overall activation</strong>.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <Image
              src="/gem.gif"
              alt="Gem reward visualization"
              width={640}
              height={360}
              className="image"
            />
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <Image
              src="/coal.gif"
              alt="Coal reward visualization"
              width={640}
              height={360}
              className="image"
            />
          </div>
        </div>

        {/* ── Detailed pipeline diagram ── */}
        <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>Architecture</h3>
        <p style={{ fontSize: "1.08rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Full RL data flow from raw video, through the FmriEncoder transformer, to brain activation predictions, reward computation, and PPO agent actions: scrolling and next video selection.
        </p>
        <div
          style={{
            width: "min(1060px, calc(100vw - 2rem))",
            marginLeft: "50%",
            transform: "translateX(-50%)",
            marginBottom: "2.5rem",
          }}
        >
          <div style={{ marginBottom: "2.5rem" }}>
            <PipelineDiagram />
          </div>

          {/* ── Technical details ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            {techDetails.map((section) => (
              <div key={section.title} className="card">
                <h3 style={{ fontSize: "1.08rem", fontWeight: 700, marginBottom: "0.75rem" }}>{section.title}</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {section.items.map((item, i) => (
                    <li key={i} style={{ fontSize: "0.98rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "0.5rem", display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: "var(--border)", flexShrink: 0 }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trained variants ── */}
        <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>Trained variants</h3>
        <p style={{ fontSize: "1.08rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
          We explore three agent configurations with different RL setups and
          reward functions.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {variants.map((v) => (
            <div key={v.id} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: "50%",
                  background: "var(--fg)",
                  color: "var(--bg)",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                }}>
                  {v.id}
                </span>
                <span className="mono" style={{ fontSize: "0.95rem", color: "var(--muted)" }}>
                  {v.env}
                </span>
              </div>
              <h4 className="mono" style={{ fontSize: "1.02rem", fontWeight: 700, marginBottom: "0.25rem" }}>{v.name}</h4>
              <p style={{ fontSize: "0.98rem", color: "var(--muted)", lineHeight: 1.5 }}>
                {v.desc}
              </p>
            </div>
          ))}
        </div>
        <div style={{ height: "2rem" }} />

        <p style={{ fontSize: "1.08rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Training was run on 5x RTX PRO 4500 instances for about 12 hours. About $30.
        </p>
        {/* RunPod training screenshot */}
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto" }}>
            <Image
              src="/runpod.png"
              alt="Training runs on RunPod GPU instances"
              width={1200}
              height={600}
              className="image"
            />
          </div>
        </div>
        <div style={{ height: "2rem" }} />

        {/* matrix */}
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "28rem", margin: "0 auto" }}>
            <Image
              src="/matrix.png"
              alt="No thanks i use ai"
              width={600}
              height={500}
              className="image"
            />
          </div>
        </div>

      </div>
    </section>
  );
}
