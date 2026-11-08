"use client";
// 2〜4: チャット画面（左に動画、右にチャット）。送る → 動く → 止まって質問 → なおす → 成功と比較
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Stage from "@/components/Stage";
import { sfx } from "@/lib/sound";
import Video from "@/components/Video";
import { interpret, InterpretTimeout } from "@/lib/client-interpret";
import { describe, run, type Outcome, type Reading, type Topic, type Viewpoint } from "@/lib/engine";
import { label } from "@/lib/labels";
import { REPLAY_ROUNDS } from "@/lib/replay-script";
import { isNg, NG_MESSAGE, safeQuestion } from "@/lib/ng";
import topicJson from "@/lib/onigiri.json";

const topic = topicJson as unknown as Topic;
const MAX_LINES = 10;
const MAX_CHARS = 40;
// 送ってから結果の動画までの「よみよみ中…」（playing の動画）は、手順の行数や AI の速さによらず 5 秒にそろえる
const PLAYING_MS = 5000;
// AI が 5 秒より遅かったときでも、1行ずつ光らせる最短の間
const MIN_STEP_MS = 250;
// 結果の動画（失敗・成功・首をかしげる）が終わらないときも、これ以上は待たせない
const MAX_ANIM_MS = 15000;
const NOUN_CHIPS = ["ごはん", "うめ", "のり"];
const VIEWPOINTS: Viewpoint[] = ["順番", "道具", "どこに"];
const KNOWN_VERBS = "広げる・のせる・いれる・にぎる・巻く";
const STORE_KEY = "kotoba-robo:onigiri:last";

