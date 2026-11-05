// 「ロボが起きる」画面が待つ相手。Cloud Run が起きて返事をしたら画面を進める。
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
