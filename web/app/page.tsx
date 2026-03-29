import Hero from "./components/Hero";
import Problem from "./components/Problem";
import Architecture from "./components/Architecture";
import Demo from "./components/Demo";
import Results from "./components/Results";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <Architecture />
      <Demo />
      <Results />
      <Footer />
    </main>
  );
}
