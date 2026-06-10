import { detectCoverColorNearZone } from "@/lib/coverColorDetect";
import type { CoverZoneRect } from "@/lib/coverZoneRect";
import type { CoverSize, WatermarkZone } from "@/lib/watermarkZones";

const STORAGE_KEY = "kiricut-cover-color-learning";
const MAX_SAMPLES = 500;
const CORRECTION_WEIGHT = 8;

type LearnSample = {
  color: string;
  ts: number;
  correction?: boolean;
};

type PlatformLearnData = {
  samples: LearnSample[];
  totalProcessed: number;
};

type LearnStore = Record<string, PlatformLearnData>;

function loadStore(): LearnStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LearnStore;
  } catch {
    return {};
  }
}

function saveStore(store: LearnStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeHex(color: string): string {
  const c = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  return "#ffffff";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
}

function minSamplesToTrust(data: PlatformLearnData | undefined): number {
  if (!data) return 3;
  const hasCorrection = data.samples.some((s) => s.correction);
  return hasCorrection ? 2 : 3;
}

function getLearnedMedian(platformId: string | null): string | null {
  if (!platformId) return null;
  const data = loadStore()[platformId];
  if (!data || data.samples.length < minSamplesToTrust(data)) return null;

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const s of data.samples) {
    const [r, g, b] = hexToRgb(s.color);
    rs.push(r);
    gs.push(g);
    bs.push(b);
  }
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return rgbToHex(median(rs), median(gs), median(bs));
}

/** 样本越多、校正越多，越信任历史底色 */
function getLearningWeight(platformId: string | null): number {
  if (!platformId) return 0;
  const data = loadStore()[platformId];
  if (!data || data.samples.length < minSamplesToTrust(data)) return 0;

  const correctionCount = data.samples.filter((s) => s.correction).length;
  const volume = Math.min(0.52, data.samples.length / 90);
  const correctionBoost = Math.min(0.18, correctionCount / 25);
  return Math.min(0.68, volume + correctionBoost);
}

/** 记录一次取色结果；用户手动选色时权重更高 */
export function recordCoverColorLearning(
  platformId: string | null,
  color: string,
  isUserCorrection = false
): void {
  if (!platformId) return;
  const store = loadStore();
  const normalized = normalizeHex(color);
  const entry: LearnSample = {
    color: normalized,
    ts: Date.now(),
    correction: isUserCorrection || undefined,
  };

  const current = store[platformId] ?? { samples: [], totalProcessed: 0 };
  const repeat = isUserCorrection ? CORRECTION_WEIGHT : 1;
  for (let i = 0; i < repeat; i++) {
    current.samples.push(entry);
  }
  current.totalProcessed += 1;

  if (current.samples.length > MAX_SAMPLES) {
    current.samples = current.samples.slice(-MAX_SAMPLES);
  }

  store[platformId] = current;
  saveStore(store);
}

/** 图像检测色 + 本地历史学习融合 */
export function blendDetectedWithLearning(
  detectedColor: string,
  platformId: string | null
): string {
  const learned = getLearnedMedian(platformId);
  if (!learned) return normalizeHex(detectedColor);

  const detected = normalizeHex(detectedColor);
  const dist = colorDistance(detected, learned);
  const data = platformId ? loadStore()[platformId] : undefined;
  const weight = getLearningWeight(platformId);

  if (dist < 12) return detected;
  if (weight > 0.4 && dist > 36 && (data?.samples.length ?? 0) >= 6) {
    return learned;
  }

  const [dr, dg, db] = hexToRgb(detected);
  const [lr, lg, lb] = hexToRgb(learned);
  return rgbToHex(
    dr * (1 - weight) + lr * weight,
    dg * (1 - weight) + lg * weight,
    db * (1 - weight) + lb * weight
  );
}

export function getCoverColorLearningStats(platformId: string | null): {
  totalProcessed: number;
  sampleCount: number;
  learnedColor: string | null;
  confidence: "low" | "medium" | "high";
} {
  if (!platformId) {
    return {
      totalProcessed: 0,
      sampleCount: 0,
      learnedColor: null,
      confidence: "low",
    };
  }
  const data = loadStore()[platformId];
  if (!data) {
    return {
      totalProcessed: 0,
      sampleCount: 0,
      learnedColor: null,
      confidence: "low",
    };
  }

  const weight = getLearningWeight(platformId);
  const confidence: "low" | "medium" | "high" =
    weight >= 0.45 ? "high" : weight >= 0.2 ? "medium" : "low";

  return {
    totalProcessed: data.totalProcessed,
    sampleCount: data.samples.length,
    learnedColor: getLearnedMedian(platformId),
    confidence,
  };
}

export async function resolveCoverColorForImage(
  imageDataUrl: string,
  zone: WatermarkZone,
  coverSize: CoverSize,
  platformId: string | null,
  manualFallback: string,
  customRect?: CoverZoneRect | null
): Promise<string> {
  try {
    const detected = await detectCoverColorNearZone(
      imageDataUrl,
      zone,
      coverSize,
      customRect
    );
    return blendDetectedWithLearning(detected, platformId);
  } catch {
    const learned = getLearnedMedian(platformId);
    return learned ?? manualFallback;
  }
}
