import type { Locale } from "@/lib/i18n";
import {
  DEFAULT_SHOP_WATERMARK,
  type ShopWatermarkSettings,
  type CoverBlendMode,
  type WatermarkRemovalMode,
} from "@/types";
import {
  clampExportSize,
  DEFAULT_CUSTOM_EXPORT_SIZE,
  type ExportSize,
  type ExportSizeMode,
} from "@/lib/platformExport";
import {
  clampCoverZoneRect,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import {
  clampCoverSize,
  DEFAULT_COVER_SIZE,
  type CoverSize,
  type WatermarkZone,
} from "@/lib/watermarkZones";

const STORAGE_KEY = "kiricut-preferences";

export type UserPreferences = {
  locale: Locale;
  lastPlatformId: string | null;
  lastWatermarkZone: WatermarkZone | null;
  coverColor: string;
  coverSize: CoverSize;
  coverSizeByPlatform: Record<string, CoverSize>;
  coverColorByPlatform: Record<string, string>;
  exportSizeMode: ExportSizeMode;
  customExportSize: ExportSize;
  coverColorAutoLearn: boolean;
  customCoverRectByPlatform: Record<string, CoverZoneRect>;
  shopWatermark: ShopWatermarkSettings;
  watermarkRemovalMode: WatermarkRemovalMode;
  coverBlendMode: CoverBlendMode;
};

const DEFAULT: UserPreferences = {
  locale: "zh",
  lastPlatformId: null,
  lastWatermarkZone: null,
  coverColor: "#ffffff",
  coverSize: DEFAULT_COVER_SIZE,
  coverSizeByPlatform: {},
  coverColorByPlatform: {},
  exportSizeMode: "original",
  customExportSize: DEFAULT_CUSTOM_EXPORT_SIZE,
  coverColorAutoLearn: true,
  customCoverRectByPlatform: {},
  shopWatermark: DEFAULT_SHOP_WATERMARK,
  watermarkRemovalMode: "ai",
  coverBlendMode: "feather-ai",
};

function parseShopWatermark(raw: unknown): ShopWatermarkSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SHOP_WATERMARK;
  const o = raw as Partial<ShopWatermarkSettings>;
  const brandingMode =
    o.brandingMode === "logo" || o.brandingMode === "both"
      ? o.brandingMode
      : "text";
  return {
    enabled: !!o.enabled,
    brandingMode,
    shopName: typeof o.shopName === "string" ? o.shopName : "",
    includeDate: o.includeDate !== false,
    position:
      o.position === "bottom-right" ||
      o.position === "top-left" ||
      o.position === "top-right"
        ? o.position
        : "bottom-left",
    color: typeof o.color === "string" ? o.color : "#ffffff",
    fontSizePercent:
      typeof o.fontSizePercent === "number" ? o.fontSizePercent : 0.032,
    opacity: typeof o.opacity === "number" ? o.opacity : 0.95,
    logoDataUrl:
      typeof o.logoDataUrl === "string" && o.logoDataUrl.startsWith("data:")
        ? o.logoDataUrl
        : null,
    logoScalePercent:
      typeof o.logoScalePercent === "number"
        ? Math.min(1, Math.max(0.3, o.logoScalePercent))
        : 0.85,
  };
}

function parseCoverSize(raw: unknown): CoverSize {
  if (!raw || typeof raw !== "object") return DEFAULT_COVER_SIZE;
  const obj = raw as Partial<CoverSize>;
  if (
    typeof obj.widthPercent !== "number" ||
    typeof obj.heightPercent !== "number"
  ) {
    return DEFAULT_COVER_SIZE;
  }
  return clampCoverSize({
    widthPercent: obj.widthPercent,
    heightPercent: obj.heightPercent,
  });
}

function parseCoverSizeByPlatform(
  raw: unknown
): Record<string, CoverSize> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, CoverSize> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = parseCoverSize(value);
  }
  return result;
}

function parseCoverZoneRect(raw: unknown): CoverZoneRect | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<CoverZoneRect>;
  if (
    typeof obj.xPercent !== "number" ||
    typeof obj.yPercent !== "number" ||
    typeof obj.widthPercent !== "number" ||
    typeof obj.heightPercent !== "number"
  ) {
    return null;
  }
  return clampCoverZoneRect({
    xPercent: obj.xPercent,
    yPercent: obj.yPercent,
    widthPercent: obj.widthPercent,
    heightPercent: obj.heightPercent,
    rotationDeg:
      typeof obj.rotationDeg === "number" ? obj.rotationDeg : undefined,
  });
}

