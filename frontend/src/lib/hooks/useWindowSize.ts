"use client";
import { useState, useEffect } from "react";

export default function useWindowSize() {
  const [size, setSize] = useState({ width: 1440, height: 900 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}
