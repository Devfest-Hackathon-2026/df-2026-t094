// 再生モード: AI の調子が悪くても、台本4回分が決まった答えで流れることを確かめる
import { afterEach, describe, expect, it, vi } from "vitest";
import topic from "./onigiri.json";
import { run, type Topic } from "./engine";
import { interpret } from "./client-interpret";
import { findReplay, REPLAY_ROUNDS } from "./replay-script";

const t = topic as unknown as Topic;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("再生モード", () => {
  it("台本4回分は 失敗3回→成功 の順に並んでいる", () => {
    const kinds = REPLAY_ROUNDS.map((r) => run(t, r.response).kind);
    expect(kinds).toEqual(["fail", "fail", "fail", "success"]);
  });

  it("前後の空白や空行があっても台本と一致する", () => {
    const r = REPLAY_ROUNDS[1];
    expect(findReplay(["", ...r.input.map((l) => ` ${l} `), ""])).toBe(r.response);
    expect(findReplay(["ちがう文"])).toBeNull();
  });

  it("NEXT_PUBLIC_USE_API=1 でも offline なら AI を呼ばない", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_API", "1");
    const fetchSpy = vi.fn(() => Promise.reject(new Error("AI 停止中")));
    vi.stubGlobal("fetch", fetchSpy);
    for (const r of REPLAY_ROUNDS) {
      expect(await interpret(r.input, { offline: true })).toEqual(r.response);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("offline でなければ NEXT_PUBLIC_USE_API=1 で AI を呼ぶ", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_API", "1");
    const res = REPLAY_ROUNDS[0].response;
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(res))));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await interpret(REPLAY_ROUNDS[0].input)).toEqual(res);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
