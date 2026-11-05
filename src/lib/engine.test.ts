// デモ台本の4回分（ui-plan.md 5章）が、決めたとおりの行・観点・質問・アニメで止まるかを確かめる
import { describe as d, expect, it } from "vitest";
import topic from "./onigiri.json";
import { MOCK_ROUNDS } from "./mock-interpret";
import { run, type Topic } from "./engine";

const t = topic as unknown as Topic;

d("状態エンジン（おにぎり）", () => {
  it("1回目: 1行目で 道具「なにで にぎるの？」", () => {
    const o = run(t, MOCK_ROUNDS[0].response);
    expect(o).toMatchObject({ kind: "fail", line: 1, viewpoint: "道具", question: "なにで にぎるの？", anim: "nigiru_barehand" });
  });
  it("2回目: 4行目で 順番「その前に なにか し忘れてない？」", () => {
    const o = run(t, MOCK_ROUNDS[1].response);
    expect(o).toMatchObject({ kind: "fail", line: 4, viewpoint: "順番", question: "その前に なにか し忘れてない？", anim: "onigiri_crack" });
  });
  it("3回目: 3行目で どこに「どこに いれるの？」", () => {
    const o = run(t, MOCK_ROUNDS[2].response);
    expect(o).toMatchObject({ kind: "fail", line: 3, viewpoint: "どこに", question: "どこに いれるの？", anim: "ume_drop_table" });
  });
  it("4回目: 成功", () => {
    expect(run(t, MOCK_ROUNDS[3].response).kind).toBe("success");
  });
  it("知らない動作は観点なしで聞き返す", () => {
    const o = run(t, { lines: [{ line: 1, steps: [{ action: "unknown", target: "rice", tool: null, onto: null, raw_verb: "ころがす" }] }] });
    expect(o).toMatchObject({ kind: "fail", viewpoint: null, reason: "unknown", question: "『ころがす』（ごはん）って わからないよ" });
  });
  it("知らない動作で target が無ければ括弧ごと消す", () => {
    const o = run(t, { lines: [{ line: 1, steps: [{ action: "unknown", target: null, tool: null, onto: null, raw_verb: "とぶ" }] }] });
    expect(o).toMatchObject({ question: "『とぶ』って わからないよ" });
  });
  it("全部動いても完成していなければゴール未達", () => {
    const o = run(t, { lines: [{ line: 1, steps: [{ action: "spread_out", target: "wrap", tool: null, onto: null, raw_verb: "広げる" }] }] });
    expect(o).toMatchObject({ kind: "fail", reason: "goal", viewpoint: "順番", question: "できあがり？ まだ なにか たりないみたい" });
  });
});
