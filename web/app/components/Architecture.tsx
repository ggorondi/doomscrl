"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6 },
};

const steps = [
  {
    num: "01",
    title: "TikTok video feed",
    desc: "878 real TikTok videos across three tiers: viral hits, high-engagement, and random. The raw material for brain destruction.",
    accent: "var(--accent)",
  },
  {
    num: "02",
    title: "Backbone feature extraction",
    desc: "V-JEPA 2 (video) and Wav2Vec-BERT 2.0 (audio) extract rich multimodal representations at 2 Hz. Precomputed on GPU.",
    accent: "var(--accent2)",
  },
  {
    num: "03",
    title: "TRIBE v2 brain model",
    desc: "An 8-layer transformer predicts fMRI activation across ~20k cortical vertices. It maintains temporal context, so it 'remembers' previous videos.",
    accent: "#06b6d4",
  },
  {
    num: "04",
    title: "Dopamine proxy reward",
    desc: "Mean absolute brain activation + rate of change = your 'dopamine score'. The RL agent maximizes this relentlessly.",
    accent: "var(--accent)",
  },
  {
    num: "05",
    title: "PPO-Clip RL agent",
    desc: "Two policies: one learns optimal scroll timing, the other also learns what type of video to serve next. Pure brain rot optimization.",
    accent: "var(--accent2)",
  },
];

export default function Architecture() {
  return (
    <section className="py-32 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          {...fadeUp}
          className="text-4xl md:text-5xl font-bold mb-4"
        >
          How it works
        </motion.h2>
        <motion.p
          {...fadeUp}
          className="text-[var(--muted)] text-lg mb-16"
        >
          A five-stage pipeline from raw video to maximum brain activation.
        </motion.p>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--accent)] via-[var(--accent2)] to-transparent" />

          <div className="space-y-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="relative pl-16"
              >
                <div
                  className="absolute left-3 top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-mono"
                  style={{ borderColor: step.accent, color: step.accent }}
                >
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-[var(--muted)]">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
