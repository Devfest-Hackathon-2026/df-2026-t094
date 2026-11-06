// 画面から変換を呼ぶ入口。いまはモック（台本どおりの答え＋かんたんな言葉の当てはめ）を返す。
// ソウタさんの POST /api/interpret ができたら NEXT_PUBLIC_USE_API=1 で本物に切り替える（11/7 統合）。
// 再生モード（offline: true）のときは、NEXT_PUBLIC_USE_API=1 でも AI を呼ばない。
import type { Action, InterpretResponse, ObjectId, Step } from "./interpret-types";
import { findReplay, recordForReplay } from "./replay-script";

export const TIMEOUT_MS = 8000;

export class InterpretTimeout extends Error {}

export async function interpret(lines: string[], opts: { offline?: boolean } = {}): Promise<InterpretResponse> {
  const useApi = process.env.NEXT_PUBLIC_USE_API === "1" && !opts.offline;
  const work = useApi ? callApi(lines) : mock(lines);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new InterpretTimeout()), TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callApi(lines: string[]): Promise<InterpretResponse> {
  const r = await fetch("/api/interpret", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topicId: "onigiri", lines }),
  });
  if (!r.ok) throw new Error("interpret " + r.status);
  const res: InterpretResponse = await r.json();
  recordForReplay(lines, res);
  return res;
}

async function mock(lines: string[]): Promise<InterpretResponse> {
  await new Promise((r) => setTimeout(r, 600));
  const hit = findReplay(lines);
  if (hit) return hit;
  return { lines: lines.map((t, i) => ({ line: i + 1, steps: [guess(t)] })) };
}

// 台本にない文のための、ごく簡単な当てはめ（モック専用。本番は Gemini）
const VERBS: [string, Action, string][] = [
  ["広げ", "spread_out", "広げる"], ["ひろげ", "spread_out", "ひろげる"],
  ["のせ", "put", "のせる"], ["乗せ", "put", "のせる"], ["いれ", "put", "いれる"], ["入れ", "put", "いれる"], ["おく", "put", "おく"], ["置", "put", "おく"],
  ["にぎ", "nigiru", "にぎる"], ["握", "nigiru", "にぎる"],
  ["巻", "maku", "巻く"], ["まく", "maku", "まく"], ["まい", "maku", "まく"],
];
const NOUNS: [string, ObjectId][] = [["ごはん", "rice"], ["ご飯", "rice"], ["うめ", "ume"], ["梅", "ume"], ["のり", "nori"], ["ラップ", "wrap"], ["しゃもじ", "shamoji"]];

function guess(text: string): Step {
  const v = VERBS.find(([k]) => text.includes(k));
  const found = (re: string) => NOUNS.find(([k]) => text.includes(k + re))?.[1] ?? null;
  const tool = found("で");
  let onto: ObjectId | "table" | null = found("に") ?? found("の上に") ?? found("の真ん中に") ?? null;
  if (/テーブル|つくえ/.test(text)) onto = "table";
  const target = found("を");
  const verb = v?.[2] ?? (text.match(/([ぁ-んァ-ン一-龥]+?)(る|す|く|む|う|つ)$/)?.[0] ?? text);
  return { action: v?.[1] ?? "unknown", target, tool, onto, raw_verb: verb };
}
