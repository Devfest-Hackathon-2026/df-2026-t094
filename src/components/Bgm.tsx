"use client";
// BGM のオン・オフボタン。src（ふだんは public/bgm.mp3、ゲーム中は bgm-game.mp3）をくり返し小さめの音で流す。
// 最初はオン。ブラウザは画面を一度押すまで音を出せないので、すぐ流せないときは最初に押したときに流し始める。
// オフにしたら、次からもオフを覚えておく
import { useEffect, useRef, useState } from "react";
import { soundOn, SOUND_KEY } from "@/lib/sound";

const VOLUME = 0.35;

export default function Bgm({ src = "/bgm.mp3" }: { src?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(true);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const want = soundOn();
    setOn(want);
    const a = ref.current;
    if (!want || !a) return;
    a.volume = VOLUME;
    a.play().catch(() => {});
    // 自動で流せなかったときは、画面を最初に押したとき（キーを押したとき）に流す
    const start = () => { if (soundOn() && a.paused) a.play().catch(() => {}); };
    addEventListener("pointerdown", start, { once: true });
    addEventListener("keydown", start, { once: true });
    return () => { removeEventListener("pointerdown", start); removeEventListener("keydown", start); };
  }, []);

  // 曲が変わったら、オンのまま新しい曲を流す
  useEffect(() => {
    const a = ref.current;
    if (a && soundOn()) { a.volume = VOLUME; a.play().catch(() => {}); }
  }, [src]);

  function toggle(e: React.MouseEvent) {
    // このボタンを押したことが「最初に押した」扱いになって、すぐ流れ始めないようにする
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    const next = !(on && !a.paused);
    if (next) { a.volume = VOLUME; a.play().catch(() => {}); } else a.pause();
    setOn(next);
    try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch {}
  }

  if (!ok) return null;
  return (
    <>
      <audio ref={ref} src={src} loop preload="auto" onError={() => setOk(false)} />
      <button type="button" className="bgm px" onClick={toggle} onPointerDown={(e) => e.stopPropagation()} aria-pressed={on} aria-label="BGM">
        {on ? "♪ BGM オン" : "♪ BGM オフ"}
      </button>
    </>
  );
}
