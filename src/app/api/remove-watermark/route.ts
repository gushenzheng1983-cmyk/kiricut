import { NextRequest, NextResponse } from "next/server";
import { removeWatermarkServer } from "@/lib/server/lamaServer";
import type { WatermarkZone } from "@/lib/watermarkZones";
import { WATERMARK_ZONE_OPTIONS } from "@/lib/watermarkZones";

const VALID_ZONES = new Set(
  WATERMARK_ZONE_OPTIONS.map((option) => option.zone)
);

function parseZone(value: FormDataEntryValue | null): WatermarkZone {
  if (typeof value !== "string" || !VALID_ZONES.has(value as WatermarkZone)) {
    return "auto";
  }
  return value as WatermarkZone;
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "画像ファイルが見つかりません" },
        { status: 400 }
      );
    }

    const zone = parseZone(formData.get("zone"));
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const resultBuffer = await removeWatermarkServer(inputBuffer, zone);
    const base64 = resultBuffer.toString("base64");

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error("remove-watermark API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "云端水印除去に失敗しました",
      },
      { status: 500 }
    );
  }
}
