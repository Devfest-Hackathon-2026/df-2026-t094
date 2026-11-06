// Gemini に渡す指示文と答えの形。80文テスト（test/scripts/prompt.txt・run_gemini.py）と同じ中身。
// 変えるときは 80文テストを流し直す。

export const PROMPT = `あなたは、子どもが書いたおにぎり作りの手順の文を、ロボットへの命令に変える係です。
入力は「1: 文」「2: 文」のように行番号つきで届きます。行ごとに、その行に書いてある動作を読み取って JSON で返してください。

## 答えの形
- lines: 行ごとに1つ。line は入力の行番号と同じにする
- steps: その行に書いてある動作。書いてある順に並べる。1行に動作が2つあれば steps を2つにする
- 1つの動作は次の5つで表す
  - action: 動作
  - target: 動作を受ける物
  - tool: 動作に使う道具
  - onto: 物を置く先・行き先
  - raw_verb: 文に書いてある動詞を辞書形にしたもの（「にぎって」→「にぎる」）

## 使える値
action
- spread_out: 広げる
- put: のせる・いれる
- nigiru: にぎる
- maku: 巻く
- unknown: 上のどれにも当てはまらない動作

target・tool・onto に使える物
- rice: ごはん
- ume: うめ
- nori: のり
- wrap: ラップ
- shamoji: しゃもじ
- table: テーブル（onto だけ）

## 大事な決まり
- その行に書いていない物・道具・行き先は、推測せず null にする。ふつうはこうする、という知識で補わない
- 「それ」「そこ」「これ」などの指し示すことばは、前の行から読み取らず null にする。ほかの行の内容を使って、その行の空いている所を埋めない
- 上の action のどれにも当てはまらない動作は unknown にする
- 上の一覧にない物は、target・tool・onto に入れない
`;

const OBJ = ["rice", "ume", "nori", "wrap", "shamoji"];
const STEP = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ["spread_out", "put", "nigiru", "maku", "unknown"] },
    target: { type: "STRING", enum: OBJ, nullable: true },
    tool: { type: "STRING", enum: OBJ, nullable: true },
    onto: { type: "STRING", enum: [...OBJ, "table"], nullable: true },
    raw_verb: { type: "STRING" },
  },
  required: ["action", "target", "tool", "onto", "raw_verb"],
};

export const SCHEMA = {
  type: "OBJECT",
  properties: {
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { line: { type: "INTEGER" }, steps: { type: "ARRAY", items: STEP } },
        required: ["line", "steps"],
      },
    },
  },
  required: ["lines"],
};
