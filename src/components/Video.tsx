"use client";
// 左の動画枠。public/anim/{id}.mp4 があれば再生し、無ければ止まった絵（public/anim/still.jpg）を出す
import { useState } from "react";

// 終わるまで待つ場面がない動画は、くり返し流す（ロードの間の wake_up など）
const LOOP = new Set(["wake_up"]);

export default function Video({ id, note, wide = false }: { id: string; note?: string; wide?: boolean }) {
  const [missing, setMissing] = useState<string | null>(null);
  return (
    <div className={`video px${wide ? " wide" : ""}`}>
      {missing !== id && (
        <video key={id} src={`/anim/${id}.mp4`} poster="/anim/still.jpg" autoPlay muted playsInline loop={LOOP.has(id)}
          onError={() => setMissing(id)} />
      )}
      {missing === id && <img className="still" src="/anim/still.jpg" alt={note ?? ""} />}
    </div>
  );
}
