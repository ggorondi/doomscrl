const placeholderResults = [
  {
    title: "Policy 1: Scroll Timing",
    desc: "The agent learns to scroll away from low-activation videos within 2-3 seconds, while staying on high-activation content for 6-8 seconds.",
    metrics: [
      { label: "Avg reward", value: "---", note: "vs baseline" },
      { label: "Scroll rate", value: "---", note: "scrolls/min" },
      { label: "Improvement", value: "---", note: "over random" },
    ],
  },
  {
    title: "Policy 2: Scroll + Select",
    desc: "The agent additionally learns which video clusters maximize brain activation, consistently preferring high-engagement viral content.",
    metrics: [
      { label: "Avg reward", value: "---", note: "vs baseline" },
      { label: "Top cluster", value: "---", note: "preferred" },
      { label: "Improvement", value: "---", note: "over Policy 1" },
    ],
  },
];

function barHeight(i: number) {
  return 10 + Math.log(i + 1) * 20 + Math.sin(i * 0.5) * 8 + ((i * 17) % 6);
}

export default function Results() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
          Results
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-10">
          Training in progress. Results will appear here once the RL agents
          have been trained on the GPU.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {placeholderResults.map((result) => (
            <div key={result.title} className="card p-5">
              <h3 className="text-base font-semibold mb-2">{result.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-6">{result.desc}</p>
              <div className="grid grid-cols-3 gap-3">
                {result.metrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-2xl mono font-bold text-[var(--border-strong)]">
                      {m.value}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-8 text-center">
          <p className="text-[var(--muted)] mb-2">
            Training reward curve (placeholder)
          </p>
          <div className="h-48 flex items-end justify-center gap-1">
            {Array.from({ length: 40 }).map((_, i) => {
              const h = barHeight(i);
              return (
                <div
                  key={i}
                  className="w-2 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: `var(--border-strong)`,
                    opacity: 0.4 + (i / 40) * 0.6,
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted)] mt-4">
            Simulated. Real results pending GPU training run.
          </p>
        </div>
      </div>
    </section>
  );
}
