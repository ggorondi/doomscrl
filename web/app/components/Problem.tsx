import Image from "next/image";

export default function Problem() {
  return (
    <section style={{ padding: "3rem 0" }}>
      <div className="container-middle">
        <p className="separator">✺✺✺</p>

        <h2 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
          The premise
        </h2>

        {/* Monkey stimulus diagram */}
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "28rem", margin: "0 auto" }}>
            <Image
              src="/monkey-stim.png"
              alt="Classic neuroscience experiment setup: monkey with recording electrode watching a stimulus screen, with juice reward mechanism — except we're doing this to ourselves, voluntarily, for free"
              width={600}
              height={500}
              className="image"
            />
          </div>
        </div>

        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
          Social media companies spend billions engineering recommendation
          algorithms that optimize for <em>doomscroll-time</em>.
        </p>
        <p style={{ color: "var(--muted)" }}>
          But...
        </p>
        <div style={{ height: "2rem" }} />
        <p style={{ color: "var(--muted)" }}>
          What if we want to optimize for <em>doomscroll-intensity</em> instead?
        </p>
        <div style={{ height: "2rem" }} />
        <p style={{ color: "var(--muted)" }}>
          We can leverage <strong>Reinforcement Learning</strong> to train an agent to optimize the scrolling pattern with the explicit objective of maximizing <strong>predicted cortical activation</strong> across brain surface vertices during a tiktok session.
        </p>
        <div style={{ height: "2rem" }} />

        <p style={{ color: "var(--muted)" }}>
          Bye bye manual scrolling.
        </p>
        {/* No thanks i use ai photo */}
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "28rem", margin: "0 auto" }}>
            <Image
              src="/nothanks.png"
              alt="No thanks i use ai"
              width={600}
              height={500}
              className="image"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