type Phase = "reading" | "running" | "fail" | "success" | "timeout" | "error";
// shown: 結果の動画を流し終えて、チャットに返事を出したか
type Turn = { lines: string[]; phase: Phase; outcome?: Outcome; runIdx: number; shown?: boolean };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Play() {
  const params = useSearchParams();
  // 再生モード: ?demo（台本ボタンで手で進める）と ?replay（4回分を自動で流す）。どちらも AI を呼ばない
  const replay = params.has("replay");
  const demo = params.has("demo") || replay;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [showVerbs, setShowVerbs] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // 何回目か・最初の手順・聞かれた観点。再生モードのループからも正しく読めるように ref で持つ
  const countRef = useRef(0);
  const firstRef = useRef<string[]>([]);
  const askedRef = useRef<Viewpoint[]>([]);
  // 結果の動画が終わったら呼ぶ（send が待っている）
  const animDoneRef = useRef<(() => void) | null>(null);

  const last = turns[turns.length - 1];
  const busy = !!last && !last.shown;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const tooMany = lines.length > MAX_LINES;
  const tooLong = lines.some((l) => [...l].length > MAX_CHARS);
  const asked = turns.flatMap((t) => (t.outcome?.kind === "fail" && t.outcome.viewpoint ? [t.outcome.viewpoint] : []));

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, showVerbs]);

  function update(i: number, patch: Partial<Turn>) {
    setTurns((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  // 結果の動画を流し終えるまで待ってから、チャットに返事を出す
  async function showAfterAnim(i: number) {
    await new Promise<void>((done) => {
      const t = setTimeout(done, MAX_ANIM_MS);
      animDoneRef.current = () => { clearTimeout(t); done(); };
    });
    animDoneRef.current = null;
    update(i, { shown: true });
  }

  async function send(input: string[] = lines): Promise<Outcome | null> {
    if (busy || !input.length || input.length > MAX_LINES || input.some((l) => [...l].length > MAX_CHARS)) return null;
    const lines = input;
    const i = countRef.current++;
    if (i === 0) firstRef.current = lines;
    setTurns((ts) => [...ts, { lines, phase: "reading", runIdx: -1 }]);
    setText("");
    setShowVerbs(false);
    const startedAt = Date.now();
    let outcome: Outcome;
    try {
      outcome = run(topic, await interpret(lines, { offline: demo }), label);
    } catch (e) {
      update(i, { phase: e instanceof InterpretTimeout ? "timeout" : "error" });
      await showAfterAnim(i);
      setText(lines.join("\n"));
      return null;
    }
    update(i, { phase: "running", outcome });
    const stop = outcome.kind === "fail" ? outcome.line - 1 : lines.length - 1;
    // 残りの時間を、進める行の数で分ける
    const step = Math.max(MIN_STEP_MS, (PLAYING_MS - (Date.now() - startedAt)) / (stop + 1));
    for (let k = 0; k <= stop; k++) {
      update(i, { runIdx: k });
      await wait(step);
    }
    update(i, { phase: outcome.kind === "fail" ? "fail" : "success" });
    await showAfterAnim(i);
    // 結果の動画を見終えて、ふきだしが出るときに効果音
    sfx(outcome.kind === "fail" ? "fail" : "success");
    if (outcome.kind === "fail" && outcome.viewpoint) askedRef.current = [...askedRef.current, outcome.viewpoint];
    if (outcome.kind === "success") {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ first: firstRef.current, last: lines, asked: askedRef.current, at: Date.now() }));
      } catch {}
      await wait(1500);
      setShowResult(true);
    }
    return outcome;
  }

  // 再生モード（?replay）: AI の調子が悪い本番でも、台本4回分を最初から最後まで自動で流す
  useEffect(() => {
    if (!replay) return;
    let stopped = false;
    (async () => {
      await wait(1500);
      for (const round of REPLAY_ROUNDS) {
        if (stopped) return;
        setText(round.input.join("\n"));
        await wait(2000);
        if (stopped) return;
        const o = await send(round.input);
        if (!o || o.kind === "success") return;
        await wait(3500);
      }
    })();
    return () => { stopped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  function fix() {
    if (!last) return;
    setText(last.lines.join("\n"));
    ta.current?.focus();
  }

  function insertChip(word: string) {
    const el = ta.current;
    if (!el) return setText((t) => t + word);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = text.slice(0, a) + word + text.slice(b);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + word.length, a + word.length);
    });
  }

  function restart() {
    countRef.current = 0;
    firstRef.current = [];
    askedRef.current = [];
    setTurns([]);
    setText("");
    setShowResult(false);
  }

  // 左側（動画・字幕・手順のバー）
  let animId = "idle";
  let animNote = "待っているロボ";
  let subtitle = "";
  let subNg = false;
  if (last) {
    // 読んでいる間と、手順を1行ずつ進める間は、どちらも playing の動画に「よみよみ中…」のふきだしを重ねる
    if (last.phase === "reading" || last.phase === "running") { animId = "playing"; animNote = "よみよみ中"; subtitle = "よみよみ中…"; }
    if (last.phase === "fail" && last.outcome?.kind === "fail") {
      animId = last.outcome.anim; animNote = "";
      if (last.shown) { subtitle = shownQuestion(last.outcome); subNg = true; }
    }
    if (last.phase === "success") { animId = "success"; animNote = "おにぎり完成"; if (last.shown) subtitle = "できた！ ★"; }
    if (last.phase === "timeout" || last.phase === "error") { animId = "tilt_head"; animNote = "首をかしげる"; if (last.shown) subtitle = "あれ？ もう一回 おくって"; }
  }

  return (
    <Stage bgm="/bgm-game.mp3">
      <section className="anim" aria-label="ロボの動き">
        {/* 回ごとに作り直す（同じ失敗が2回続いても、動画を最初から流す） */}
        <Video key={`${turns.length}-${animId}`} id={animId} note={animNote}
          onEnded={last && !last.shown && last.phase !== "reading" && last.phase !== "running" ? () => animDoneRef.current?.() : undefined}>
          {/* 動画を流し終えたら、ロボの質問を動画の上にふきだしで出す */}
          {subtitle && <p className={`say${subNg ? " ng" : ""}`} aria-live="polite">{subtitle}</p>}
        </Video>
        <ol className="strip">
          {(last?.lines ?? []).map((l, k) => (
            <li key={k} className={`px ${stepClass(last, k)}`}>{k + 1} {l}</li>
          ))}
        </ol>
      </section>

      <section className="chat" aria-label="ロボと はなす">
        <header className="chat-hd">
          <b>ロボと はなす</b>
          <span>{demo && <i className="mode">再生</i>}{turns.length ? `${turns.length}回目` : ""}</span>
        </header>
        <div className="log" ref={logRef}>
          <RoboSay>おにぎりの 作りかたを おしえて。1行に 1つずつ 書いてね</RoboSay>
          {turns.map((t, i) => (
            <TurnView key={i} t={t} isLast={i === turns.length - 1} onFix={fix}
              showVerbs={showVerbs} onVerbs={() => setShowVerbs((v) => !v)} />
          ))}
        </div>

        <div className="input">
          <div className="chips">
            {NOUN_CHIPS.map((w) => (
              <button key={w} type="button" className="px" onClick={() => insertChip(w)}>{w}</button>
            ))}
            {demo && REPLAY_ROUNDS.map((r, k) => (
              <button key={k} type="button" className="demo" onClick={() => setText(r.input.join("\n"))}>台本{k + 1}</button>
            ))}
          </div>
          <textarea
            id="steps-input"
            ref={ta}
            className="px"
            value={text}
            placeholder="1行に 1つずつ 書いてね（10行まで）"
            aria-label="てじゅん"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return; // 変換中の Enter では送らない
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
            }}
          />
          <div className="send">
            <span className={`count${tooMany || tooLong ? " over" : ""}`}>
              {tooLong ? `1行は ${MAX_CHARS}字まで` : `${lines.length} / ${MAX_LINES}行`}
            </span>
            <button type="button" className="btn main px" disabled={busy || !lines.length || tooMany || tooLong} onClick={() => send()}>
              ロボにおくる
            </button>
          </div>
        </div>
      </section>
      {/* クリアしたら、画面の真ん中に結果と「お題に もどる」「もう一回」を出す */}
      {showResult && turns.length > 0 && (
        <Result first={turns[0].lines} last={turns[turns.length - 1].lines} asked={asked} onAgain={restart} />
      )}
    </Stage>
  );
}

