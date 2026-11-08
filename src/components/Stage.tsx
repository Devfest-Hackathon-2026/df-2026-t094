"use client";
// 1280×800 の画面を、窓の大きさに合わせて縮めて真ん中に置く（タブレット横・PC 向けの並びのまま）
import { useLayoutEffect, useRef } from "react";
import Bgm from "./Bgm";

export default function Stage({ className = "", bgm, children }: { className?: string; bgm?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const k = Math.min(innerWidth / 1280, innerHeight / 800);
      el.style.transform = `translate(${Math.max(0, (innerWidth - 1280 * k) / 2)}px, ${Math.max(0, (innerHeight - 800 * k) / 2)}px) scale(${k})`;
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return (
    <div className="stage-outer">
      <div ref={ref} className={`screen ${className}`}>{children}<Bgm src={bgm} /></div>
    </div>
  );
}
