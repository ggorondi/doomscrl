export default function Conclusion() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">
          So, what did we learn?
        </h2>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3 accent-text">
              The absurdity
            </h3>
            <p className="text-[var(--muted)] text-sm md:text-base leading-relaxed">
              We used a state-of-the-art brain encoding foundation model
              developed by Meta&rsquo;s FAIR lab, trained on fMRI data from 25
              human subjects watching thousands of hours of video, combined with
              V-JEPA 2 and Wav2Vec-BERT 2.0 backbone features, all fed into a
              PPO-Clip reinforcement learning agent trained across five
              different variants with configurable reward signals and
              observation spaces&hellip; to learn how to scroll TikTok in the
              most brain-damaging way possible.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3 text-[var(--secondary)]">
              The uncomfortable part
            </h3>
            <p className="text-[var(--muted)] text-sm md:text-base leading-relaxed">
              The only difference between what we did and what social media
              companies do is that we&rsquo;re honest about the objective
              function. They optimize for &ldquo;engagement&rdquo; and
              &ldquo;retention&rdquo; &mdash; we optimize for predicted
              cortical activation. Same outcome, same dopamine hijacking, same
              brain frying. We just put it in the loss function explicitly
              instead of pretending it&rsquo;s a side effect.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3 text-[var(--fg)]">
              The reality
            </h3>
            <p className="text-[var(--muted)] text-sm md:text-base leading-relaxed mb-4">
              This is, of course, a silly hackathon project. The brain model is
              a rough approximation, the reward signal is a proxy, and the
              agent is optimizing in a toy environment. But the underlying
              dynamics &mdash; ML systems learning to exploit human
              neurology for engagement &mdash; are very real and happening at
              scale right now, just with better data and bigger budgets.
            </p>
            <p className="text-sm text-[var(--fg)] font-medium">
              Please doomscroll responsibly. 🧠
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 justify-center">
          <a
            href="https://github.com/ggorondi/brainrotmaxxer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
          >
            View on GitHub
          </a>
          <a
            href="https://sillyhacks.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-5 py-2.5 border border-[var(--border-strong)] text-[var(--fg)] text-sm font-medium rounded-md hover:border-[var(--fg)] transition-colors"
          >
            Silly Hacks 2026
          </a>
        </div>
      </div>
    </section>
  );
}
