import { NextRequest, NextResponse } from "next/server";
import { recordUsageEvent } from "@/lib/usageStats";

export const runtime = "nodejs";
export const maxDuration = 120;

const INPAINT_SERVICE_URL =
  process.env.INPAINT_SERVICE_URL ?? "http://127.0.0.1:8765";

function pngBufferToDataUrl(buffer: ArrayBuffer): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const mask = formData.get("mask");

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: "缺少 image 文件" }, { status: 400 });
    }
    if (!mask || !(mask instanceof Blob)) {
      return NextResponse.json({ error: "缺少 mask 文件" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("image", image, "image.png");
    upstream.append("mask", mask, "mask.png");

    const response = await fetch(`${INPAINT_SERVICE_URL}/inpaint`, {
      method: "POST",
      body: upstream,
    });

    if (!response.ok) {
      let detail = "服务端 AI 修图失败";
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) detail = err.detail;
      } catch {
        detail = (await response.text()) || detail;
      }
      void recordUsageEvent("inpaint_fail");
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1024) {
      void recordUsageEvent("inpaint_fail");
      return NextResponse.json(
        { error: `AI 返回图片过小（${buffer.byteLength} bytes）` },
        { status: 502 }
      );
    }

    void recordUsageEvent("inpaint_ok");
    return NextResponse.json({
      image: pngBufferToDataUrl(buffer),
      bytes: buffer.byteLength,
    });
  } catch (error) {
    console.error("inpaint proxy error:", error);
    void recordUsageEvent("inpaint_fail");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "无法连接 AI 推理服务，请确认 Python 服务已启动",
      },
      { status: 503 }
    );
  }
}
