"use client";
// 左の動画枠。public/anim/{id}.mp4 があれば再生し、無ければ枠と ID だけ出す（Veo の動画が入るまでの仮）
import { useState } from "react";

export default function Video({ id, note, wide = false }: { id: string; note?: string; wide?: boolean }) {
  const [missing, setMissing] = useState<string | null>(null);
  return (
    <div className={`video px${wide ? " wide" : ""}`}>
      {missing !== id && (
        <video key={id} src={`/anim/${id}.mp4`} autoPlay muted playsInline onError={() => setMissing(id)} />
      )}
      {missing === id && <span className="vlabel">Veo の動画 {id}{note ? `（${note}）` : ""}</span>}
    </div>
  );
}
