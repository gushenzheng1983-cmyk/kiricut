import { checkAiServiceHealth } from "./aiService";

export type PreloadProgress = {
  label: string;
  percent: number;
};

/** 检查 VPS AI 服务（修图 + 抠图） */
export async function preloadAllModels(
  onProgress?: (progress: PreloadProgress) => void
): Promise<void> {
  onProgress?.({ label: "AI 服务", percent: 10 });
  const health = await checkAiServiceHealth();
  if (!health.ok) {
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }
  onProgress?.({ label: "準備完了", percent: 100 });
}

export function areModelsReady(): boolean {
  return true;
}
