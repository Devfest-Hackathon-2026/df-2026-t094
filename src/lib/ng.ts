// 子どもが書いた動詞（raw_verb）を画面に出す直前のチェック（ui-plan.md 2-3）。
// 引っかかったら質問文ごと「ロボ、わからないよ」に差し替える。語は仮。本番前に2人で足す。
const NG = ["しね", "ころす", "きもい", "うざい", "ばか", "あほ", "くそ", "死ね", "殺す", "馬鹿", "糞"];
export const NG_MESSAGE = "ロボ、わからないよ";

// カタカナはひらがなにそろえてから見る（「バカ」も引っかける）
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function isNg(rawVerb: string): boolean {
  const v = toHira(rawVerb.replace(/\s/g, ""));
  return NG.some((w) => v.includes(w));
}

export function safeQuestion(question: string, rawVerb: string): string {
  return isNg(rawVerb) ? NG_MESSAGE : question;
}
