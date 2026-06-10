import {
  AiServiceUnavailableError,
  checkAiServiceHealth,
  fetchAiApi,
  parseAiImageResponse,
  startEstimatedProgress,
} from "./aiService";
import {
  compositeWithSoftMask,
  computeInpaintFeatherPx,
  createBottomRightWatermarkMask,
  createCanvas,
  limitCanvasLongEdge,
  loadImage,
  resizeCanvas,
} from "./canvasUtils";

/** 模型下载镜像（Python 服务 / npm setup-models 使用） */
export const LAMA_MODEL_URL =
  "https://hf-mirror.com/lxfater/inpaint-web/resolve/main/models/big-lama.onnx";

export const LAMA_MODEL_LOCAL = "/models/big-lama.onnx";

let serverReady = false;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas 转 Blob 失败")),
      type,
      quality
    );
  });
}

function prepareInpaintPayload(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): { image: HTMLCanvasElement; mask: HTMLCanvasElement } {
  const image = limitCanvasLongEdge(imageCanvas, 2048);
  if (image === imageCanvas) return { image, mask: maskCanvas };
  const scaleX = image.width / imageCanvas.width;
  const scaleY = image.height / imageCanvas.height;
  const mask = resizeCanvas(
    maskCanvas,
    Math.max(1, Math.round(maskCanvas.width * scaleX)),
    Math.max(1, Math.round(maskCanvas.height * scaleY))
  );
  return { image, mask };
}

async function inpaintViaServer(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  onProgress?: (percent: number) => void
): Promise<HTMLCanvasElement> {
  const { image: uploadImage, mask: uploadMask } = prepareInpaintPayload(
    imageCanvas,
    maskCanvas
  );
  const formData = new FormData();
  formData.append("image", await canvasToBlob(uploadImage), "image.jpg");
  formData.append("mask", await canvasToBlob(uploadMask, "image/png"), "mask.png");

  onProgress?.(35);
  const stopProgress = startEstimatedProgress(onProgress, 38, 90, 14000);

  try {
    const response = await fetchAiApi("/api/inpaint", {
      method: "POST",
      body: formData,
    });

    onProgress?.(93);
    const overlayDataUrl = await parseAiImageResponse(response);
    const overlayImg = await loadImage(overlayDataUrl);
    const { canvas: overlayCanvas } = createCanvas(
      imageCanvas.width,
      imageCanvas.height
    );
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) throw new Error("Canvas context を取得できません");
    overlayCtx.drawImage(
      overlayImg,
      0,
      0,
      imageCanvas.width,
      imageCanvas.height
    );
    return overlayCanvas;
  } finally {
    stopProgress();
  }
}

export function isLamaModelReady(): boolean {
  return serverReady;
}

/** 检查 VPS Python 推理服务是否可用 */
export async function preloadLamaModel(
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

export async function downloadLamaModel(
  onProgress?: (percent: number) => void
): Promise<void> {
  await preloadLamaModel(onProgress);
}

export async function inpaintWithLama(
  imageDataUrl: string,
  maskCanvas: HTMLCanvasElement,
  onModelProgress?: (percent: number) => void,
  options?: { featherPx?: number }
): Promise<string> {
  onModelProgress?.(8);
  await preloadLamaModel(onModelProgress);

  const image = await loadImage(imageDataUrl);
  const { canvas: imageCanvas } = createCanvas(
    image.naturalWidth,
    image.naturalHeight
  );
  const ctx = imageCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context を取得できません");
  ctx.drawImage(image, 0, 0);

  const featherPx =
    options?.featherPx ??
    computeInpaintFeatherPx(imageCanvas.width, imageCanvas.height);

  onModelProgress?.(25);
  const overlayCanvas = await inpaintViaServer(
    imageCanvas,
    maskCanvas,
    onModelProgress
  );
  onModelProgress?.(96);

  let finalCanvas: HTMLCanvasElement;
  try {
    finalCanvas = compositeWithSoftMask(
      imageCanvas,
      overlayCanvas,
      maskCanvas,
      featherPx
    );
  } catch (compositeError) {
    console.warn("compositeWithSoftMask failed, using overlay:", compositeError);
    const { canvas, ctx } = createCanvas(imageCanvas.width, imageCanvas.height);
    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);
    finalCanvas = canvas;
  }

  onModelProgress?.(100);
  return finalCanvas.toDataURL("image/png");
}

/** 右下角水印をワンクリックで自動除去 */
export async function inpaintBottomRightWatermark(
  imageDataUrl: string,
  onModelProgress?: (percent: number) => void
): Promise<string> {
  const image = await loadImage(imageDataUrl);
  const maskCanvas = createBottomRightWatermarkMask(
    image.naturalWidth,
    image.naturalHeight
  );
  return inpaintWithLama(imageDataUrl, maskCanvas, onModelProgress);
}
