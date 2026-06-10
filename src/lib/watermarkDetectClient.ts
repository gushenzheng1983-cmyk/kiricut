import { createCanvas, loadImage } from "@/lib/canvasUtils";
import {
  DETECT_COVER_SIZE,
  getAllSearchBoxes,
  type WatermarkZone,
  type ZoneBox,
} from "@/lib/watermarkZones";

export type DetectableZone = Exclude<WatermarkZone, "auto" | "custom">;

export type DetectZoneResult = {
  zone: DetectableZone | null;
  confidence: number;
};

const CONFIDENCE_MIN = 0.12;

function scoreWatermarkInBox(
  data: Uint8ClampedArray,
  imgW: number,
  box: ZoneBox
): number {
  let nonWhite = 0;
  let edgeSum = 0;
  let count = 0;

  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * imgW + x) * 4;
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (gray < 238) nonWhite++;
      if (x > box.x0) {
        const pi = (y * imgW + (x - 1)) * 4;
        const prev = (data[pi] + data[pi + 1] + data[pi + 2]) / 3;
        edgeSum += Math.abs(gray - prev);
      }
      if (y > box.y0) {
        const pi = ((y - 1) * imgW + x) * 4;
        const prev = (data[pi] + data[pi + 1] + data[pi + 2]) / 3;
        edgeSum += Math.abs(gray - prev);
      }
      count++;
    }
  }

  if (count === 0) return 0;
  const nonWhiteRatio = nonWhite / count;
  const edgeAvg = edgeSum / (count * 2);
  return nonWhiteRatio * 0.55 + Math.min(1, edgeAvg / 35) * 0.45;
}

/** 浏览器端：在左上/右下/中央中选最像有水印的一处（只返回一个） */
export async function detectBestWatermarkZone(
  imageDataUrl: string
): Promise<DetectZoneResult> {
  const img = await loadImage(imageDataUrl);
  const maxSide = 520;
  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const w = Math.max(32, Math.round(img.naturalWidth * scale));
  const h = Math.max(32, Math.round(img.naturalHeight * scale));
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  const boxes = getAllSearchBoxes(w, h, DETECT_COVER_SIZE);
  let best: { zone: DetectableZone; score: number } | null = null;

  for (const box of boxes) {
    const score = scoreWatermarkInBox(imageData.data, w, box);
    if (!best || score > best.score) {
      best = { zone: box.id as DetectableZone, score };
    }
  }

  if (!best || best.score < CONFIDENCE_MIN) {
    return { zone: null, confidence: best?.score ?? 0 };
  }

  return { zone: best.zone, confidence: best.score };
}
