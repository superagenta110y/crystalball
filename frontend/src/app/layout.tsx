import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrystalBall — Quant Trading Dashboard",
  description:
    "Free, open-source quantitative trading platform. Self-hosted. Bring your own data.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
