import Image from "next/image";

export default function Conclusion() {
  return (
    <section style={{ padding: "3rem 0" }}>
      <div className="container-middle" style={{ textAlign: "center" }}>
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem" }}>
          What have we done?
        </h2>

        {/* Pure brainrot image */}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
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

        <p style={{ maxWidth: "42rem", margin: "1.5rem auto 0", color: "var(--muted)" }}>
          we have created the perfect doomscroller, it can fit your 4 hour sessions into a single hour and a half. Use the model responsibly.
        </p>

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
            href="https://sillyhacks.dev"
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
