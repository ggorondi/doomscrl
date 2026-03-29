import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "brainrotmaxxer",
  description:
    "RL-optimized doomscrolling powered by TRIBE v2 brain simulation. Silly Hacks 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
