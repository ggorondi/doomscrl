export default function Problem() {
  return (
    <section className="relative py-20 md:py-24 px-6 md:px-10 bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">
          The premise
        </h2>

        <p className="text-base md:text-lg text-[var(--muted)] leading-relaxed mb-10">
          Social media companies spend billions engineering recommendation
          algorithms that keep you scrolling. They optimize for{" "}
          <span className="text-[var(--fg)] font-medium">engagement</span>,{" "}
          <span className="text-[var(--fg)] font-medium">retention</span>, and{" "}
          <span className="text-[var(--fg)] font-medium">watch time</span>{" "}
          &mdash; dancing around the uncomfortable truth that they&rsquo;re
          essentially optimizing for how effectively they can hijack your
          dopamine system.
        </p>

        <div className="card p-6 mb-10">
          <p className="text-lg md:text-xl font-medium mb-3">
            We asked:{" "}
            <span className="accent-text">
              what if we just did that explicitly?
            </span>
          </p>
          <p className="text-[var(--muted)] text-sm md:text-base leading-relaxed">
            Using Meta&rsquo;s own TRIBE v2 brain model to predict neural
            activation, we train RL agents whose sole objective is to maximize
            the rate at which your brain &ldquo;fries&rdquo; &mdash; maximizing
            predicted cortical activation across 20,484 brain surface vertices
            while doomscrolling through TikTok.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              label: "Their approach",
              desc: "Optimize engagement metrics as a proxy for dopamine hijacking. Don't talk about it.",
              color: "text-[var(--muted)]",
            },
            {
              label: "Our approach",
              desc: "Directly optimize predicted brain activation using a state-of-the-art neural encoding model.",
              color: "text-[var(--danger)]",
            },
            {
              label: "The joke",
              desc: "Cutting-edge AI and neuroscience applied to the dumbest possible use case: frying your brain on purpose.",
              color: "text-[var(--secondary)]",
            },
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <p className={`font-semibold mb-2 ${item.color}`}>
                {item.label}
              </p>
              <p className="text-sm text-[var(--muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
