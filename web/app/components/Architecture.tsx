const steps = [
  {
    num: "01",
    title: "TikTok video feed",
    desc: "878 real TikTok videos across three tiers: viral hits, high-engagement, and random. The raw material for brain destruction.",
  },
  {
    num: "02",
    title: "Backbone feature extraction",
    desc: "V-JEPA 2 (video) and Wav2Vec-BERT 2.0 (audio) extract rich multimodal representations at 2 Hz. Precomputed on GPU.",
  },
  {
    num: "03",
    title: "TRIBE v2 brain model",
    desc: "An 8-layer transformer predicts fMRI activation across ~20k cortical vertices. It maintains temporal context, so it 'remembers' previous videos.",
  },
  {
    num: "04",
    title: "Dopamine proxy reward",
    desc: "Mean absolute brain activation + rate of change = your 'dopamine score'. The RL agent maximizes this relentlessly.",
  },
  {
    num: "05",
    title: "PPO-Clip RL agent",
    desc: "Two policies: one learns optimal scroll timing, the other also learns what type of video to serve next. Pure brain rot optimization.",
  },
];

export default function Architecture() {
  return (
    <section className="py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
          How it works
        </h2>
        <p className="text-[var(--muted)] text-sm md:text-base mb-12">
          Five stages from raw video to maximum brain activation.
        </p>

        <div className="space-y-10">
          {steps.map((step) => (
            <div key={step.num} className="flex gap-6">
              <span className="shrink-0 w-8 text-xs mono text-[var(--muted)] tabular-nums pt-0.5">
                {step.num}
              </span>
              <div>
                <h3 className="text-base font-semibold mb-1.5">{step.title}</h3>
                <p className="text-[var(--muted)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
