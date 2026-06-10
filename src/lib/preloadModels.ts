import { preloadBackgroundModel } from "./backgroundRemoval";

export type PreloadProgress = {
  label: string;
  percent: number;
};

/** 水印除去は云端APIのため、背景除去モデルのみプリロード */
export async function preloadAllModels(
  onProgress?: (progress: PreloadProgress) => void
): Promise<void> {
  onProgress?.({ label: "背景除去モデル", percent: 0 });
  await preloadBackgroundModel((percent) => {
    onProgress?.({ label: "背景除去モデル", percent });
  });
  onProgress?.({ label: "準備完了", percent: 100 });
}

export function areModelsReady(): boolean {
  return true;
}
