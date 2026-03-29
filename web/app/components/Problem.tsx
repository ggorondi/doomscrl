"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6 },
};

export default function Problem() {
  return (
    <section className="relative py-32 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          {...fadeUp}
          className="text-4xl md:text-5xl font-bold mb-8"
        >
          The premise
        </motion.h2>

        <motion.p
          {...fadeUp}
          className="text-xl text-[var(--muted)] leading-relaxed mb-12"
        >
          Social media companies spend billions engineering recommendation
          algorithms that keep you scrolling. They optimize for{" "}
          <span className="text-[var(--fg)]">engagement</span>,{" "}
          <span className="text-[var(--fg)]">retention</span>, and{" "}
          <span className="text-[var(--fg)]">watch time</span> &mdash; dancing
          around the uncomfortable truth that they&rsquo;re essentially
          optimizing for how effectively they can hijack your dopamine system.
        </motion.p>

        <motion.div {...fadeUp} className="card p-8 glow-accent mb-12">
          <p className="text-2xl font-semibold mb-4">
            We asked:{" "}
            <span className="gradient-text">
              what if we just did that explicitly?
            </span>
          </p>
          <p className="text-[var(--muted)] text-lg">
            Using Meta&rsquo;s own TRIBE v2 brain model to predict neural
            activation, we train RL agents whose sole objective is to maximize
            the rate at which your brain &ldquo;fries&rdquo; &mdash; maximizing
            predicted cortical activation across 20,484 brain surface
            vertices while doomscrolling through TikTok.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              label: "Their approach",
              desc: "Optimize engagement metrics as a proxy for dopamine hijacking. Don't talk about it.",
              color: "text-[var(--muted)]",
            },
            {
              label: "Our approach",
              desc: "Directly optimize predicted brain activation using a state-of-the-art neural encoding model.",
              color: "text-[var(--accent)]",
            },
            {
              label: "The joke",
              desc: "Cutting-edge AI and neuroscience applied to the dumbest possible use case: frying your brain on purpose.",
              color: "text-[var(--accent2)]",
            },
          ].map((item) => (
            <motion.div key={item.label} {...fadeUp} className="card p-6">
              <p className={`font-semibold mb-2 ${item.color}`}>
                {item.label}
              </p>
              <p className="text-sm text-[var(--muted)]">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
