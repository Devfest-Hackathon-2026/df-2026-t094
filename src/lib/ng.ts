// 子どもが書いた動詞（raw_verb）を画面に出す直前のチェック（ui-plan.md 2-3）。
// 引っかかったら質問文ごと「ロボ、わからないよ」に差し替える。語は仮。本番前に2人で足す。
const NG = ["しね", "ころす", "きもい", "うざい", "ばか", "あほ", "くそ"];

export function safeQuestion(question: string, rawVerb: string): string {
  const v = rawVerb.replace(/\s/g, "");
  if (NG.some((w) => v.includes(w))) return "ロボ、わからないよ";
  return question;
}