function parseCustomCoverRectByPlatform(
  raw: unknown
): Record<string, CoverZoneRect> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, CoverZoneRect> = {};
  for (const [key, value] of Object.entries(raw)) {
    const rect = parseCoverZoneRect(value);
    if (rect) result[key] = rect;
  }
  return result;
}

function parseExportSize(raw: unknown): ExportSize {
  if (!raw || typeof raw !== "object") return DEFAULT_CUSTOM_EXPORT_SIZE;
  const obj = raw as Partial<ExportSize>;
  if (typeof obj.width !== "number" || typeof obj.height !== "number") {
    return DEFAULT_CUSTOM_EXPORT_SIZE;
  }
  return clampExportSize({ width: obj.width, height: obj.height });
}

function parseCoverColorByPlatform(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.startsWith("#")) {
      result[key] = value;
    }
  }
  return result;
}

export function getCoverSizeForPlatform(
  prefs: UserPreferences,
  platformId: string | null
): CoverSize {
  if (platformId && prefs.coverSizeByPlatform[platformId]) {
    return prefs.coverSizeByPlatform[platformId];
  }
  return prefs.coverSize;
}

export function getCoverColorForPlatform(
  prefs: UserPreferences,
  platformId: string | null,
  fallback = "#ffffff"
): string {
  if (platformId && prefs.coverColorByPlatform[platformId]) {
    return prefs.coverColorByPlatform[platformId];
  }
  return fallback;
}

export function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      locale:
        parsed.locale === "ja"
          ? "ja"
          : parsed.locale === "en"
            ? "en"
            : "zh",
      lastPlatformId: parsed.lastPlatformId ?? null,
      lastWatermarkZone: parsed.lastWatermarkZone ?? null,
      coverColor:
        typeof parsed.coverColor === "string" ? parsed.coverColor : "#ffffff",
      coverSize: parseCoverSize(parsed.coverSize),
      coverSizeByPlatform: parseCoverSizeByPlatform(
        parsed.coverSizeByPlatform
      ),
      coverColorByPlatform: parseCoverColorByPlatform(
        parsed.coverColorByPlatform
      ),
      exportSizeMode:
        parsed.exportSizeMode === "platform" ||
        parsed.exportSizeMode === "custom"
          ? parsed.exportSizeMode
          : "original",
      customExportSize: parseExportSize(parsed.customExportSize),
      coverColorAutoLearn: parsed.coverColorAutoLearn !== false,
      customCoverRectByPlatform: parseCustomCoverRectByPlatform(
        parsed.customCoverRectByPlatform
      ),
      shopWatermark: parseShopWatermark(parsed.shopWatermark),
      watermarkRemovalMode:
        parsed.watermarkRemovalMode === "cover" ? "cover" : "ai",
      coverBlendMode:
        parsed.coverBlendMode === "flat" ||
        parsed.coverBlendMode === "feather" ||
        parsed.coverBlendMode === "feather-ai"
          ? parsed.coverBlendMode
          : "feather-ai",
    };
  } catch {
    return DEFAULT;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  const current = loadPreferences();
  const next = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function saveCoverSizeForPlatform(
  platformId: string,
  size: CoverSize
): void {
  const current = loadPreferences();
  const next = clampCoverSize(size);
  savePreferences({
    coverSize: next,
    coverSizeByPlatform: {
      ...current.coverSizeByPlatform,
      [platformId]: next,
    },
  });
}

export function saveCoverColorForPlatform(
  platformId: string,
  color: string
): void {
  const current = loadPreferences();
  savePreferences({
    coverColor: color,
    coverColorByPlatform: {
      ...current.coverColorByPlatform,
      [platformId]: color,
    },
  });
}

export function getCustomCoverRectForPlatform(
  prefs: UserPreferences,
  platformId: string | null
): CoverZoneRect | null {
  if (!platformId) return null;
  return prefs.customCoverRectByPlatform[platformId] ?? null;
}

export function saveCustomCoverRectForPlatform(
  platformId: string,
  rect: CoverZoneRect
): void {
  const current = loadPreferences();
  const next = clampCoverZoneRect(rect);
  savePreferences({
    customCoverRectByPlatform: {
      ...current.customCoverRectByPlatform,
      [platformId]: next,
    },
  });
}
