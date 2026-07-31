/**
 * 轻量用量统计（不存图片、不存用户账号）
 * 文件：data/usage-stats.json（部署机本地）
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type UsageEvent =
  | "page_ping"
  | "inpaint_ok"
  | "inpaint_fail"
  | "bg_ok"
  | "bg_fail"
  | "activate_ok";

type DayBucket = {
  page_ping: number;
  inpaint_ok: number;
  inpaint_fail: number;
  bg_ok: number;
  bg_fail: number;
  activate_ok: number;
};

type UsageStore = {
  updatedAt: string;
  days: Record<string, DayBucket>;
};

const EMPTY_DAY = (): DayBucket => ({
  page_ping: 0,
  inpaint_ok: 0,
  inpaint_fail: 0,
  bg_ok: 0,
  bg_fail: 0,
  activate_ok: 0,
});

function dataPath(): string {
  return path.join(process.cwd(), "data", "usage-stats.json");
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function readStore(): Promise<UsageStore> {
  try {
    const raw = await readFile(dataPath(), "utf8");
    const parsed = JSON.parse(raw) as UsageStore;
    if (!parsed?.days || typeof parsed.days !== "object") {
      return { updatedAt: new Date().toISOString(), days: {} };
    }
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), days: {} };
  }
}

async function writeStore(store: UsageStore): Promise<void> {
  const dir = path.dirname(dataPath());
  await mkdir(dir, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await writeFile(dataPath(), JSON.stringify(store, null, 2), "utf8");
}

export async function recordUsageEvent(event: UsageEvent): Promise<void> {
  try {
    const store = await readStore();
    const key = todayKey();
    const day = store.days[key] ?? EMPTY_DAY();
    day[event] = (day[event] ?? 0) + 1;
    store.days[key] = day;
    await writeStore(store);
  } catch (error) {
    console.warn("usage stats write failed:", error);
  }
}

export async function getUsageStats(days = 30): Promise<{
  updatedAt: string;
  days: { date: string; counts: DayBucket }[];
  totals: DayBucket;
}> {
  const store = await readStore();
  const keys = Object.keys(store.days).sort().slice(-Math.max(1, days));
  const totals = EMPTY_DAY();
  const list = keys.map((date) => {
    const counts = { ...EMPTY_DAY(), ...store.days[date] };
    (Object.keys(totals) as (keyof DayBucket)[]).forEach((k) => {
      totals[k] += counts[k] ?? 0;
    });
    return { date, counts };
  });
  return { updatedAt: store.updatedAt, days: list, totals };
}
