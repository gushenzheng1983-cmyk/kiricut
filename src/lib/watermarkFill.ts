import {
  applyRotatedRectFill,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import {
  compositeWithSoftMask,
  computeCoverAiFeatherPx,
  computeCoverFeatherPx,
  createCanvas,
  loadImage,
} from "@/lib/canvasUtils";
import { inpaintWithLama } from "@/lib/lamaInpaint";
import {
  getZoneSearchBoxes,
  resolveCoverZoneRect,
  type CoverSize,
  type WatermarkZone,
} from "@/lib/watermarkZones";
import {
  createWatermarkZoneMask,
} from "@/lib/watermarkInpaint";
import type { CoverBlendMode } from "@/types";

function usesRotatedRect(
  zone: WatermarkZone,
  rect: CoverZoneRect
): boolean {
  return zone === "custom" || Math.abs(rect.rotationDeg ?? 0) > 0.5;
}

/** 框内 100% 铺底色，不把原水印像素留在覆盖层 */
function applySolidCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect: CoverZoneRect | null | undefined,
  coverColor: string
): void {
  const activeRect = resolveCoverZoneRect(zone, coverSize, customRect ?? null);

  if (usesRotatedRect(zone, activeRect)) {
    applyRotatedRectFill(ctx, activeRect, width, height, coverColor);
    return;
  }

  const boxes = getZoneSearchBoxes(
    width,
    height,
    zone,
    coverSize,
    customRect
  );
  if (boxes.length === 0) {
    throw new Error("未找到水印覆盖区域");
  }

  ctx.fillStyle = coverColor;
  for (const box of boxes) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    if (w > 0 && h > 0) {
      ctx.fillRect(box.x0, box.y0, w, h);
    }
  }
}

function buildCoverOverlayCanvas(
  img: HTMLImageElement,
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect: CoverZoneRect | null | undefined,
  coverColor: string
): { original: HTMLCanvasElement; overlay: HTMLCanvasElement } {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const { canvas: original, ctx: origCtx } = createCanvas(width, height);
  const { canvas: overlay, ctx: overCtx } = createCanvas(width, height);

  origCtx.drawImage(img, 0, 0, width, height);
  overCtx.drawImage(img, 0, 0, width, height);
  applySolidCover(overCtx, width, height, zone, coverSize, customRect, coverColor);

  return { original, overlay };
}

/** 红框区域覆盖；flat=实色块 · feather=窄边过渡 · feather-ai=铺色后 AI 修边 */
export async function fillWatermarkZone(
  imageDataUrl: string,
  zone: WatermarkZone,
  coverColor: string,
  coverSize: CoverSize,
  customRect?: CoverZoneRect | null,
  blendMode: CoverBlendMode = "feather"
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const mask = createWatermarkZoneMask(
    width,
    height,
    zone,
    coverSize,
    customRect
  );

  if (blendMode === "feather-ai") {
    try {
      const { canvas, ctx } = createCanvas(width, height);
      ctx.drawImage(img, 0, 0, width, height);
      applySolidCover(ctx, width, height, zone, coverSize, customRect, coverColor);
      return await inpaintWithLama(
        canvas.toDataURL("image/png"),
        mask,
        undefined,
        { featherPx: computeCoverAiFeatherPx(width, height) }
      );
    } catch {
      blendMode = "flat";
    }
  }

  const { original, overlay } = buildCoverOverlayCanvas(
    img,
    zone,
    coverSize,
    customRect,
    coverColor
  );

  if (blendMode === "flat") {
    return overlay.toDataURL("image/png");
  }

  const featherPx = computeCoverFeatherPx(width, height);
  const merged = compositeWithSoftMask(
    original,
    overlay,
    mask,
    featherPx
  );
  return merged.toDataURL("image/png");
}
