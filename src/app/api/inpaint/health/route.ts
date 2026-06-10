import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INPAINT_SERVICE_URL =
  process.env.INPAINT_SERVICE_URL ?? "http://127.0.0.1:8765";

export async function GET() {
  try {
    const response = await fetch(`${INPAINT_SERVICE_URL}/health`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "AI 推理服务未就绪" },
        { status: 503 }
      );
    }
    const data = (await response.json()) as {
      ok?: boolean;
      model_loaded?: boolean;
    };
    return NextResponse.json({
      ok: data.ok ?? true,
      model_loaded: data.model_loaded ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "无法连接 AI 推理服务",
      },
      { status: 503 }
    );
  }
}
