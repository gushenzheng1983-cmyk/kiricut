import {
  compositeWithSoftMask,
  computeInpaintFeatherPx,
  createBottomRightWatermarkMask,
  createCanvas,
  loadImage,
} from "./canvasUtils";

/** 模型下载镜像（Python 服务 / npm setup-models 使用） */
export const LAMA_MODEL_URL =
  "https://hf-mirror.com/lxfater/inpaint-web/resolve/main/models/big-lama.onnx";

export const LAMA_MODEL_LOCAL = "/models/big-lama.onnx";

let serverReady = false;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas 转 Blob 失败")),
      "image/png"
    );
  });
}

async function inpaintViaServer(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const formData = new FormData();
  formData.append("image", await canvasToBlob(imageCanvas), "image.png");
  formData.append("mask", await canvasToBlob(maskCanvas), "mask.png");

  const response = await fetch("/api/inpaint", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "服务端 AI 修图失败";
    try {
      const err = (await response.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* binary error body */
    }
    throw new Error(message);
  }

  const overlayBlob = await response.blob();
  const overlayUrl = URL.createObjectURL(overlayBlob);
  try {
    const overlayImg = await loadImage(overlayUrl);
    const { canvas: overlayCanvas } = createCanvas(
      imageCanvas.width,
      imageCanvas.height
    );
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) throw new Error("Canvas context を取得できません");
    overlayCtx.drawImage(overlayImg, 0, 0, imageCanvas.width, imageCanvas.height);
    return overlayCanvas;
  } finally {
    URL.revokeObjectURL(overlayUrl);
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
  const response = await fetch("/api/inpaint/health", { cache: "no-store" });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      data.error ?? "AI 推理服务未启动，请联系管理员"
    );
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
  onModelProgress?.(10);
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

  onModelProgress?.(30);
  const overlayCanvas = await inpaintViaServer(imageCanvas, maskCanvas);
  onModelProgress?.(95);

  const finalCanvas = compositeWithSoftMask(
    imageCanvas,
    overlayCanvas,
    maskCanvas,
    featherPx
  );

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
