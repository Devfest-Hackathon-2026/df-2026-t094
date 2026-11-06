// POST /api/interpret の守りの部分（Gemini を呼ぶところは route.ts）。
// 入力の制限・呼び出し回数の上限・打ち切り・同じ文の使い回しをここでやる。
import type { InterpretResponse, Step } from "./interpret-types";

export const MAX_LINES = 10;
export const MAX_CHARS = 40;
// 画面側の打ち切り（client-interpret.ts の 8秒）より少し早く切って、504 で返す
export const SERVER_TIMEOUT_MS = 7500;
// 1つの IP から1分に送れる回数
export const PER_IP_PER_MIN = 20;
// 1日に Gemini を呼ぶ回数。Cloud Run は最大1台にしてあるので、これがそのまま全体の上限になる
// （1回 約0.5円の見積もりで、1日 最大 約1ドル）
export const GEMINI_PER_DAY = 300;
const CACHE_MAX = 2000;

export class BadRequest extends Error {}
export class TooMany extends Error {}
export class GeminiTimeout extends Error {}

/** 送られてきた本文を確かめて、行の配列にする。だめなら BadRequest */
export function parseBody(body: unknown): string[] {
  const b = body as { topicId?: unknown; lines?: unknown } | null;
  if (!b || b.topicId !== "onigiri") throw new BadRequest("topicId");
  if (!Array.isArray(b.lines)) throw new BadRequest("lines");
  const lines = b.lines.map((l) => (typeof l === "string" ? l.trim() : null));
  if (!lines.length || lines.length > MAX_LINES) throw new BadRequest("lines の数");
  if (lines.some((l) => !l || [...l].length > MAX_CHARS)) throw new BadRequest("1行の字数");
  return lines as string[];
}

// 回数の上限。Cloud Run の1台の中だけで数える（台数は最大1台にしぼる）
const hits = new Map<string, number[]>();
let day = "";
let geminiToday = 0;

export function checkRate(ip: string, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_IP_PER_MIN) throw new TooMany("ip");
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
}

function countGemini(now = Date.now()) {
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) { day = d; geminiToday = 0; }
  if (geminiToday >= GEMINI_PER_DAY) throw new TooMany("day");
  geminiToday++;
}

// 同じ文は前の答えを使い回す。指示文で「行ごとに、ほかの行を使わずに読む」と決めているので、1行ずつ覚える
const cache = new Map<string, Step[]>();

/** Gemini に「1: 文\n2: 文」を送って、行ごとの steps を返す関数 */
export type Generate = (text: string, signal: AbortSignal) => Promise<InterpretResponse>;

export async function interpretLines(lines: string[], generate: Generate, timeoutMs = SERVER_TIMEOUT_MS): Promise<InterpretResponse> {
  const todo = [...new Set(lines.filter((l) => !cache.has(l)))];
  if (todo.length) {
    countGemini();
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => {
      // 先に GeminiTimeout で負けを決めてから止める（逆だと止めたときのエラーが先に届く）
      timer = setTimeout(() => { rej(new GeminiTimeout()); ctrl.abort(); }, timeoutMs);
    });
    let res: InterpretResponse;
    try {
      res = await Promise.race([generate(todo.map((l, i) => `${i + 1}: ${l}`).join("\n"), ctrl.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
    todo.forEach((l, i) => {
      const got = res.lines.find((x) => x.line === i + 1);
      if (!got) throw new Error("Gemini の答えに行が足りない");
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(l, got.steps);
    });
  }
  return { lines: lines.map((l, i) => ({ line: i + 1, steps: cache.get(l)! })) };
}

/** テスト用: 覚えたものと回数を消す */
export function resetForTest() {
  cache.clear();
  hits.clear();
  day = "";
  geminiToday = 0;
}
