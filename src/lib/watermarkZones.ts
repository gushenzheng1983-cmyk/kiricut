import type { CoverZoneRect } from "@/lib/coverZoneRect";
import {
  clampCoverZoneRect,
  coverZoneRectToBox,
  getDefaultCoverZoneRect,
} from "@/lib/coverZoneRect";

export type { CoverZoneRect } from "@/lib/coverZoneRect";

export type WatermarkZone =
  | "top-left"
  | "bottom-right"
  | "center"
  | "custom"
  | "auto";

export type ZoneBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type CoverSize = {
  widthPercent: number;
  heightPercent: number;
};

export const COVER_SIZE_PRESETS = {
  small: { widthPercent: 0.14, heightPercent: 0.1 },
  medium: { widthPercent: 0.22, heightPercent: 0.16 },
  large: { widthPercent: 0.32, heightPercent: 0.24 },
} as const satisfies Record<string, CoverSize>;

export const DEFAULT_COVER_SIZE: CoverSize = COVER_SIZE_PRESETS.small;

/** 服务端 AI 检测用较大区域，与前端用户覆盖尺寸无关 */
export const DETECT_COVER_SIZE: CoverSize = {
  widthPercent: 0.36,
  heightPercent: 0.28,
};

export type WatermarkPlatformPreset = {
  id: string;
  label: string;
  hint: string;
  zone: WatermarkZone;
};

export const WATERMARK_PLATFORM_PRESETS: WatermarkPlatformPreset[] = [
  { id: "shopify", label: "Shopify", hint: "中央", zone: "center" },
  { id: "rakuten", label: "楽天", hint: "中央", zone: "center" },
  { id: "amazon", label: "Amazon", hint: "中央", zone: "center" },
  { id: "yahoo", label: "Yahoo!", hint: "中央", zone: "center" },
  { id: "taobao", label: "淘宝", hint: "右下", zone: "bottom-right" },
  { id: "mercari", label: "メルカリ", hint: "斜角", zone: "custom" },
  { id: "rakuma", label: "ラクマ", hint: "左上", zone: "top-left" },
];

/** 白底商品图平台，首次选用时默认纯白覆盖 */
export const WHITE_BG_PLATFORM_IDS = new Set([
  "shopify",
  "rakuten",
  "amazon",
  "yahoo",
  "taobao",
]);

export const WATERMARK_ZONE_OPTIONS: {
  zone: WatermarkZone;
  label: string;
  description: string;
}[] = [
  { zone: "top-left", label: "左上", description: "左上角水印" },
  { zone: "bottom-right", label: "右下", description: "右下角水印" },
  { zone: "center", label: "中央", description: "图片中央水印" },
  { zone: "custom", label: "自定义", description: "鼠标拖动红框指定位置" },
  { zone: "auto", label: "AI自动", description: "自动扫描三个区域" },
];

export function clampCoverSize(size: CoverSize): CoverSize {
  return {
    widthPercent: Math.min(0.45, Math.max(0.06, size.widthPercent)),
    heightPercent: Math.min(0.35, Math.max(0.05, size.heightPercent)),
  };
}

export function isCoverSizePreset(
  size: CoverSize,
  preset: keyof typeof COVER_SIZE_PRESETS
): boolean {
  const target = COVER_SIZE_PRESETS[preset];
  return (
    Math.abs(size.widthPercent - target.widthPercent) < 0.005 &&
    Math.abs(size.heightPercent - target.heightPercent) < 0.005
  );
}

function buildZoneBox(
  width: number,
  height: number,
  zone: Exclude<WatermarkZone, "auto" | "custom">,
  coverSize: CoverSize
): ZoneBox {
  const marginX = Math.max(4, Math.floor(width * 0.02));
  const marginY = Math.max(4, Math.floor(height * 0.02));
  const boxW = Math.floor(width * coverSize.widthPercent);
  const boxH = Math.floor(height * coverSize.heightPercent);

  switch (zone) {
    case "top-left":
      return {
        x0: marginX,
        y0: marginY,
        x1: marginX + boxW,
        y1: marginY + boxH,
      };
    case "bottom-right":
      return {
        x0: width - boxW - marginX,
        y0: height - boxH - marginY,
        x1: width - marginX,
        y1: height - marginY,
      };
    case "center": {
      const centerX0 = Math.floor((width - boxW) / 2);
      const centerY0 = Math.floor((height - boxH) / 2);
      return {
        x0: centerX0,
        y0: centerY0,
        x1: centerX0 + boxW,
        y1: centerY0 + boxH,
      };
    }
  }
}

export function getZoneSearchBoxes(
  width: number,
  height: number,
  zone: WatermarkZone,
  coverSize: CoverSize = DEFAULT_COVER_SIZE,
  customRect?: CoverZoneRect | null
): ZoneBox[] {
  const size = clampCoverSize(coverSize);

  if (zone === "custom" && customRect) {
    return [coverZoneRectToBox(width, height, customRect)];
  }

  if (zone === "custom") {
    const fallback = getDefaultCoverZoneRect("center", size);
    return [coverZoneRectToBox(width, height, fallback)];
  }

  if (zone === "auto") {
    return [];
  }

  const all = getAllSearchBoxes(width, height, size);
  const match = all.find((b) => b.id === zone);
  return match ? [match] : all;
}

export function resolveCoverZoneRect(
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect: CoverZoneRect | null
): CoverZoneRect {
  if (customRect) {
    return clampCoverZoneRect(customRect);
  }
  if (zone === "top-left" || zone === "bottom-right" || zone === "center") {
    return getDefaultCoverZoneRect(zone, coverSize);
  }
  return getDefaultCoverZoneRect("center", coverSize);
}

export function getAllSearchBoxes(
  width: number,
  height: number,
  coverSize: CoverSize = DEFAULT_COVER_SIZE
): (ZoneBox & { id: WatermarkZone })[] {
  const size = clampCoverSize(coverSize);
  const zones: Exclude<WatermarkZone, "auto" | "custom">[] = [
    "top-left",
    "bottom-right",
    "center",
  ];

  return zones.map((zone) => ({
    id: zone,
    ...buildZoneBox(width, height, zone, size),
  }));
}

export function getZoneLabel(zone: WatermarkZone): string {
  return (
    WATERMARK_ZONE_OPTIONS.find((o) => o.zone === zone)?.label ?? zone
  );
}
