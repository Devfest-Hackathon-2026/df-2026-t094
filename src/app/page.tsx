"use client";
// 0 ロボが起きる → 1 お題選択
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Stage from "@/components/Stage";
import Video from "@/components/Video";

const MIN_WAKE_MS = 1200;
// 起きる動画が読めなかったときなど、どんなときでもこれ以上は待たせない
const MAX_WAKE_MS = 15000;
// このタブで一度ロボが起きたかどうか
const AWAKE_KEY = "kotoba-robo-awake";

export default function Home() {
  const [awake, setAwake] = useState(false);
  // お題のカードを押したら、目標と遊びかたの説明を出す
  const [guide, setGuide] = useState(false);
  // サーバーが起きた（health が返った）か と、起きる動画を1回流し終えたか。両方そろったら次へ
  const [ready, setReady] = useState(false);
  const [watched, setWatched] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    // 一度起きたあと（ゲームから「お題に もどる」で来たとき）は、起きる場面をとばしてすぐお題の画面にする
    try { if (sessionStorage.getItem(AWAKE_KEY)) { setAwake(true); return; } } catch {}
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
  useEffect(() => { if (awake) try { sessionStorage.setItem(AWAKE_KEY, "1"); } catch {} }, [awake]);

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
          <p className="bubble px">ぼくは 言われたとおりにしか うごけない ロボだよ。なにを おしえてくれる？</p>
        </div>
        <div className="topics">
          <button type="button" onClick={() => setGuide(true)} className="topic px">
            <div className="thumb"><img src="/topics/onigiri.jpg" alt="のりを巻いた おにぎり" /></div>
            <b>おにぎりを 作る</b>
            <span>ラップ・ごはん・うめ・のり</span>
          </button>
          <div className="topic px soon" aria-disabled="true">
            <div className="thumb"><img src="/topics/randoseru.jpg" alt="ランドセルに ノートを 入れる" /></div>
            <b>ランドセルの じゅんび</b>
            <span>（つぎのお題・じゅんび中）</span>
          </div>
        </div>
      </div>
      {guide && (
        <div className="guide-bg" onClick={() => setGuide(false)}>
          <section className="guide px" role="dialog" aria-modal="true" aria-labelledby="guide-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="guide-t">おにぎりを 作る</h2>
            <p className="guide-goal"><b>もくひょう</b>ロボに おにぎりを 作ってもらおう！</p>
            <ol className="guide-steps">
              <li><i>1</i><b>かく</b><span>作りかたを<br />1行に 1つずつ 書く</span></li>
              <li><i>2</i><b>おくる</b><span>「ロボに おくる」を<br />おす</span></li>
              <li><i>3</i><b>なおす</b><span>しっぱいしたら<br />書きなおす</span></li>
            </ol>
            <div className="guide-items"><b>つかうもの</b>{["ごはん", "しゃもじ", "ラップ", "うめぼし", "のり"].map((x) => <span key={x} className="px">{x}</span>)}</div>
            <p className="guide-tip">ロボは 書いていないことは しないよ</p>
            <div className="guide-btns">
              <button type="button" className="btn sub px" onClick={() => setGuide(false)}>もどる</button>
              <Link href="/play/onigiri" className="btn main px">はじめる</Link>
            </div>
          </section>
        </div>
      )}
    </Stage>
  );
}
