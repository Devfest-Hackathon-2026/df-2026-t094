"use client";
// 0 ロボが起きる → 1 お題選択
import Link from "next/link";
import { useEffect, useState } from "react";
import Stage from "@/components/Stage";
import Video from "@/components/Video";

const MIN_WAKE_MS = 1200;

export default function Home() {
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    let done = false;
    const started = Date.now();
    fetch("/api/health", { cache: "no-store" })
      .catch(() => null)
      .finally(() => {
        const wait = Math.max(0, MIN_WAKE_MS - (Date.now() - started));
        setTimeout(() => { if (!done) setAwake(true); }, wait);
      });
    return () => { done = true; };
  }, []);

  if (!awake) {
    return (
      <Stage className="solo">
        <div className="solo-in center">
          <Video id="wake_up" note="ロボが目をさます" wide />
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
            <div className="thumb"><span className="vlabel">お題の絵</span></div>
            <b>おにぎりを 作る</b>
            <span>ラップ・ごはん・うめ・のり</span>
          </Link>
          <div className="topic px soon" aria-disabled="true">
            <div className="thumb"><span className="vlabel">お題の絵</span></div>
            <b>ランドセルの じゅんび</b>
            <span>（つぎのお題・じゅんび中）</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}
