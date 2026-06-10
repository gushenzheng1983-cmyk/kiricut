export type { WatermarkZone } from "@/lib/watermarkZones";

export type BatchItemStatus = "pending" | "processing" | "done" | "error";

export interface BatchImageItem {
  id: string;
  fileName: string;
  originalDataUrl: string;
  /** 去水印后的图（不被去背景步骤覆盖） */
  processedDataUrl: string | null;
  /** 去背景后的透明前景（换背景时叠在此层上） */
  bgRemovedDataUrl: string | null;
  status: BatchItemStatus;
  error?: string;
}

export type BackgroundType = "transparent" | "solid" | "gradient" | "custom";

export type ProcessingStatus =
  | "idle"
  | "preloading-models"
  | "loading-model"
  | "removing-background"
  | "inpainting"
  | "downloading-model";

export interface BackgroundSettings {
  type: BackgroundType;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  customColor: string;
}

export interface ImageState {
  width: number;
  height: number;
  dataUrl: string;
  hasAlpha: boolean;
}

export type ShopWatermarkPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

export type WatermarkRemovalMode = "cover" | "ai";

/** cover=羽化覆盖 · ai=全幅修图 */
export type CoverBlendMode = "flat" | "feather" | "feather-ai";

export type ShopBrandingMode = "text" | "logo" | "both";

export interface ShopWatermarkSettings {
  enabled: boolean;
  brandingMode: ShopBrandingMode;
  shopName: string;
  includeDate: boolean;
  position: ShopWatermarkPosition;
  color: string;
  fontSizePercent: number;
  opacity: number;
  /** PNG/JPG data URL，仅存本机 */
  logoDataUrl: string | null;
  /** LOGO 占红框区域的比例 0.3～1 */
  logoScalePercent: number;
}

export const DEFAULT_SHOP_WATERMARK: ShopWatermarkSettings = {
  enabled: false,
  brandingMode: "text",
  shopName: "",
  includeDate: true,
  position: "bottom-right",
  color: "#ffffff",
  fontSizePercent: 0.032,
  opacity: 0.95,
  logoDataUrl: null,
  logoScalePercent: 0.85,
};
