"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  // Phase: "in" → "visible" → "out" → "gone"
  const [phase, setPhase] = useState<"in" | "visible" | "out" | "gone">("in");

  useEffect(() => {
    // Fade in complete → mark visible
    const t1 = setTimeout(() => setPhase("visible"), 50);
    // After a brief moment, start fade-out
    const t2 = setTimeout(() => setPhase("out"), 900);
    // Remove from DOM after fade-out completes
    const t3 = setTimeout(() => setPhase("gone"), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      style={{
        opacity:    phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)" : "opacity 200ms ease",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      <div
        className="flex flex-col items-center gap-5 select-none"
        style={{
          opacity:   phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="CrystalBall"
          className="w-16 h-16"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-white text-lg font-semibold tracking-widest uppercase">
            CrystalBall
          </span>
          <span className="text-neutral-600 text-xs tracking-widest uppercase">
            Quantitative Trading
          </span>
        </div>

        {/* Subtle loading bar */}
        <div className="w-24 h-px bg-neutral-800 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-white rounded-full"
            style={{
              animation: "splashBar 0.8s ease forwards",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashBar {
          from { width: 0%; opacity: 0; }
          20%  { opacity: 1; }
          to   { width: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
