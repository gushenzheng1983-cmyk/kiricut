import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const INPAINT_SERVICE_URL =
  process.env.INPAINT_SERVICE_URL ?? "http://127.0.0.1:8765";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: "缺少 image 文件" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("image", image, "image.png");

    const response = await fetch(`${INPAINT_SERVICE_URL}/remove-background`, {
      method: "POST",
      body: upstream,
    });

    if (!response.ok) {
      let detail = "服务端抠图失败";
      try {
        const err = (await response.json()) as { detail?: string };
        if (err.detail) detail = err.detail;
      } catch {
        detail = (await response.text()) || detail;
      }
      return NextResponse.json(
        { error: detail },
        { status: response.status >= 500 ? 503 : response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("remove-background proxy error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "无法连接 AI 推理服务，请稍后再试",
      },
      { status: 503 }
    );
  }
}
