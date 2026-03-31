"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

export default function Hero() {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      setMouseOffset({ x, y });
    },
    []
  );

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      style={{ paddingTop: "3rem", paddingBottom: "3rem" }}
    >
      <div className="container-middle" style={{ textAlign: "center" }}>
        {/* 3D scene — brain + video sphere — contained above title */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "420px",
            marginBottom: "2rem",
          }}
        >
          <HeroScene mouseOffset={mouseOffset} />
        </div>

        {/* Text below the sphere */}
        <p
          className="mono"
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "var(--muted)",
            marginBottom: "0.75rem",
          }}
        >
          Silly Hacks 2026
        </p>
        <h1
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 700,
            marginBottom: "1rem",
            letterSpacing: "-0.02em",
          }}
        >
          brainrotmaxxer
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--muted)",
            maxWidth: "480px",
            margin: "0 auto 1.5rem",
            lineHeight: 1.6,
          }}
        >
          Training RL agents to optimize scrolling patterns to maximize for brainrot, using Meta's TRIBEv2 brain model to simulate neural activation.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <a href="#demo" className="btn btn-primary">
            Demo
          </a>
          <a
            href="https://github.com/ggorondi/brainrotmaxxer"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
