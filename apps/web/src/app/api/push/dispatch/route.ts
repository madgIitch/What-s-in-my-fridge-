import { timingSafeEqual } from "node:crypto";
import { dispatchPushBatch } from "@/lib/push/dispatch.server";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const processed = await dispatchPushBatch();
    return Response.json({ ok: true, processed }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "PUSH_DISPATCH_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
