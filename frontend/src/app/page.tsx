"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import to avoid SSR issues with react-grid-layout
const Dashboard = dynamic(() => import("@/components/layout/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-accent text-xl font-mono animate-pulse">
        🔮 CrystalBall Loading...
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
