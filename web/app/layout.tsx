import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "doomscRL",
  description:
    "RL-optimized doomscrolling powered by TRIBE v2 brain simulation. Silly Hacks 2026.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/brain_favicon.png",
    shortcut: "/brain_favicon.png",
    apple: "/brain_favicon.png",
  },
  openGraph: {
    title: "doomscRL",
    description:
      "RL-optimized doomscrolling powered by TRIBE v2 brain simulation. Silly Hacks 2026.",
  },
  twitter: {
    card: "summary_large_image",
    title: "doomscRL",
    description:
      "RL-optimized doomscrolling powered by TRIBE v2 brain simulation. Silly Hacks 2026.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
