import {
  createRotatedRectMask,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import {
  applyColorThroughMask,
  applyCoverAnchor,
  computeCoverAiFeatherPx,
  computeMaskExpandPx,
  createCanvas,
  expandMaskCanvas,
  loadImage,
} from "@/lib/canvasUtils";
import { inpaintWithLama } from "@/lib/lamaInpaint";
import {
  getZoneSearchBoxes,
  resolveCoverZoneRect,
  type CoverSize,
  type WatermarkZone,
} from "@/lib/watermarkZones";

function usesRotatedMask(
  zone: WatermarkZone,
  rect: CoverZoneRect
): boolean {
  return zone === "custom" || Math.abs(rect.rotationDeg ?? 0) > 0.5;
}

/** 按去水印红框生成 LaMa 修复蒙版（白=待修复区域，支持旋转） */
export function createWatermarkZoneMask(
  width: number,
  height: number,
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect?: CoverZoneRect | null
): HTMLCanvasElement {
  if (zone === "auto") {
    throw new Error("请先智能识别或手动选择水印位置");
  }

  const activeRect = resolveCoverZoneRect(zone, coverSize, customRect ?? null);

  if (usesRotatedMask(zone, activeRect)) {
    return createRotatedRectMask(activeRect, width, height);
  }

  const boxes = getZoneSearchBoxes(
    width,
    height,
    zone,
    coverSize,
    customRect
  );
  const { canvas, ctx } = createCanvas(width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  for (const box of boxes) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    if (w > 0 && h > 0) {
      ctx.fillRect(box.x0, box.y0, w, h);
    }
  }
  return canvas;
}

/**
 * AI 修图去水印：智能混合
 * 1. 蒙版略外扩吃掉水印光晕
 * 2. 框内先铺底色（盖住字）
 * 3. LaMa 修边过渡
 * 4. 核心区再铺底色巩固（避免印子回潮）
 */
export async function inpaintWatermarkZone(
  imageDataUrl: string,
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect?: CoverZoneRect | null,
  onModelProgress?: (percent: number) => void,
  coverColor?: string | null
): Promise<string> {
  const image = await loadImage(imageDataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const fillMask = createWatermarkZoneMask(
    width,
    height,
    zone,
    coverSize,
    customRect
  );
  const inpaintMask = expandMaskCanvas(
    fillMask,
    computeMaskExpandPx(width, height)
  );

  let inputUrl = imageDataUrl;
  if (coverColor) {
    const { canvas, ctx } = createCanvas(width, height);
    ctx.drawImage(image, 0, 0, width, height);
    applyColorThroughMask(ctx, width, height, fillMask, coverColor);
    inputUrl = canvas.toDataURL("image/png");
  }

  const featherPx = computeCoverAiFeatherPx(width, height);
  let result = await inpaintWithLama(
    inputUrl,
    inpaintMask,
    onModelProgress,
    { featherPx }
  );

  if (coverColor) {
    try {
      result = await applyCoverAnchor(result, fillMask, coverColor, 0.72);
    } catch (anchorError) {
      console.warn("applyCoverAnchor failed, using inpaint result:", anchorError);
    }
  }

  return result;
}
