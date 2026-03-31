"use client";

/* ── Pipeline node data ── */
const pipelineNodes = [
  {
    id: "videos",
    label: "TikTok Videos",
    detail: "878 videos · 3 tiers",
    sub: "top-200 · high-300 · random-500",
    color: "#6B7280",
  },
  {
    id: "backbone",
    label: "Backbone Features",
    detail: "V-JEPA 2 + W2V-BERT 2.0",
    sub: "Precomputed on GPU at 2 Hz",
    color: "#3B82F6",
  },
  {
    id: "brain",
    label: "FmriEncoder",
    detail: "8-layer transformer",
    sub: "20,484 cortical vertices",
    color: "#8B5CF6",
  },
  {
    id: "reward",
    label: "Dopamine Reward",
    detail: "α·activation + β·Δactivation",
    sub: "Penalizes rapid switching",
    color: "#DC2626",
  },
  {
    id: "agent",
    label: "PPO-Clip Agent",
    detail: "MLP [256, 256]",
    sub: "Scroll timing + video selection",
    color: "#111111",
  },
];

/* ── Technical details below the pipeline ── */
const techDetails = [
  {
    title: "Feature Extraction (GPU, one-time)",
    items: [
      "V-JEPA 2 — 8 layer groups × 1,280-dim visual features",
      "Wav2Vec-BERT 2.0 — 9 layer groups × 1,024-dim audio features",
      "Concatenated per-modality, projected into shared 1,152-dim space",
      "Extracted at 2 Hz (one frame per 0.5s of video)",
    ],
  },
  {
    title: "Brain Model (runs during RL)",
    items: [
      "FmriEncoder: 8 transformer blocks with RoPE, ScaleNorm, scaled residuals",
      "Low-rank projection head → 2,048 dims before final prediction",
      "Subject-averaged readout layer → 20,484 cortical surface vertices (fsaverage5)",
      "Maintains temporal context across video transitions (up to 1,024 steps)",
    ],
  },
  {
    title: "Reward Signal",
    items: [
      "DopamineReward: α × mean(|activation|) + β × ‖Δactivation‖",
      "CortisolReward variant: region-weighted activation (anterior-ventral 2.2×)",
      "Optional switch penalty + minimum dwell time enforcement",
      "8 brain regions tracked: LAD, LAV, LPD, LPV, RAD, RAV, RPD, RPV",
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
    name: "scroll_random_feed",
    env: "Scroll",
    desc: "Scroll timing only, random video order — learns WHEN to scroll",
  },
  {
    id: "c",
    name: "select_switch_penalty",
    env: "ScrollSelect",
    desc: "Penalizes rapid switching (0.05 penalty + 2s min dwell + 0.25 short-dwell penalty)",
  },
  {
    id: "d",
    name: "select_recurrent_lstm",
    env: "ScrollSelect",
    desc: "LSTM policy with brain region observations — memory across decisions",
  },
  {
    id: "e",
    name: "select_cortisol",
    env: "ScrollSelect",
    desc: "Cortisol reward: weights anterior-ventral regions 2.2× for stress-like activation",
  },
];

function ArrowRight() {
  return (
    <div className="hidden lg:flex items-center justify-center flex-shrink-0 w-8">
      <svg
        width="32"
        height="20"
        viewBox="0 0 32 20"
        fill="none"
        className="text-[var(--border-strong)]"
      >
        <path
          d="M0 10H28M28 10L22 4M28 10L22 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex lg:hidden items-center justify-center h-8">
      <svg
        width="20"
        height="32"
        viewBox="0 0 20 32"
        fill="none"
        className="text-[var(--border-strong)]"
      >
        <path
          d="M10 0V28M10 28L4 22M10 28L16 22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Architecture() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
          How it works
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-12">
          From raw TikTok videos to maximum brain activation in five stages.
        </p>

        {/* ── Pipeline diagram ── */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-0 mb-16 overflow-x-auto pb-4 lg:pb-0">
          {pipelineNodes.map((node, i) => (
            <div key={node.id} className="contents">
              <div
                className="relative flex-1 min-w-[160px] rounded-lg p-4 border-2"
                style={{
                  borderColor: node.color,
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-md"
                  style={{ background: node.color }}
                />
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-1 mono"
                  style={{ color: node.color }}
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="text-sm font-semibold mb-1">{node.label}</h3>
                <p className="text-xs text-[var(--muted)]">{node.detail}</p>
                <p className="text-[10px] text-[var(--muted)] mt-1 opacity-70">
                  {node.sub}
                </p>
              </div>
              {i < pipelineNodes.length - 1 && (
                <>
                  <ArrowRight />
                  <ArrowDown />
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Technical details ── */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {techDetails.map((section) => (
            <div key={section.title} className="card p-5">
              <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="text-xs text-[var(--muted)] leading-relaxed flex gap-2">
                    <span className="text-[var(--border-strong)] mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Trained variants ── */}
        <h3 className="text-lg font-semibold mb-4">Trained variants</h3>
        <p className="text-sm text-[var(--muted)] mb-6">
          Five agent configurations exploring different RL setups, reward
          signals, and observation spaces.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {variants.map((v) => (
            <div key={v.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[var(--fg)] text-white text-xs font-bold flex items-center justify-center mono">
                  {v.id}
                </span>
                <span className="text-xs mono text-[var(--muted)]">
                  {v.env}
                </span>
              </div>
              <h4 className="text-sm font-semibold mb-1 mono">{v.name}</h4>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {v.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