function stepClass(t: Turn | undefined, k: number) {
  if (!t) return "";
  if (t.phase === "fail" && t.outcome?.kind === "fail" && k === t.outcome.line - 1) return "ng";
  if (t.phase === "running" && k === t.runIdx) return "on";
  if (k < t.runIdx || t.phase === "success") return "done";
  return "";
}

function shownQuestion(o: Extract<Outcome, { kind: "fail" }>) {
  const r = o.readings.find((x) => x.line === o.line);
  return safeQuestion(o.question, r?.step.raw_verb ?? "");
}

function RoboSay({ children }: { children: React.ReactNode }) {
  return (
    <div className="msg robo">
      <div className="avatar" aria-hidden="true" />
      <div className="bubble px">{children}</div>
    </div>
  );
}

function TurnView({ t, isLast, onFix, showVerbs, onVerbs }: {
  t: Turn; isLast: boolean; onFix: () => void; showVerbs: boolean; onVerbs: () => void;
}) {
  const o = t.outcome;
  const failLine = o?.kind === "fail" && t.phase === "fail" && t.shown ? o.line : -1;
  const readingOf = (n: number): Reading | undefined => o?.readings.find((r) => r.line === n);
  const done = !!t.shown && (t.phase === "fail" || t.phase === "success");
  return (
    <>
      <div className="msg kid">
        <ol className="steps px">
          {t.lines.map((l, k) => {
            const r = readingOf(k + 1);
            const cls = k + 1 === failLine ? "fail" : t.phase === "running" && k === t.runIdx ? "run" : "";
            return (
              <li key={k} className={cls}>
                {l}
                {done && r && <span className="got">{isNg(r.step.raw_verb) ? NG_MESSAGE : `受け取ったよ: ${describe(r, label)}`}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      {t.phase === "reading" && <RoboSay>よみよみ中…</RoboSay>}
      {t.shown && (t.phase === "timeout" || t.phase === "error") && (
        <RoboSay>
          <p className="ask">ロボが 考えすぎちゃった。もう一回 おくってみて</p>
        </RoboSay>
      )}
      {t.shown && t.phase === "fail" && o?.kind === "fail" && (
        <RoboSay>
          <p className="ask">{shownQuestion(o)}</p>
          {o.viewpoint && (
            <p className="views">
              {VIEWPOINTS.map((v) => <span key={v} className={v === o.viewpoint ? "hit" : ""}>{v}</span>)}
            </p>
          )}
          {o.reason === "unknown" && isLast && (
            <>
              <button type="button" className="btn link" onClick={onVerbs}>ロボが できること を見る</button>
              {showVerbs && <p className="verbs">ロボが わかる うごき: {KNOWN_VERBS}</p>}
            </>
          )}
          {isLast && <button type="button" className="btn sub px" onClick={onFix}>さっきの手順を なおす</button>}
        </RoboSay>
      )}
      {t.shown && t.phase === "success" && <RoboSay><p className="ask">できた！ ありがとう</p></RoboSay>}
    </>
  );
}

function Result({ first, last, asked, onAgain }: { first: string[]; last: string[]; asked: Viewpoint[]; onAgain: () => void }) {
  return (
    <div className="guide-bg">
    <div className="result px" role="dialog" aria-modal="true" aria-label="できた">
      <h2>できた！ ★</h2>
      <p className="result-n">てじゅんが {first.length}行 → {last.length}行 に なったよ</p>
      <div className="cmp">
        <div className="col px">
          <h3>さいしょの てじゅん</h3>
          <ol className="steps">{first.map((l, k) => <li key={k}>{l}</li>)}</ol>
        </div>
        <div className="col px">
          <h3>さいごの てじゅん</h3>
          <ol className="steps">
            {last.map((l, k) => <li key={k} className={first[k] === l ? "" : "chg"}>{l}</li>)}
          </ol>
        </div>
      </div>
      {asked.length > 0 && <p className="asked px">ロボに 聞かれたこと：{asked.join(" → ")}</p>}
      <div className="guide-btns">
        <Link href="/" className="btn sub px">お題に もどる</Link>
        <button type="button" className="btn main px" onClick={onAgain}>もう一回</button>
      </div>
    </div>
    </div>
  );
}
