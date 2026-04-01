import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background:
            "radial-gradient(circle at 50% 22%, rgba(221,81,58,0.18), transparent 24%), linear-gradient(180deg, #ffffff 0%, #f7f6f2 100%)",
          color: "#111111",
          fontFamily: "Times New Roman, serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(180deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.35,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 42,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: "monospace",
            fontSize: 22,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#6b6b6b",
          }}
        >
          Silly Hacks 2026
        </div>

        <div
          style={{
            position: "absolute",
            top: 110,
            left: "50%",
            transform: "translateX(-50%)",
            width: 330,
            height: 330,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(255,255,255,0.25) 24%, rgba(221,81,58,0.16) 42%, rgba(0,0,0,0.03) 62%, transparent 70%)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.08)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 205,
            left: "50%",
            transform: "translateX(-50%)",
            width: 130,
            height: 130,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 35%, #ffffff 0%, #f7d8cf 26%, #dd513a 58%, #7c2d12 100%)",
            opacity: 0.9,
            boxShadow: "0 18px 50px rgba(221,81,58,0.3)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 120,
            right: 120,
            bottom: 90,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -2,
              marginBottom: 18,
            }}
          >
            doomscRL
          </div>
          <div
            style={{
              maxWidth: 860,
              fontSize: 33,
              lineHeight: 1.45,
              color: "#555555",
            }}
          >
            Training RL agents to optimize TikTok scrolling patterns for maximal brainrot, using Meta&apos;s TRIBEv2 brain-response model.
          </div>
        </div>
      </div>
    ),
    size
  );
}
