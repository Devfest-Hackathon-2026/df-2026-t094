import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterpretResponse } from "./interpret-types";
import { isNg, safeQuestion } from "./ng";
import { BadRequest, checkRate, clientIp, GeminiTimeout, interpretLines, parseBody, PER_IP_PER_MIN, resetForTest, TooMany } from "./server-interpret";

beforeEach(resetForTest);

// 送られた「1: 文」の数だけ、にぎるを返すにせ Gemini
const fake = vi.fn(async (text: string): Promise<InterpretResponse> => ({
  lines: text.split("\n").map((_, i) => ({ line: i + 1, steps: [{ action: "nigiru", target: "rice", tool: null, onto: null, raw_verb: "にぎる" }] })),
}));

describe("入力の制限", () => {
  it("10行・各40字まで通す", () => {
    expect(parseBody({ topicId: "onigiri", lines: Array(10).fill("あ".repeat(40)) })).toHaveLength(10);
  });
  it.each([
    ["11行", { topicId: "onigiri", lines: Array(11).fill("ごはんをにぎる") }],
    ["41字", { topicId: "onigiri", lines: ["あ".repeat(41)] }],
    ["空の行", { topicId: "onigiri", lines: ["ごはんをにぎる", " "] }],
    ["0行", { topicId: "onigiri", lines: [] }],
    ["ちがうお題", { topicId: "sandwich", lines: ["パンをきる"] }],
    ["文字でない行", { topicId: "onigiri", lines: [1] }],
  ])("%s は断る", (_, body) => {
    expect(() => parseBody(body)).toThrow(BadRequest);
  });
});

it("1分に送れる回数をこえたら断る", () => {
  for (let i = 0; i < PER_IP_PER_MIN; i++) checkRate("1.2.3.4", 0);
  expect(() => checkRate("1.2.3.4", 0)).toThrow(TooMany);
  expect(() => checkRate("5.6.7.8", 0)).not.toThrow();
  expect(() => checkRate("1.2.3.4", 61_000)).not.toThrow();
});

it("x-forwarded-for の先頭を書きかえても、同じ相手として数える", () => {
  expect(clientIp("9.9.9.9, 1.2.3.4")).toBe("1.2.3.4");
  expect(clientIp("8.8.8.8, 1.2.3.4")).toBe("1.2.3.4");
  expect(clientIp("1.2.3.4")).toBe("1.2.3.4");
  expect(clientIp(null)).toBe("local");
});

describe("同じ文の使い回し", () => {
  it("前に読んだ行は Gemini に送らない", async () => {
    fake.mockClear();
    await interpretLines(["ラップを広げる", "ごはんをにぎる"], fake);
    const res = await interpretLines(["ラップを広げる", "ごはんを丸める", "ごはんをにぎる"], fake);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(fake.mock.calls[1][0]).toBe("1: ごはんを丸める");
    expect(res.lines.map((l) => l.line)).toEqual([1, 2, 3]);
  });
  it("全部読んだことがあれば Gemini を呼ばない", async () => {
    fake.mockClear();
    await interpretLines(["ごはんをにぎる"], fake);
    await interpretLines(["ごはんをにぎる", "ごはんをにぎる"], fake);
    expect(fake).toHaveBeenCalledTimes(1);
  });
});

it("おそいときは打ち切って、途中の答えを覚えない", async () => {
  const slow = vi.fn((_t: string, signal: AbortSignal) => new Promise<InterpretResponse>((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort")))));
  await expect(interpretLines(["ごはんをにぎる"], slow, 10)).rejects.toThrow(GeminiTimeout);
  expect(slow.mock.calls[0][1].aborted).toBe(true);
  await interpretLines(["ごはんをにぎる"], fake);
  expect(fake).toHaveBeenCalled();
});

describe("NGワード", () => {
  it.each(["しねる", "バカにする", "殺す"])("%s は差しかえる", (v) => {
    expect(safeQuestion("ロボ、「%」ってなに？", v)).toBe("ロボ、わからないよ");
  });
  it("ふつうの動詞はそのまま", () => {
    expect(isNg("にぎる")).toBe(false);
  });
});
