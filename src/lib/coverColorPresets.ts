import type { Locale } from "@/lib/i18n";

/** 商品图常见背景色 — 覆盖水印时减少违和感 */
export const COVER_COLOR_PRESETS: {
  color: string;
  labelZh: string;
  labelJa: string;
  labelEn: string;
}[] = [
  { color: "#FFFFFF", labelZh: "纯白", labelJa: "白", labelEn: "Pure white" },
  { color: "#FAFAFA", labelZh: "浅白", labelJa: "薄白", labelEn: "Off-white" },
  { color: "#F5F5F5", labelZh: "灰白", labelJa: "灰白", labelEn: "Light gray" },
  { color: "#F8F8F8", labelZh: "亮白", labelJa: "亮白", labelEn: "Bright white" },
  { color: "#F0F0F0", labelZh: "淡灰", labelJa: "淡灰", labelEn: "Pale gray" },
  { color: "#EEEEEE", labelZh: "浅灰", labelJa: "浅灰", labelEn: "Soft gray" },
  { color: "#E8E8E8", labelZh: "银灰", labelJa: "銀灰", labelEn: "Silver gray" },
  { color: "#E5E5E5", labelZh: "中灰", labelJa: "中灰", labelEn: "Mid gray" },
  { color: "#FFFEF8", labelZh: "暖白", labelJa: "暖白", labelEn: "Warm white" },
  { color: "#FFF8F0", labelZh: "米白", labelJa: "米白", labelEn: "Cream" },
  { color: "#F5F5F0", labelZh: "象牙", labelJa: "象牙", labelEn: "Ivory" },
  { color: "#F8F6F4", labelZh: "杏白", labelJa: "杏白", labelEn: "Apricot white" },
  { color: "#FCFCFC", labelZh: "雪白", labelJa: "雪白", labelEn: "Snow white" },
  { color: "#EBEBEB", labelZh: "雾灰", labelJa: "霧灰", labelEn: "Mist gray" },
  { color: "#DDDDDD", labelZh: "深灰", labelJa: "深灰", labelEn: "Dark gray" },
  { color: "#D4D4D4", labelZh: "水泥灰", labelJa: "コンクリ", labelEn: "Concrete" },
];

export function getCoverColorPresetLabel(
  locale: Locale,
  preset: (typeof COVER_COLOR_PRESETS)[number]
): string {
  if (locale === "ja") return preset.labelJa;
  if (locale === "en") return preset.labelEn;
  return preset.labelZh;
}

export function isCoverColorPreset(color: string): boolean {
  const normalized = color.toUpperCase();
  return COVER_COLOR_PRESETS.some(
    (p) => p.color.toUpperCase() === normalized
  );
}
