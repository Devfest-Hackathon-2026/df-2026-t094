// 画面から手順の文を全部まとめて受け取り、Gemini（Vertex AI）で interpret-types.ts の形に変える。
// 鍵は使わない。Cloud Run では専用のサービスアカウント、手元では gcloud のログインで呼ぶ。
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { InterpretResponse } from "@/lib/interpret-types";
import { PROMPT, SCHEMA } from "@/lib/interpret-prompt";
import { BadRequest, checkRate, clientIp, GeminiTimeout, interpretLines, parseBody, TooMany } from "@/lib/server-interpret";

export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
// 考える量。指定しなければモデルの既定値。MINIMAL のほうが速い
const THINKING = process.env.GEMINI_THINKING as ThinkingLevel | undefined;

let ai: GoogleGenAI | undefined;
function client() {
  ai ??= new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT ?? "kotoba-robo-devfest26",
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
  });
  return ai;
}

async function generate(text: string, signal: AbortSignal): Promise<InterpretResponse> {
  const r = await client().models.generateContent({
    model: MODEL,
    contents: text,
    config: {
      systemInstruction: PROMPT,
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      ...(THINKING ? { thinkingConfig: { thinkingLevel: THINKING } } : {}),
      abortSignal: signal,
    },
  });
  return JSON.parse(r.text ?? "");
}

export async function POST(req: Request) {
  try {
    checkRate(clientIp(req.headers.get("x-forwarded-for")));
    const lines = parseBody(await req.json().catch(() => null));
    return Response.json(await interpretLines(lines, generate));
  } catch (e) {
    if (e instanceof BadRequest) return Response.json({ error: "bad_request" }, { status: 400 });
    if (e instanceof TooMany) return Response.json({ error: "too_many" }, { status: 429 });
    if (e instanceof GeminiTimeout) return Response.json({ error: "timeout" }, { status: 504 });
    console.error("interpret failed", e);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
