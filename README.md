# ことばロボ

**DevFest GDGoC Japan 2026 Hackathon（東京会場）／チーム キルケ／カテゴリ: 教育**

小学生が「手順を言葉で説明する」練習を、家で一人でできる Web アプリです。
子どもが「おにぎりを作る」手順を日本語で1行ずつ書いて送ると、ロボは**書いてあることだけ**をして動きます。
「ごはんをにぎる」とだけ書けば、素手で茶わんのごはんをつかんで手がごはんだらけになり、「なにで にぎるの？」と聞き返します。
ロボは答えを教えません。子どもが自分で書き直して、ロボがおにぎりを完成させるまで続けます。

## 公開URL

**https://kotoba-robo-318647890284.asia-northeast1.run.app**

- ログインは不要です。PC かタブレットの横向きで開いてください（スマートフォンの縦向きには対応していません）
- しばらく使われていないと、最初の表示に数秒かかります（その間はロボが「起きる」動画が流れます）

## 遊び方（動作確認の手順）

1. お題「おにぎりを 作る」を選んで「はじめる」を押す
2. 次の3行を送る → 素手でにぎって失敗し「なにで にぎるの？」と聞かれる（**道具**の失敗）
   ```
   ごはんをにぎる
   うめをいれる
   のりを巻く
   ```
3. 次の5行に書き直す → にぎったあとにうめを押しこみ、ひびが入る（**順番**の失敗）
   ```
   ラップを広げる
   しゃもじでごはんをラップにのせる
   ごはんをにぎる
   うめをいれる
   のりを巻く
   ```
4. 3行目と4行目を入れかえる → うめの置き場所が分からず、テーブルに転がる（**どこに**の失敗）
5. 「うめをいれる」を「うめをごはんの真ん中にのせる」にする → 完成。最初と最後の手順が並び、変わった行に色がつく

「ごはんを丸める」のような言い換えは「にぎる」と読み取ります。「ごはんをこねる」のように知らない動作は「『こねる』って なに？」と聞き返します。

## しくみ

```
ブラウザ（Next.js の画面・状態エンジン・動画）
   │  手順の文を全行まとめて1回で送る
   ▼
Cloud Run（Next.js の API  POST /api/interpret）
   │  サービスアカウントで呼ぶ（APIキーなし）
   ▼
Vertex AI の Gemini（構造化出力で、行ごとに「動作・対象・道具・行き先」を返す）
```

一番の工夫は、**AI に察させない**ことです。

- Gemini の仕事は、文を決まった形に分解することだけです。書いていない道具や行き先は空欄（null）で返させます
- できたかどうかは、お題ごとの前提条件（`src/lib/onigiri.json`）を持つ自作の**状態エンジン**（`src/lib/engine.ts`）がブラウザ側で決めます
- AI に成否まで判定させると「ふつうはラップを使うだろう」と補ってしまい、言葉どおりにしか動かないロボになりません

作り始める前に、80個のテスト文で「察さないか」を確かめました。書いていない物を補った文は2回とも 0/80、動作と対象が正解と一致した文は 62/80・63/80 でした（単純な単語一致の方法は 32/80）。

子ども向けの安全対策として、1回10行・1行40字まで、1分あたり・1日あたりの送信回数に上限があります。不適切な言葉は画面に出す前に確認し、子どもの書いた文は保存しません。

## 使用した Google の技術

| 技術 | 使いどころ |
|---|---|
| Cloud Run（asia-northeast1） | 画面と API を1つのコンテナで動かす |
| Vertex AI の Gemini（gemini-3-flash-preview） | 子どもの文を構造化された手順に読み取る |
| Cloud Build・Artifact Registry | `gcloud run deploy --source .` でのビルドとイメージの保管 |
| Cloud Logging | エラーと呼び出し回数の記録 |
| Gemini Omni 1.2 Flash | キャラクターの動画8本（`public/anim/`） |
| Nano Banana 2 | 動画の元絵・止まった絵・お題の絵 |
| Lyria 3 Pro | BGM・効果音の一部（残りは `scripts/make-sounds.py` で数式から生成） |

## 手元で動かす

Node.js 20 以上が必要です。

```bash
npm ci
npm run dev        # http://localhost:3000
```

この起動では Gemini を呼ばず、`src/lib/mock-interpret.ts`（簡単な読み取り）で動きます。
本物の Gemini で動かすときは、Vertex AI を使える Google Cloud のプロジェクトで `gcloud auth application-default login` をしてから、次のように起動します。

```bash
NEXT_PUBLIC_USE_API=1 GOOGLE_CLOUD_PROJECT=<プロジェクトID> npm run dev
```

| 環境変数 | 意味 | 既定値 |
|---|---|---|
| `NEXT_PUBLIC_USE_API` | `1` で画面から `/api/interpret`（Gemini）を呼ぶ。ビルド時に埋め込まれる | なし（モック） |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | Vertex AI のプロジェクトとリージョン | `kotoba-robo-devfest26` / `global` |
| `GEMINI_MODEL` | 使うモデル | `gemini-3-flash-preview` |
| `GEMINI_PER_DAY` | 1日に Gemini を呼ぶ上限 | `300` |

テストとチェック:

```bash
npm test           # vitest（状態エンジン・読み取り・API の守り）
npm run lint
```

## デプロイ

```bash
gcloud run deploy kotoba-robo --source . --region asia-northeast1
```

`Dockerfile` で Next.js の standalone 出力だけを小さいイメージに入れます。Gemini は Cloud Run の専用サービスアカウント（Vertex AI ユーザーの権限のみ）で呼ぶので、APIキーや鍵ファイルは使いません。

## フォルダ構成

```
src/
  app/              画面（トップ・おにぎりのお題）と API（/api/interpret, /api/health）
  components/       遊ぶ画面・動画・BGM
  lib/
    engine.ts       状態エンジン（成否の判定）
    onigiri.json    お題「おにぎり」の前提条件
    interpret-prompt.ts  Gemini への指示文と出力の形
    server-interpret.ts  入力の制限・回数の上限・打ち切り
    mock-interpret.ts    Gemini を使わないときの読み取り
    ng.ts           不適切な言葉の確認
public/             動画・絵・音
scripts/            効果音を作るスクリプト
```

## チーム

チーム キルケ（チョン、ソウタ）

## ライセンス

[MIT License](LICENSE)
