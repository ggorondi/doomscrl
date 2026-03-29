"use client";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div>
            <h3 className="font-bold text-lg gradient-text mb-3">
              brainrotmaxxer
            </h3>
            <p className="text-sm text-[var(--muted)]">
              An RL-powered doomscroll optimizer that uses a real brain model
              to maximize cortical activation. Built for Silly Hacks 2026.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
              Links
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/ggorondi/brainrotmaxxer"
                  target="_blank"
                  className="text-gray-400 hover:text-[var(--accent)] transition"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://huggingface.co/facebook/tribev2"
                  target="_blank"
                  className="text-gray-400 hover:text-[var(--accent)] transition"
                >
                  TRIBE v2 Model
                </a>
              </li>
              <li>
                <a
                  href="https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/"
                  target="_blank"
                  className="text-gray-400 hover:text-[var(--accent)] transition"
                >
                  TRIBE v2 Blog Post
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
              Built with
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>TRIBE v2 (Meta FAIR)</li>
              <li>V-JEPA 2 + Wav2Vec-BERT</li>
              <li>Stable-Baselines3 (PPO)</li>
              <li>Gymnasium</li>
              <li>Next.js + Three.js</li>
            </ul>
          </div>
        </div>

        <div className="text-center text-xs text-gray-600">
          <p>
            This is a satirical hackathon project. Please doomscroll
            responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}
