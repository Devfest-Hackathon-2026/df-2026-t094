// POST /api/interpret の入出力の型（企画書 4-2 の形どおり）
// 置き場所の例: src/lib/interpret-types.ts

export type Action =
  | "spread_out" // 広げる
  | "put"        // のせる・いれる
  | "nigiru"     // にぎる
  | "maku"       // 巻く
  | "unknown";   // 知らない動作

export type ObjectId = "rice" | "ume" | "nori" | "wrap" | "shamoji";

export interface Step {
  action: Action;
  target: ObjectId | null; // 書いていなければ null
  tool: ObjectId | null;   // 書いていなければ null（補わない）
  onto: ObjectId | "table" | null; // 行き先。書いていなければ常に null
  raw_verb: string;        // 子どもが書いた動詞の辞書形（「にぎって」→「にぎる」）
}

export interface InterpretedLine {
  line: number;  // 1 から
  steps: Step[]; // 1行に動作が2つあることもあるので配列
}

export interface InterpretRequest {
  topicId: "onigiri";
  lines: string[]; // 全行まとめて送る（最大10行・各40字）
}

export interface InterpretResponse {
  lines: InterpretedLine[];
}
