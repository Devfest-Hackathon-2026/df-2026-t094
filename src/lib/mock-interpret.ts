// 11/5 用の「決まった答え」。デモ台本の4回分（企画書 1章の台本と一字一句同じ入力）
// 本物の /api/interpret とつなぐまで、画面はこれを返す関数を使う
// 置き場所の例: src/lib/mock-interpret.ts
import type { InterpretResponse, Step } from "./interpret-types";

const s = (
  action: Step["action"], target: Step["target"], tool: Step["tool"], onto: Step["onto"], raw_verb: string,
): Step => ({ action, target, tool, onto, raw_verb });

export const MOCK_ROUNDS: { input: string[]; response: InterpretResponse; expect: string }[] = [
  {
    // 1回目: 道具の失敗（素手でにぎって手がごはんだらけ）
    input: ["ごはんをにぎる", "うめをいれる", "のりを巻く"],
    response: { lines: [
      { line: 1, steps: [s("nigiru", "rice", null, null, "にぎる")] },
      { line: 2, steps: [s("put", "ume", null, null, "いれる")] },
      { line: 3, steps: [s("maku", "nori", null, null, "巻く")] },
    ] },
    expect: "1行目で止まる。道具「なにで にぎるの？」 anim: nigiru_barehand",
  },
  {
    // 2回目: 順番の失敗（にぎった後にうめを押しこんでひび）
    input: ["ラップを広げる", "しゃもじでごはんをラップにのせる", "ごはんをにぎる", "うめをいれる", "のりを巻く"],
    response: { lines: [
      { line: 1, steps: [s("spread_out", "wrap", null, null, "広げる")] },
      { line: 2, steps: [s("put", "rice", "shamoji", "wrap", "のせる")] },
      { line: 3, steps: [s("nigiru", "rice", null, null, "にぎる")] },
      { line: 4, steps: [s("put", "ume", null, null, "いれる")] },
      { line: 5, steps: [s("maku", "nori", null, null, "巻く")] },
    ] },
    expect: "4行目で止まる。順番「その前に なにか し忘れてない？」 anim: onigiri_crack",
  },
  {
    // 3回目: どこにの失敗（うめがテーブルに転がる）
    input: ["ラップを広げる", "しゃもじでごはんをラップにのせる", "うめをいれる", "ごはんをにぎる", "のりを巻く"],
    response: { lines: [
      { line: 1, steps: [s("spread_out", "wrap", null, null, "広げる")] },
      { line: 2, steps: [s("put", "rice", "shamoji", "wrap", "のせる")] },
      { line: 3, steps: [s("put", "ume", null, null, "いれる")] },
      { line: 4, steps: [s("nigiru", "rice", null, null, "にぎる")] },
      { line: 5, steps: [s("maku", "nori", null, null, "巻く")] },
    ] },
    expect: "3行目で止まる。どこに「どこに いれるの？」 anim: ume_drop_table",
  },
  {
    // 4回目: 成功
    input: ["ラップを広げる", "しゃもじでごはんをラップにのせる", "うめをごはんの真ん中にのせる", "ごはんをにぎる", "のりを巻く"],
    response: { lines: [
      { line: 1, steps: [s("spread_out", "wrap", null, null, "広げる")] },
      { line: 2, steps: [s("put", "rice", "shamoji", "wrap", "のせる")] },
      { line: 3, steps: [s("put", "ume", null, "rice", "のせる")] },
      { line: 4, steps: [s("nigiru", "rice", null, null, "にぎる")] },
      { line: 5, steps: [s("maku", "nori", null, null, "巻く")] },
    ] },
    expect: "全行成功・ゴール達成。3行→5行",
  },
];

// 入力が台本のどれかと一致すればその答えを返す。一致しなければ1回目の答え（仮）
export function mockInterpret(lines: string[]): InterpretResponse {
  const key = lines.map((l) => l.trim()).filter(Boolean).join("\n");
  const hit = MOCK_ROUNDS.find((r) => r.input.join("\n") === key);
  return (hit ?? MOCK_ROUNDS[0]).response;
}
