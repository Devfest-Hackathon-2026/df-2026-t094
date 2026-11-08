"use client";
// 0 ロボが起きる → 1 お題選択
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Stage from "@/components/Stage";
import Video from "@/components/Video";

const MIN_WAKE_MS = 1200;
// 起きる動画が読めなかったときなど、どんなときでもこれ以上は待たせない
const MAX_WAKE_MS = 15000;

export default function Home() {
  const [awake, setAwake] = useState(false);
  // サーバーが起きた（health が返った）か と、起きる動画を1回流し終えたか。両方そろったら次へ
  const [ready, setReady] = useState(false);
  const [watched, setWatched] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let done = false;
    const started = Date.now();
    fetch("/api/health", { cache: "no-store" })
      .catch(() => null)
      .finally(() => {
        const wait = Math.max(0, MIN_WAKE_MS - (Date.now() - started));
        setTimeout(() => { if (!done) { readyRef.current = true; setReady(true); } }, wait);
      });
    const cap = setTimeout(() => { if (!done) setAwake(true); }, MAX_WAKE_MS);
    return () => { done = true; clearTimeout(cap); };
  }, []);

  useEffect(() => { if (ready && watched) setAwake(true); }, [ready, watched]);

  // 動画が終わったとき: サーバーがまだなら、もう1回流して待つ
  const onWakeEnded = () => { setWatched(true); return !readyRef.current; };

  if (!awake) {
    return (
      <Stage className="solo">
        <div className="solo-in center">
          <Video id="wake_up" note="ロボが目をさます" wide onEnded={onWakeEnded} />
          <p className="solo-t" role="status">ロボが おきるのを まっているよ…</p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage className="solo">
      <div className="solo-in">
        <h1 className="title">ことばロボ</h1>
        <div className="intro msg robo">
          <div className="avatar" />
          <p className="bubble px">ぼく、言われたとおりにしか うごけないよ。作りかたを 言葉で おしえてね</p>
        </div>
        <div className="topics">
          <Link href="/play/onigiri" className="topic px">
            <div className="thumb"><img src="/topics/onigiri.jpg" alt="のりを巻いた おにぎり" /></div>
            <b>おにぎりを 作る</b>
            <span>ラップ・ごはん・うめ・のり</span>
          </Link>
          <div className="topic px soon" aria-disabled="true">
            <div className="thumb"><img src="/topics/randoseru.jpg" alt="ランドセルに ノートを 入れる" /></div>
            <b>ランドセルの じゅんび</b>
            <span>（つぎのお題・じゅんび中）</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}
