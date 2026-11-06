// 再生モード（?demo / ?replay）で使う「決まった答え」。AI を呼ばずにこれを返す。
// 差し替えはこのファイルの REPLAY_ROUNDS だけ。
// 11/7 本物の AI の答えで再生したいとき:
//   1. NEXT_PUBLIC_USE_API=1 で台本1〜4を順に送る
//   2. ブラウザのコンソールに出る「[replay-record]」の JSON（window.__kotobaRecorded にもたまる）をコピー
//   3. 下の REPLAY_ROUNDS をその配列に置きかえる（input と response があれば動く）
import type { InterpretResponse } from "./interpret-types";
import { MOCK_ROUNDS } from "./mock-interpret";

export interface ReplayRound {
  input: string[];
  response: InterpretResponse;
  expect?: string;
}

export const REPLAY_ROUNDS: ReplayRound[] = MOCK_ROUNDS;

const key = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean).join("\n");

// 入力が台本のどれかと一字一句同じなら、その答えを返す。違えば null
export function findReplay(lines: string[], rounds: ReplayRound[] = REPLAY_ROUNDS): InterpretResponse | null {
  const k = key(lines);
  return rounds.find((r) => key(r.input) === k)?.response ?? null;
}

// 本物の AI の答えを、REPLAY_ROUNDS にそのまま貼れる形でコンソールに出す
export function recordForReplay(input: string[], response: InterpretResponse) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __kotobaRecorded?: ReplayRound[] };
  (w.__kotobaRecorded ??= []).push({ input, response });
  console.info("[replay-record]", JSON.stringify({ input, response }));
}
