"use client";
// 2〜4: チャット画面（左に動画、右にチャット）。送る → 動く → 止まって質問 → なおす → 成功と比較
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Stage from "@/components/Stage";
import Video from "@/components/Video";
import { interpret, InterpretTimeout } from "@/lib/client-interpret";
import { describe, run, type Outcome, type Reading, type Topic, type Viewpoint } from "@/lib/engine";
import { label } from "@/lib/labels";
import { MOCK_ROUNDS } from "@/lib/mock-interpret";
import { safeQuestion } from "@/lib/ng";
import topicJson from "@/lib/onigiri.json";

const topic = topicJson as unknown as Topic;
const MAX_LINES = 10;
const MAX_CHARS = 40;
const STEP_MS = 900;
const NOUN_CHIPS = ["ごはん", "うめ", "のり"];
const VIEWPOINTS: Viewpoint[] = ["順番", "道具", "どこに"];
const KNOWN_VERBS = "広げる・のせる・いれる・にぎる・巻く";
const STORE_KEY = "kotoba-robo:onigiri:last";

type Phase = "reading" | "running" | "fail" | "success" | "timeout" | "error";
type Turn = { lines: string[]; phase: Phase; outcome?: Outcome; runIdx: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Play() {
  const demo = useSearchParams().has("demo");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [showVerbs, setShowVerbs] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const last = turns[turns.length - 1];
  const busy = last?.phase === "reading" || last?.phase === "running";
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

  async function send() {
    if (busy || !lines.length || tooMany || tooLong) return;
    const i = turns.length;
    setTurns((ts) => [...ts, { lines, phase: "reading", runIdx: -1 }]);
    setText("");
    setShowVerbs(false);
    let outcome: Outcome;
    try {
      outcome = run(topic, await interpret(lines), label);
    } catch (e) {
      update(i, { phase: e instanceof InterpretTimeout ? "timeout" : "error" });
      setText(lines.join("\n"));
      return;
    }
    update(i, { phase: "running", outcome });
    const stop = outcome.kind === "fail" ? outcome.line - 1 : lines.length - 1;
    for (let k = 0; k <= stop; k++) {
      update(i, { runIdx: k });
      await wait(STEP_MS);
    }
    update(i, { phase: outcome.kind === "fail" ? "fail" : "success" });
    if (outcome.kind === "success") {
      const first = turns[0]?.lines ?? lines;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ first, last: lines, asked, at: Date.now() }));
      } catch {}
      await wait(1500);
      setShowResult(true);
    }
  }

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
    if (last.phase === "reading") { subtitle = "よみよみ中…"; animNote = "よみよみ中"; }
    if (last.phase === "running") { animId = "playing"; animNote = "再生中"; }
    if (last.phase === "fail" && last.outcome?.kind === "fail") {
      animId = last.outcome.anim; animNote = "";
      subtitle = shownQuestion(last.outcome); subNg = true;
    }
    if (last.phase === "success") { animId = "success"; animNote = "おにぎり完成"; subtitle = "できた！ ★"; }
    if (last.phase === "timeout" || last.phase === "error") { animId = "tilt_head"; animNote = "首をかしげる"; }
  }

  return (
    <Stage>
      <section className="anim" aria-label="ロボの動き">
        <Video id={animId} note={animNote} />
        <p className={`subtitle px${subNg ? " ng" : ""}`} aria-live="polite">{subtitle}</p>
        <ol className="strip">
          {(last?.lines ?? []).map((l, k) => (
            <li key={k} className={`px ${stepClass(last, k)}`}>{k + 1} {l}</li>
          ))}
        </ol>
      </section>

      <section className="chat" aria-label="ロボと はなす">
        <header className="chat-hd">
          <b>ロボと はなす</b>
          <span>{turns.length ? `${turns.length}回目` : ""}</span>
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
            {demo && MOCK_ROUNDS.map((r, k) => (
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
            <button type="button" className="btn main px" disabled={busy || !lines.length || tooMany || tooLong} onClick={send}>
              ロボにおくる
            </button>
          </div>
        </div>

        {showResult && turns.length > 0 && (
          <Result first={turns[0].lines} last={turns[turns.length - 1].lines} asked={asked} onAgain={restart} />
        )}
      </section>
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
  const failLine = o?.kind === "fail" && t.phase === "fail" ? o.line : -1;
  const readingOf = (n: number): Reading | undefined => o?.readings.find((r) => r.line === n);
  const done = t.phase === "fail" || t.phase === "success";
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
                {done && r && <span className="got">受け取ったよ: {describe(r, label)}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      {t.phase === "reading" && <RoboSay>よみよみ中…</RoboSay>}
      {(t.phase === "timeout" || t.phase === "error") && (
        <RoboSay>
          <p className="ask">ロボが 考えすぎちゃった。もう一回 おくってみて</p>
        </RoboSay>
      )}
      {t.phase === "fail" && o?.kind === "fail" && (
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
      {t.phase === "success" && <RoboSay><p className="ask">できた！ ありがとう</p></RoboSay>}
    </>
  );
}

function Result({ first, last, asked, onAgain }: { first: string[]; last: string[]; asked: Viewpoint[]; onAgain: () => void }) {
  return (
    <div className="result" role="dialog" aria-label="できた">
      <header className="chat-hd"><b>できた！</b><span>{first.length}行 → {last.length}行</span></header>
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
      <div className="send">
        <Link href="/" className="btn sub px">お題に もどる</Link>
        <button type="button" className="btn main px" onClick={onAgain}>もう一回</button>
      </div>
    </div>
  );
}
