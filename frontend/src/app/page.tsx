"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { SplashScreen } from "@/components/layout/SplashScreen";

// Dynamically import to avoid SSR issues with react-grid-layout
const Dashboard = dynamic(() => import("@/components/layout/Dashboard"), {
  ssr: false,
  loading: () => <div className="h-screen bg-black" />,
});

export default function Home() {
  return (
    <>
      <SplashScreen />
      <Suspense fallback={<div className="h-screen bg-black" />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
