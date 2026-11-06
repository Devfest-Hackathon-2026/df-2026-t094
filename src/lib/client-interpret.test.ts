import { describe, expect, it } from "vitest";
import { guess } from "./client-interpret";

describe("モックの当てはめ（台本にない文）", () => {
  it.each(["うめをごはんの中にいれる", "うめをごはんのなかにいれる", "うめをごはんの上にのせる", "うめをごはんにいれる"])("%s は どこに=ごはん", (s) => {
    expect(guess(s)).toMatchObject({ action: "put", target: "ume", onto: "rice" });
  });
  it("どこにが無ければ null", () => {
    expect(guess("うめをいれる").onto).toBeNull();
  });
});

import { run, type Topic } from "./engine";
import topicJson from "./onigiri.json";

it("「うめをごはんの中にいれる」の手順で できる", () => {
  const lines = ["ラップを広げる", "しゃもじでごはんをラップにのせる", "うめをごはんの中にいれる", "ごはんをにぎる", "のりを巻く"];
  const res = { lines: lines.map((t, i) => ({ line: i + 1, steps: [guess(t)] })) };
  expect(run(topicJson as unknown as Topic, res).kind).toBe("success");
});
