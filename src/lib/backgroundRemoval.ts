import {
  AiServiceUnavailableError,
  checkAiServiceHealth,
  fetchAiApi,
  parseAiImageResponse,
  startEstimatedProgress,
} from "./aiService";

let serverReady = false;

export async function preloadBackgroundModel(
  onProgress?: (percent: number) => void
): Promise<void> {
  onProgress?.(20);
  const health = await checkAiServiceHealth();
  if (!health.ok) {
    throw new AiServiceUnavailableError();
  }
  onProgress?.(100);
  serverReady = true;
}

export function isBackgroundModelReady(): boolean {
  return serverReady;
}

async function imageSourceToBlob(
  imageSource: string | Blob | HTMLImageElement
): Promise<Blob> {
  if (imageSource instanceof Blob) return imageSource;
  if (typeof imageSource === "string") {
    return fetch(imageSource).then((res) => res.blob());
  }
  const canvas = document.createElement("canvas");
  canvas.width = imageSource.naturalWidth;
  canvas.height = imageSource.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context を取得できません");
  ctx.drawImage(imageSource, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("画像の変換に失敗しました"));
    }, "image/png");
  });
}

export async function removeImageBackground(
  imageSource: string | Blob | HTMLImageElement,
  onProgress?: (percent: number) => void
): Promise<string> {
  await preloadBackgroundModel(onProgress);
  const blob = await imageSourceToBlob(imageSource);

  const formData = new FormData();
  formData.append("image", blob, "image.png");

  onProgress?.(15);
  const stopProgress = startEstimatedProgress(onProgress, 18, 92, 18000);

  try {
    const response = await fetchAiApi("/api/remove-background", {
      method: "POST",
      body: formData,
    });

    onProgress?.(98);
    const resultDataUrl = await parseAiImageResponse(response);
    onProgress?.(100);
    return resultDataUrl;
  } finally {
    stopProgress();
  }
}
