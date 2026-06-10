import type { CoverZoneRect } from "@/lib/coverZoneRect";
import { createCanvas, loadImage } from "@/lib/canvasUtils";
import {
  getAllSearchBoxes,
  getZoneSearchBoxes,
  type CoverSize,
  type WatermarkZone,
  type ZoneBox,
} from "@/lib/watermarkZones";
import type { ShopBrandingMode, ShopWatermarkSettings } from "@/types";

export type ShopBrandingPlacement = {
  zone: WatermarkZone;
  coverSize: CoverSize;
  customRect: CoverZoneRect | null;
};

function formatDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildShopWatermarkText(settings: ShopWatermarkSettings): string {
  const parts = [settings.shopName.trim()].filter(Boolean);
  if (settings.includeDate) {
    parts.push(formatDate());
  }
  return parts.join(" · ");
}

export function hasShopTextBranding(settings: ShopWatermarkSettings): boolean {
  if (settings.brandingMode === "logo") return false;
  return buildShopWatermarkText(settings).length > 0;
}

export function hasShopLogoBranding(settings: ShopWatermarkSettings): boolean {
  if (settings.brandingMode === "text") return false;
  return !!settings.logoDataUrl;
}

export function hasShopBrandingContent(settings: ShopWatermarkSettings): boolean {
  if (!settings.enabled) return false;
  return hasShopTextBranding(settings) || hasShopLogoBranding(settings);
}

function resolveLogoBox(
  width: number,
  height: number,
  placement: ShopBrandingPlacement
): ZoneBox | null {
  const { zone, coverSize, customRect } = placement;

  if (zone === "auto") {
    const all = getAllSearchBoxes(width, height, coverSize);
    const preferred =
      all.find((b) => b.id === "bottom-right") ??
      all.find((b) => b.id === "center") ??
      all[0];
    if (!preferred) return null;
    const { id: _id, ...box } = preferred;
    return box;
  }

  const boxes = getZoneSearchBoxes(
    width,
    height,
    zone,
    coverSize,
    customRect
  );
  return boxes[0] ?? null;
}

function drawLogoInBox(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  box: ZoneBox,
  scalePercent: number
): void {
  const boxW = box.x1 - box.x0;
  const boxH = box.y1 - box.y0;
  const scale = Math.min(1, Math.max(0.3, scalePercent));
  const maxW = boxW * scale;
  const maxH = boxH * scale;

  const logoRatio = logo.naturalWidth / logo.naturalHeight;
  let drawW: number;
  let drawH: number;

  if (maxW / maxH > logoRatio) {
    drawH = maxH;
    drawW = drawH * logoRatio;
  } else {
    drawW = maxW;
    drawH = drawW / logoRatio;
  }

  const x = box.x0 + (boxW - drawW) / 2;
  const y = box.y0 + (boxH - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(logo, x, y, drawW, drawH);
  ctx.restore();
}

function drawTextBranding(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  settings: ShopWatermarkSettings,
  text: string
): void {
  const fontSize = Math.max(
    12,
    Math.floor(img.naturalHeight * settings.fontSizePercent)
  );
  const padding = Math.floor(fontSize * 0.6);

  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = fontSize;
  const padX = padding * 0.75;
  const padY = padding * 0.45;

  let x = padding;
  let y = img.naturalHeight - padding;
  let textBaseline: CanvasTextBaseline = "bottom";

  switch (settings.position) {
    case "bottom-right":
      x = img.naturalWidth - textW - padding;
      y = img.naturalHeight - padding;
      break;
    case "top-left":
      textBaseline = "top";
      x = padding;
      y = padding;
      break;
    case "top-right":
      textBaseline = "top";
      x = img.naturalWidth - textW - padding;
      y = padding;
      break;
    case "bottom-left":
    default:
      x = padding;
      y = img.naturalHeight - padding;
      break;
  }

  ctx.textBaseline = textBaseline;

  const bgX = x - padX;
  const bgY = textBaseline === "top" ? y - padY : y - textH - padY;
  const bgW = textW + padX * 2;
  const bgH = textH + padY * 2;

  ctx.save();
  ctx.globalAlpha = Math.min(0.72, settings.opacity * 0.85);
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  roundRect(ctx, bgX, bgY, bgW, bgH, Math.min(8, fontSize * 0.25));
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = settings.color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = Math.max(3, fontSize * 0.2);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, fontSize * 0.06);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 叠加店铺文字 / LOGO（LOGO 贴在去水印红框区域内） */
export async function applyShopBranding(
  imageDataUrl: string,
  settings: ShopWatermarkSettings,
  placement: ShopBrandingPlacement
): Promise<string> {
  if (!hasShopBrandingContent(settings)) return imageDataUrl;

  const img = await loadImage(imageDataUrl);
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);

  const mode: ShopBrandingMode = settings.brandingMode;

  if (mode === "logo" || mode === "both") {
    if (settings.logoDataUrl) {
      const box = resolveLogoBox(
        img.naturalWidth,
        img.naturalHeight,
        placement
      );
      if (box) {
        const logo = await loadImage(settings.logoDataUrl);
        drawLogoInBox(ctx, logo, box, settings.logoScalePercent);
      }
    }
  }

  if (mode === "text" || mode === "both") {
    const text = buildShopWatermarkText(settings);
    if (text) {
      drawTextBranding(ctx, img, settings, text);
    }
  }

  return canvas.toDataURL("image/png");
}

/** @deprecated 使用 applyShopBranding 并传入 placement */
export async function applyShopWatermark(
  imageDataUrl: string,
  settings: ShopWatermarkSettings,
  placement: ShopBrandingPlacement
): Promise<string> {
  return applyShopBranding(imageDataUrl, settings, placement);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
