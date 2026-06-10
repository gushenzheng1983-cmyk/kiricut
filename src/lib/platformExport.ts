import { createCanvas, loadImage } from "@/lib/canvasUtils";

export type ExportSizeMode = "platform" | "custom" | "original";

export type ExportSize = {
  width: number;
  height: number;
};

export type PlatformExportSpec = ExportSize & {
  /** 平台规范说明（i18n key 后缀，如 shopify → platformExportShopify） */
  noteKey: string;
  backgroundColor: string;
};

/** 日本电商平台上架常用导出尺寸（白底正方形） */
export const PLATFORM_EXPORT_SPECS: Record<string, PlatformExportSpec> = {
  shopify: {
    width: 2000,
    height: 2000,
    noteKey: "shopify",
    backgroundColor: "#ffffff",
  },
  rakuten: {
    width: 800,
    height: 800,
    noteKey: "rakuten",
    backgroundColor: "#ffffff",
  },
  amazon: {
    width: 1000,
    height: 1000,
    noteKey: "amazon",
    backgroundColor: "#ffffff",
  },
  yahoo: {
    width: 500,
    height: 500,
    noteKey: "yahoo",
    backgroundColor: "#ffffff",
  },
};

export const EXPORT_SIZE_QUICK_PRESETS: ExportSize[] = [
  { width: 500, height: 500 },
  { width: 800, height: 800 },
  { width: 1000, height: 1000 },
  { width: 2000, height: 2000 },
];

export const DEFAULT_CUSTOM_EXPORT_SIZE: ExportSize = {
  width: 1000,
  height: 1000,
};

const MIN_EXPORT = 100;
const MAX_EXPORT = 4096;

export function clampExportSize(size: ExportSize): ExportSize {
  return {
    width: Math.min(MAX_EXPORT, Math.max(MIN_EXPORT, Math.round(size.width))),
    height: Math.min(MAX_EXPORT, Math.max(MIN_EXPORT, Math.round(size.height))),
  };
}

export function getPlatformExportSpec(
  platformId: string | null
): PlatformExportSpec | null {
  if (!platformId) return null;
  return PLATFORM_EXPORT_SPECS[platformId] ?? null;
}

export function resolveExportSize(
  mode: ExportSizeMode,
  platformId: string | null,
  customSize: ExportSize
): ExportSize | null {
  if (mode === "original") return null;
  if (mode === "platform") {
    const spec = getPlatformExportSpec(platformId);
    if (spec) return { width: spec.width, height: spec.height };
  }
  return clampExportSize(customSize);
}

/** 白底画布居中缩放（contain）；永不放大，仅缩小或留白，保护画质 */
export async function exportImageToSize(
  imageDataUrl: string,
  target: ExportSize,
  backgroundColor = "#ffffff"
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const { width, height } = clampExportSize(target);
  const { canvas, ctx } = createCanvas(width, height);

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(
    width / img.naturalWidth,
    height / img.naturalHeight,
    1
  );
  const drawW = Math.round(img.naturalWidth * scale);
  const drawH = Math.round(img.naturalHeight * scale);
  const x = Math.floor((width - drawW) / 2);
  const y = Math.floor((height - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, drawW, drawH);
  return canvas.toDataURL("image/png");
}

export async function prepareExportDataUrl(
  imageDataUrl: string,
  mode: ExportSizeMode,
  platformId: string | null,
  customSize: ExportSize
): Promise<string> {
  const target = resolveExportSize(mode, platformId, customSize);
  if (!target) return imageDataUrl;

  const spec = getPlatformExportSpec(platformId);
  const bg =
    mode === "platform" && spec
      ? spec.backgroundColor
      : "#ffffff";

  return exportImageToSize(imageDataUrl, target, bg);
}

export function formatExportSizeLabel(size: ExportSize): string {
  return `${size.width}×${size.height}`;
}
