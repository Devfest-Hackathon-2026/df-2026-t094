"use client";
// 左の動画枠。public/anim/{id}.mp4 があれば再生し、無ければ止まった絵（public/anim/still.jpg）を出す
import { useState, type ReactNode } from "react";

// 終わるまで待つ場面がない動画は、くり返し流す（ロードの間の wake_up など）
const LOOP = new Set(["wake_up", "idle", "playing"]);

type Props = {
  id: string; note?: string; wide?: boolean;
  // 1回流し終えたとき（true を返すと、もう1回流す）。動画が無いときも onEnded を呼ぶ
  onEnded?: () => boolean | void;
  // 動画の上に重ねるもの（ロボのふきだしなど）
  children?: ReactNode;
};

export default function Video({ id, note, wide = false, onEnded, children }: Props) {
  const [missing, setMissing] = useState<string | null>(null);
  return (
    <div className={`video px${wide ? " wide" : ""}`}>
      {missing !== id && (
        <video key={id} src={`/anim/${id}.mp4`} poster="/anim/still.jpg" autoPlay muted playsInline loop={!onEnded && LOOP.has(id)}
          onEnded={(e) => { if (onEnded?.()) e.currentTarget.play().catch(() => {}); }}
          onError={() => { setMissing(id); onEnded?.(); }} />
      )}
      {missing === id && <img className="still" src="/anim/still.jpg" alt={note ?? ""} />}
      {children}
    </div>
  );
}
