// 状態エンジン: お題 JSON と変換結果（/api/interpret の返事）から、どの行で止まるか・ロボが何を聞くかを決める。
// 純粋な関数だけ。画面や通信には触らない。判定は Gemini に任せず、ここで行う（tech-stack.md 1章）。
import type { InterpretResponse, ObjectId, Step } from "./interpret-types";

export type Viewpoint = "順番" | "道具" | "どこに";

type ObjState = Record<string, string | boolean>;
type Cond = {
  obj?: string;
  tool_in?: string[];
  onto_is?: string;
  viewpoint: Viewpoint;
  question: string;
  anim?: string;
  [k: string]: unknown;
};
type ActionDef = {
  targets?: string[];
  onto?: string[];
  default_onto?: string;
  tool?: string[];
  requires: Cond[];
  effects: ({ obj: string } & Record<string, string | boolean>)[];
};
export type Topic = {
  id: string;
  objects: Record<string, { label: string; state: ObjState }>;
  actions: Record<string, ActionDef>;
  goal: Cond[];
  omission_rules: { allow_previous_object: boolean; applies_to: string[] };
  unknown_question: string;
  missing_target_question: string;
};

/** 1行ぶんの「ロボはこう受け取ったよ」の材料 */
export type Reading = {
  line: number;
  step: Step;
  /** 省略ルールで前の行から補った target */
  targetFromPrev: boolean;
  /** 書いていない onto に default_onto を使ったか */
  ontoDefault: boolean;
  onto: string | null;
};

export type Outcome =
  | { kind: "success"; readings: Reading[] }
  | {
      kind: "fail";
      /** 止まった行（1から） */
      line: number;
      readings: Reading[];
      /** 観点。missing_target と unknown は null（観点カードを光らせない） */
      viewpoint: Viewpoint | null;
      reason: "requires" | "goal" | "unknown" | "missing_target";
      question: string;
      anim: string;
    };

const COMMON_ANIM = "tilt_head";

function fill(template: string, vars: Record<string, string | null>): string {
  let t = template;
  // target が無いときは「（{target}）」を括弧ごと消す
  if (vars.target == null) t = t.replace("（{target}）", "");
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function condHolds(c: Cond, state: Record<string, ObjState>, step: Step, onto: string | null): boolean {
  if (c.tool_in) return step.tool != null && c.tool_in.includes(step.tool);
  if (c.onto_is) return onto === c.onto_is;
  if (c.obj) {
    const s = state[c.obj];
    for (const [k, v] of Object.entries(c)) {
      if (["obj", "viewpoint", "question", "anim"].includes(k)) continue;
      if (s?.[k] !== v) return false;
    }
    return true;
  }
  return true;
}

export function run(topic: Topic, res: InterpretResponse, label = (id: string) => topic.objects[id]?.label ?? id): Outcome {
  const state: Record<string, ObjState> = {};
  for (const [id, o] of Object.entries(topic.objects)) state[id] = { ...o.state };
  const readings: Reading[] = [];
  let prevTarget: ObjectId | null = null;

  for (const ln of res.lines) {
    for (const raw of ln.steps) {
      const step: Step = { ...raw };
      let targetFromPrev = false;
      if (step.target == null && topic.omission_rules.allow_previous_object && prevTarget && step.action !== "unknown") {
        step.target = prevTarget;
        targetFromPrev = true;
      }
      const key: string = step.action === "put" ? `put:${step.target}` : step.action;
      const def: ActionDef | undefined = topic.actions[key];
      const base = { line: ln.line, step, targetFromPrev, ontoDefault: false, onto: step.onto as string | null };

      if (step.action === "unknown" || (step.action !== "put" && !def)) {
        readings.push(base);
        return fail(ln.line, readings, null, "unknown",
          fill(topic.unknown_question, { raw_verb: step.raw_verb, target: step.target ? label(step.target) : null }), COMMON_ANIM);
      }
      if (step.target == null || !def || (def.targets && !def.targets.includes(step.target))) {
        readings.push(base);
        if (step.target == null)
          return fail(ln.line, readings, null, "missing_target",
            fill(topic.missing_target_question, { raw_verb: step.raw_verb }), COMMON_ANIM);
        return fail(ln.line, readings, null, "unknown",
          fill(topic.unknown_question, { raw_verb: step.raw_verb, target: label(step.target) }), COMMON_ANIM);
      }
      // onto は子どもが書いたものだけ。書いていなければ default_onto（例: 巻く→ごはん、のせる→テーブル）
      const onto = step.onto ?? def.default_onto ?? null;
      const reading: Reading = { ...base, onto, ontoDefault: step.onto == null && onto != null };
      readings.push(reading);

      const broken = def.requires.find((c) => !condHolds(c, state, step, onto));
      if (broken)
        return fail(ln.line, readings, broken.viewpoint, "requires",
          fill(broken.question, { raw_verb: step.raw_verb }), broken.anim ?? COMMON_ANIM);

      for (const e of def.effects) {
        const { obj, ...rest } = e;
        state[obj] = { ...state[obj], ...rest };
      }
      prevTarget = step.target;
    }
  }

  const lastLine = res.lines.length ? res.lines[res.lines.length - 1].line : 0;
  const unmet = topic.goal.find((c) => !condHolds(c, state, { action: "unknown", target: null, tool: null, onto: null, raw_verb: "" }, null));
  if (unmet) return fail(lastLine, readings, unmet.viewpoint, "goal", unmet.question, COMMON_ANIM);
  return { kind: "success", readings };

  function fail(line: number, rd: Reading[], viewpoint: Viewpoint | null, reason: Extract<Outcome, { kind: "fail" }>["reason"], question: string, anim: string): Outcome {
    return { kind: "fail", line, readings: rd, viewpoint, reason, question, anim };
  }
}

/** 「ロボはこう受け取ったよ」の文。テンプレートで作る（Gemini に文章を書かせない） */
export function describe(r: Reading, label: (id: string) => string): string {
  const parts = [r.step.raw_verb || "わからない"];
  parts.push(r.step.target ? label(r.step.target) + (r.targetFromPrev ? "（前の行から）" : "") : "なに なし");
  if (r.step.tool) parts.push("道具 " + label(r.step.tool));
  else parts.push("道具 なし");
  if (r.step.onto) parts.push("どこに " + label(r.step.onto));
  else if (r.onto && r.ontoDefault) parts.push("どこに なし");
  return parts.join("／");
}
