"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.08)_0%,_transparent_70%)]" />

      <div className="absolute inset-0 w-full h-full">
        <BrainScene />
      </div>

      <div className="relative z-10 text-center px-4 pointer-events-none">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm uppercase tracking-[0.3em] text-[var(--muted)] mb-6"
        >
          Silly Hacks 2026
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-6xl md:text-8xl font-black gradient-text mb-6"
        >
          brainrotmaxxer
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-12"
        >
          Reinforcement learning meets neuroscience.
          <br />
          An AI that optimizes doomscrolling by maximizing simulated brain
          activation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex gap-4 justify-center pointer-events-auto"
        >
          <a
            href="#demo"
            className="px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-lg hover:brightness-110 transition"
          >
            Try the Demo
          </a>
          <a
            href="https://github.com/ggorondi/brainrotmaxxer"
            target="_blank"
            className="px-6 py-3 border border-[var(--card-border)] rounded-lg hover:border-[var(--accent2)] transition"
          >
            GitHub
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 text-[var(--muted)] text-sm animate-bounce"
      >
        scroll down
      </motion.div>
    </section>
  );
}
