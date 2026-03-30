"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const BrainScene = dynamic(() => import("./BrainScene"), { ssr: false });

const VIDEOS = ["/videos/v1.mp4", "/videos/v2.mp4", "/videos/v3.mp4", "/videos/v4.mp4", "/videos/v5.mp4"];

function TikSlopPhone({ videoIdx, onNext }: { videoIdx: number; onNext: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onNext();
    el.addEventListener("ended", handler);
    el.play().catch(() => {});
    return () => el.removeEventListener("ended", handler);
  }, [videoIdx, onNext]);

  return (
    <div style={{ perspective: 900 }} className="flex items-center justify-center">
      <div
        className="relative bg-black rounded-[2.5rem] p-3"
        style={{
          width: 280,
          transform: "rotateY(-18deg) rotateX(4deg)",
          boxShadow: "-20px 20px 60px rgba(0,0,0,0.25), -6px 6px 20px rgba(0,0,0,0.15)",
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10" />

        <div className="relative rounded-[2rem] overflow-hidden bg-black" style={{ aspectRatio: "9/19.5" }}>
          <video
            ref={ref}
            key={videoIdx}
            src={VIDEOS[videoIdx]}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4 z-10">
            <span className="text-white/60 text-[10px] font-semibold">9:41</span>
            <span className="text-white text-sm font-bold tracking-wide">tikslop</span>
            <span className="text-white/60 text-[10px]">100%</span>
          </div>

          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span className="text-white text-[10px] mt-0.5">24.1K</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/></svg>
              <span className="text-white text-[10px] mt-0.5">891</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
              <span className="text-white text-[10px] mt-0.5">Share</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10">
            <p className="text-white text-xs font-bold mb-0.5">@brainrotmaxxer</p>
            <p className="text-white/80 text-[11px] leading-snug mb-2">
              optimizing your cortical activation rn
            </p>
            <button
              onClick={onNext}
              className="text-[10px] text-white/50 hover:text-white transition"
            >
              skip &rarr;
            </button>
          </div>
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full" />
      </div>
    </div>
  );
}

export default function Hero() {
  const [videoIdx, setVideoIdx] = useState(0);

  const nextVideo = () => setVideoIdx((i) => (i + 1) % VIDEOS.length);

  return (
    <section className="bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 min-h-[min(100dvh,900px)] items-center py-14 md:py-16">
        <div className="flex flex-col">
          <div className="relative w-full" style={{ height: 320 }}>
            <BrainScene
              bg="#ffffff"
              spin={false}
              yRotation={Math.PI * 0.35}
              activation={0.5}
            />
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-3 mono">
              Silly Hacks 2026
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--fg)] tracking-tight mb-4">
              brainrotmaxxer
            </h1>
            <p className="text-base md:text-lg text-[var(--muted)] max-w-md leading-relaxed mb-6">
              RL agents trained to maximize predicted brain activation while
              doomscrolling, using Meta&apos;s TRIBE v2 brain model.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#demo"
                className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
              >
                Demo
              </a>
              <a
                href="https://github.com/ggorondi/brainrotmaxxer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex px-5 py-2.5 border border-[var(--border-strong)] text-[var(--fg)] text-sm font-medium rounded-md hover:border-[var(--fg)] transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <TikSlopPhone videoIdx={videoIdx} onNext={nextVideo} />
      </div>
    </section>
  );
}
