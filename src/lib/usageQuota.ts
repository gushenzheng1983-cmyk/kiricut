import { isPro } from "./license";
import { PRICING } from "./pricing";

/** 免费体验导出是否已用（终身/本浏览器，不按日重置） */
const FREE_EXPORT_KEY = "kiricut-free-export-used";

function readFreeExportUsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FREE_EXPORT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFreeExportUsed(): void {
  try {
    localStorage.setItem(FREE_EXPORT_KEY, "1");
  } catch {
    /* private mode 等：尽力写入；读不到时会再挡一次 */
  }
}

/** 是否仍有免费导出额度（Pro 视为无限） */
export function hasFreeExportLeft(): boolean {
  if (isPro()) return true;
  return !readFreeExportUsed();
}

/** 免费导出是否已消耗（非 Pro） */
export function hasUsedFreeExport(): boolean {
  if (isPro()) return false;
  return readFreeExportUsed();
}

/**
 * 成功导出后调用：消耗唯一的免费体验导出。
 * Pro 不计数。
 */
export function consumeFreeExport(): void {
  if (isPro()) return;
  writeFreeExportUsed();
}

/** 剩余免费导出张数；Pro 返回 null（不限） */
export function getFreeExportsRemaining(): number | null {
  if (isPro()) return null;
  return hasFreeExportLeft() ? PRICING.freeLifetimeExports : 0;
}

/** 已用免费导出张数（0 或 1）；Pro 返回 0 */
export function getFreeExportsUsed(): number {
  if (isPro()) return 0;
  return hasUsedFreeExport() ? PRICING.freeLifetimeExports : 0;
}

export function getMaxBatchSize(): number {
  return isPro() ? PRICING.proMaxBatch : PRICING.freeMaxBatch;
}

export type QuotaCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "free_export_used" | "batch_limit";
      used: number;
      limit: number;
      requested: number;
    };

/** 处理前检查：requested = 本次将处理的张数 */
export function canProcess(requested: number): QuotaCheck {
  if (requested <= 0) return { ok: true };

  const maxBatch = getMaxBatchSize();
  if (requested > maxBatch) {
    return {
      ok: false,
      reason: "batch_limit",
      used: 0,
      limit: maxBatch,
      requested,
    };
  }

  if (isPro()) return { ok: true };

  if (!hasFreeExportLeft()) {
    return {
      ok: false,
      reason: "free_export_used",
      used: PRICING.freeLifetimeExports,
      limit: PRICING.freeLifetimeExports,
      requested,
    };
  }
  return { ok: true };
}

/** 导出前检查：免费体验已用完则拦截 */
export function canExport(): QuotaCheck {
  if (isPro()) return { ok: true };
  if (!hasFreeExportLeft()) {
    return {
      ok: false,
      reason: "free_export_used",
      used: PRICING.freeLifetimeExports,
      limit: PRICING.freeLifetimeExports,
      requested: 1,
    };
  }
  return { ok: true };
}
