"use client";

import Image from "next/image";
import { useRef } from "react";
import { useNearViewport } from "./useNearViewport";

export default function Conclusion() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const shouldLoadVideos = useNearViewport(sectionRef, "400px 0px");

  return (
    <section ref={sectionRef} style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ textAlign: "center" }}>
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem" }}>
          What have we done?
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
            marginBottom: "2rem",
            textAlign: "left",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                color: "var(--muted)",
              }}
            >
              how it feels to manually scroll
            </p>
            <video
              src={shouldLoadVideos ? "/before_auto_scroll.mp4" : undefined}
              autoPlay={shouldLoadVideos}
              muted
              loop
              playsInline
              preload="none"
              className="image"
              style={{ display: "block", width: "100%" }}
            />
          </div>
          <div>
            <p
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                color: "var(--muted)",
              }}
            >
              how it feels when ai scrolls for you
            </p>
            <video
              src={shouldLoadVideos ? "/after_auto_scroll.mp4" : undefined}
              autoPlay={shouldLoadVideos}
              muted
              loop
              playsInline
              preload="none"
              className="image"
              style={{ display: "block", width: "100%" }}
            />
          </div>
        </div>

        <p style={{ maxWidth: "42rem", margin: "1.5rem auto 0", color: "var(--muted)" }}>
          we have created the perfect doomscroller, it can fit your 4 hour sessions into a single hour and a half. Use the model responsibly.
        </p>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <div style={{ maxWidth: "32rem", margin: "0 auto" }}>
            <Image
              src="/pure_slopium.png"
              alt="Pure brainrot"
              width={800}
              height={600}
              className="image"
            />
          </div>
        </div>

        <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          <a
            href="https://github.com/ggorondi/brainrotmaxxer"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            View on GitHub
          </a>
          <a
            href="https://sillyhacks.nyc/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            Silly Hacks 2026
          </a>
        </div>
      </div>
    </section>
  );
}
