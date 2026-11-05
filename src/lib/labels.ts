import topic from "./onigiri.json";

const EXTRA: Record<string, string> = { table: "テーブル", bowl: "ちゃわん", plate: "おさら" };

/** 物の id を画面に出す名前にする（ume → うめぼし） */
export function label(id: string): string {
  const o = (topic.objects as Record<string, { label: string }>)[id];
  return o?.label ?? EXTRA[id] ?? id;
}
