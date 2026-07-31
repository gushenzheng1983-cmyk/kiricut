import { isPro } from "./license";
import { PRICING } from "./pricing";

const STORAGE_KEY = "kiricut-usage-quota";

type QuotaState = {
  date: string; // YYYY-MM-DD local
  count: number;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readState(): QuotaState {
  if (typeof window === "undefined") return { date: todayKey(), count: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as QuotaState;
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 };
    return { date: parsed.date, count: Number(parsed.count) || 0 };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeState(state: QuotaState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getDailyUsed(): number {
  return readState().count;
}

export function getDailyLimit(): number | null {
  if (isPro()) return null;
  return PRICING.freeDailyQuota;
}

export function getRemainingToday(): number | null {
  const limit = getDailyLimit();
  if (limit === null) return null;
  return Math.max(0, limit - getDailyUsed());
}

export function getMaxBatchSize(): number {
  return isPro() ? PRICING.proMaxBatch : PRICING.freeMaxBatch;
}

export type QuotaCheck =
  | { ok: true }
  | { ok: false; reason: "daily_quota" | "batch_limit"; used: number; limit: number; requested: number };

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

  const used = getDailyUsed();
  const limit = PRICING.freeDailyQuota;
  if (used + requested > limit) {
    return {
      ok: false,
      reason: "daily_quota",
      used,
      limit,
      requested,
    };
  }
  return { ok: true };
}

export function recordUsage(count: number): void {
  if (count <= 0) return;
  if (isPro()) return;
  const state = readState();
  writeState({ date: todayKey(), count: state.count + count });
}
