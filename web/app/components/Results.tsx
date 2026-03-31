"use client";

const placeholderResults = [
  {
    title: "Policy 1: Scroll Timing",
    variant: "b — scroll_random_feed",
    desc: "The agent learns to scroll away from low-activation videos within 2-3 seconds, while staying on high-activation content for 6-8 seconds.",
    metrics: [
      { label: "Avg reward", value: "---", note: "vs baseline" },
      { label: "Scroll rate", value: "---", note: "scrolls/min" },
      { label: "Improvement", value: "---", note: "over random" },
    ],
  },
  {
    title: "Policy 2: Scroll + Select",
    variant: "a — select_baseline",
    desc: "The agent additionally learns which video clusters maximize brain activation, consistently preferring high-engagement viral content.",
    metrics: [
      { label: "Avg reward", value: "---", note: "vs baseline" },
      { label: "Top cluster", value: "---", note: "preferred" },
      { label: "Improvement", value: "---", note: "over Policy 1" },
    ],
  },
];

/* ── Placeholder chart bars ── */
function PlaceholderChart({
  title,
  subtitle,
  bars = 50,
  color = "var(--border-strong)",
}: {
  title: string;
  subtitle: string;
  bars?: number;
  color?: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-[var(--muted)]">{subtitle}</p>
        </div>
        <span className="text-[10px] mono bg-[var(--surface-alt)] text-[var(--muted)] px-2 py-0.5 rounded border border-[var(--border)]">
          PLACEHOLDER
        </span>
      </div>
      <div className="h-32 flex items-end gap-[2px]">
        {Array.from({ length: bars }).map((_, i) => {
          const progress = i / bars;
          const base = 15 + Math.log(i + 1) * 15;
          const noise = Math.sin(i * 0.7) * 8 + Math.cos(i * 1.3) * 5;
          const trend = progress * 25;
          const h = Math.min(95, Math.max(5, base + noise + trend));
          return (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${h}%`,
                background: color,
                opacity: 0.3 + progress * 0.7,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--muted)] mt-2 mono">
        <span>0</span>
        <span>Training Steps</span>
        <span>500K</span>
      </div>
    </div>
  );
}

export default function Results() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
          Results
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-10">
          Training metrics and comparison across agent variants. Real data will
          be populated from TensorBoard logs.
        </p>

        {/* Policy result cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {placeholderResults.map((result) => (
            <div key={result.title} className="card p-5">
              <h3 className="text-base font-semibold mb-1">{result.title}</h3>
              <p className="text-[10px] mono text-[var(--muted)] mb-3">
                {result.variant}
              </p>
              <p className="text-sm text-[var(--muted)] mb-6">{result.desc}</p>
              <div className="grid grid-cols-3 gap-3">
                {result.metrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-2xl mono font-bold text-[var(--border-strong)]">
                      {m.value}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder metric charts */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <PlaceholderChart
            title="Episode Reward"
            subtitle="Mean reward per episode over training"
            color="var(--danger)"
          />
          <PlaceholderChart
            title="Cortical Activation"
            subtitle="Mean absolute activation across vertices"
            color="var(--secondary)"
          />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <PlaceholderChart
            title="Watch Duration"
            subtitle="Mean seconds per video"
            bars={30}
            color="var(--warning)"
          />
          <PlaceholderChart
            title="Scroll Rate"
            subtitle="Manual scrolls per episode"
            bars={30}
            color="var(--success)"
          />
          <PlaceholderChart
            title="Cluster Preference"
            subtitle="Video cluster selection distribution"
            bars={10}
            color="var(--primary)"
          />
        </div>

        <p className="text-xs text-[var(--muted)] text-center mt-6 mono">
          Placeholder charts — real TensorBoard data pending transfer from training pods.
        </p>
      </div>
    </section>
  );
}
