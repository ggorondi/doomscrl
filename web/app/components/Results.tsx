"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6 },
};

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

export default function Results() {
  return (
    <section className="py-32 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          {...fadeUp}
          className="text-4xl md:text-5xl font-bold mb-4"
        >
          Results
        </motion.h2>
        <motion.p
          {...fadeUp}
          className="text-[var(--muted)] text-lg mb-12"
        >
          Training in progress. Results will appear here once the RL agents
          have been trained on the GPU.
        </motion.p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {placeholderResults.map((result) => (
            <motion.div key={result.title} {...fadeUp} className="card p-6">
              <h3 className="text-xl font-semibold mb-3">{result.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-6">{result.desc}</p>
              <div className="grid grid-cols-3 gap-3">
                {result.metrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-2xl font-mono font-bold text-[var(--muted)]">
                      {m.value}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          {...fadeUp}
          className="card p-8 text-center border-dashed border-[var(--card-border)]"
        >
          <p className="text-[var(--muted)] mb-2">
            Training reward curve (placeholder)
          </p>
          <div className="h-48 flex items-end justify-center gap-1">
            {Array.from({ length: 40 }).map((_, i) => {
              const h =
                10 + Math.log(i + 1) * 20 + Math.sin(i * 0.5) * 8 + Math.random() * 5;
              return (
                <div
                  key={i}
                  className="w-2 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, var(--accent2), var(--accent))`,
                    opacity: 0.4 + (i / 40) * 0.6,
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-4">
            Simulated. Real results pending GPU training run.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
