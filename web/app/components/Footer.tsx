export default function Footer() {
  return (
    <footer style={{ padding: "2rem 0 3rem" }}>
      <div className="container-middle">
        <p className="separator">✺✺✺</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              brainrotmaxxer
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
              An RL-powered doomscroll optimizer that uses a real brain model
              to learn maximal cortical activation. Built for Silly Hacks 2026 Hackathon.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: "0.75rem" }}>
              Links
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <li>
                <a
                  href="https://github.com/ggorondi/brainrotmaxxer"
                  target="_blank"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://huggingface.co/facebook/tribev2"
                  target="_blank"
                >
                  TRIBE v2 Model
                </a>
              </li>
              <li>
                <a
                  href="https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/"
                  target="_blank"
                >
                  TRIBE v2 Blog Post
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: "0.75rem" }}>
              Built with
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem", color: "var(--muted)" }}>
              <li>TRIBE v2 (Meta FAIR)</li>
              <li>V-JEPA 2 + Wav2Vec-BERT</li>
              <li>Stable-Baselines3 (PPO)</li>
              <li>Gymnasium</li>
              <li>Next.js + Three.js</li>
            </ul>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
          <p>
            This is a hackathon project. Please doomscroll
            responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}
