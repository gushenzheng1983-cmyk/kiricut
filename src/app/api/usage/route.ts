import { NextRequest, NextResponse } from "next/server";
import { getUsageStats, recordUsageEvent, type UsageEvent } from "@/lib/usageStats";

export const runtime = "nodejs";

const ALLOWED: UsageEvent[] = [
  "page_ping",
  "inpaint_ok",
  "inpaint_fail",
  "bg_ok",
  "bg_fail",
  "activate_ok",
];

function authorized(request: NextRequest): boolean {
  const secret = process.env.USAGE_STATS_SECRET?.trim();
  if (!secret) return true; // 未配置密钥时仅本机可读；生产务必设置
  const header = request.headers.get("x-usage-secret") ?? "";
  const query = request.nextUrl.searchParams.get("secret") ?? "";
  return header === secret || query === secret;
}

/** GET：查看统计（建议带 USAGE_STATS_SECRET） */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const stats = await getUsageStats(Number.isFinite(days) ? days : 30);
  return NextResponse.json(stats);
}

/** POST：记录一次事件（前端心跳 / 服务端也可调） */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { event?: string };
    const event = body.event as UsageEvent | undefined;
    if (!event || !ALLOWED.includes(event)) {
      return NextResponse.json({ error: "invalid event" }, { status: 400 });
    }
    // 前端只允许心跳；修图成功由 API 服务端写入，防刷
    if (event !== "page_ping" && event !== "activate_ok") {
      return NextResponse.json({ error: "forbidden event" }, { status: 403 });
    }
    await recordUsageEvent(event);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
