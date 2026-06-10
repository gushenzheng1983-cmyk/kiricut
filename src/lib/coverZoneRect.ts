import {
  clampCoverSize,
  type CoverSize,
  type WatermarkZone,
  type ZoneBox,
} from "@/lib/watermarkZones";

/** 覆盖区域在图片上的相对位置（0~1），支持旋转角度 */
export type CoverZoneRect = {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  /** 顺时针角度，适配斜角水印（如 Mercari） */
  rotationDeg?: number;
};

export function clampCoverZoneRect(rect: CoverZoneRect): CoverZoneRect {
  const rotation = rect.rotationDeg ?? 0;
  const hasRotation = Math.abs(rotation) > 0.5;
  const maxW = hasRotation ? 0.92 : 0.72;
  const maxH = hasRotation ? 0.58 : 0.5;
  const w = Math.min(maxW, Math.max(0.08, rect.widthPercent));
  const h = Math.min(maxH, Math.max(0.06, rect.heightPercent));
  const edgePad = hasRotation ? -0.12 : 0;
  return {
    widthPercent: w,
    heightPercent: h,
    xPercent: Math.min(1 - w + 0.18, Math.max(edgePad, rect.xPercent)),
    yPercent: Math.min(1 - h + 0.18, Math.max(edgePad, rect.yPercent)),
    rotationDeg: Math.min(75, Math.max(-75, rotation)),
  };
}

export function getRotatedRectCenter(
  rect: CoverZoneRect,
  imgW: number,
  imgH: number
): { cx: number; cy: number; w: number; h: number } {
  const r = clampCoverZoneRect(rect);
  return {
    cx: (r.xPercent + r.widthPercent / 2) * imgW,
    cy: (r.yPercent + r.heightPercent / 2) * imgH,
    w: r.widthPercent * imgW,
    h: r.heightPercent * imgH,
  };
}

/** 旋转矩形四角（图像坐标） */
export function getRotatedRectCorners(
  rect: CoverZoneRect,
  imgW: number,
  imgH: number
): { x: number; y: number }[] {
  const { cx, cy, w, h } = getRotatedRectCenter(rect, imgW, imgH);
  const rad = ((rect.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = w / 2;
  const hh = h / 2;
  const local = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  return local.map(([lx, ly]) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  }));
}

export function coverZoneRectToBox(
  imgW: number,
  imgH: number,
  rect: CoverZoneRect
): ZoneBox {
  const corners = getRotatedRectCorners(rect, imgW, imgH);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs))),
    y0: Math.max(0, Math.floor(Math.min(...ys))),
    x1: Math.min(imgW, Math.ceil(Math.max(...xs))),
    y1: Math.min(imgH, Math.ceil(Math.max(...ys))),
  };
}

export function applyRotatedRectFill(
  ctx: CanvasRenderingContext2D,
  rect: CoverZoneRect,
  imgW: number,
  imgH: number,
  fillStyle: string
): void {
  const { cx, cy, w, h } = getRotatedRectCenter(rect, imgW, imgH);
  const rad = ((clampCoverZoneRect(rect).rotationDeg ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.fillStyle = fillStyle;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

export function createRotatedRectMask(
  rect: CoverZoneRect,
  imgW: number,
  imgH: number
): HTMLCanvasElement {
  const { canvas, ctx } = (() => {
    const c = document.createElement("canvas");
    c.width = imgW;
    c.height = imgH;
    const x = c.getContext("2d");
    if (!x) throw new Error("Canvas context を取得できません");
    return { canvas: c, ctx: x };
  })();
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, imgW, imgH);
  ctx.fillStyle = "#ffffff";
  applyRotatedRectFill(ctx, rect, imgW, imgH, "#ffffff");
  return canvas;
}

export function zoneBoxToCoverZoneRect(
  imgW: number,
  imgH: number,
  box: ZoneBox
): CoverZoneRect {
  return clampCoverZoneRect({
    xPercent: box.x0 / imgW,
    yPercent: box.y0 / imgH,
    widthPercent: (box.x1 - box.x0) / imgW,
    heightPercent: (box.y1 - box.y0) / imgH,
    rotationDeg: 0,
  });
}

export function getDefaultCoverZoneRect(
  zone: Exclude<WatermarkZone, "auto" | "custom">,
  coverSize: CoverSize
): CoverZoneRect {
  const size = clampCoverSize(coverSize);
  const margin = 0.02;
  switch (zone) {
    case "top-left":
      return clampCoverZoneRect({
        xPercent: margin,
        yPercent: margin,
        widthPercent: size.widthPercent,
        heightPercent: size.heightPercent,
        rotationDeg: 0,
      });
    case "bottom-right":
      return clampCoverZoneRect({
        xPercent: 1 - size.widthPercent - margin,
        yPercent: 1 - size.heightPercent - margin,
        widthPercent: size.widthPercent,
        heightPercent: size.heightPercent,
        rotationDeg: 0,
      });
    case "center":
      return clampCoverZoneRect({
        xPercent: (1 - size.widthPercent) / 2,
        yPercent: (1 - size.heightPercent) / 2,
        widthPercent: size.widthPercent,
        heightPercent: size.heightPercent,
        rotationDeg: 0,
      });
  }
}

/** メルカリ等の斜め水印向け预设（大斜带） */
export function getDiagonalWatermarkPreset(): CoverZoneRect {
  return clampCoverZoneRect({
    xPercent: 0.02,
    yPercent: 0.48,
    widthPercent: 0.88,
    heightPercent: 0.3,
    rotationDeg: -32,
  });
}
