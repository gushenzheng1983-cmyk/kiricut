import {
  compositeWithSoftMask,
  computeInpaintFeatherPx,
  createBottomRightWatermarkMask,
  createCanvas,
  loadImage,
  resizeCanvas,
} from "./canvasUtils";
import { getCachedModel, LAMA_CACHE_KEY, setCachedModel } from "./modelCache";

export const LAMA_MODEL_URL =
  "https://huggingface.co/lxfater/inpaint-web/resolve/main/models/big-lama.onnx";

export const LAMA_MODEL_LOCAL = "/models/big-lama.onnx";

const MODEL_SIZE = 512;

interface OrtTensor {
  data: Float32Array | Uint8Array;
  dims?: number[];
}

interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}

interface OrtModule {
  InferenceSession: {
    create(
      buffer: ArrayBuffer,
      options?: { executionProviders?: string[] }
    ): Promise<OrtSession>;
  };
  Tensor: new (
    type: string,
    data: Float32Array | Uint8Array,
    dims: number[]
  ) => OrtTensor;
  env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
      simd: boolean;
      proxy?: boolean;
    };
  };
}

let ortModule: OrtModule | null = null;
let session: OrtSession | null = null;
let modelBuffer: ArrayBuffer | null = null;
let downloadPromise: Promise<void> | null = null;

async function getOrt(): Promise<OrtModule> {
  if (!ortModule) {
    ortModule = (await import("onnxruntime-web")) as OrtModule;
    try {
      const wasmProbe = await fetch("/ort/ort-wasm-simd-threaded.wasm", {
        method: "HEAD",
      });
      ortModule.env.wasm.wasmPaths = wasmProbe.ok
        ? "/ort/"
        : "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
    } catch {
      ortModule.env.wasm.wasmPaths =
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
    }
    ortModule.env.wasm.numThreads = Math.min(
      navigator.hardwareConcurrency ?? 4,
      4
    );
    ortModule.env.wasm.simd = true;
    ortModule.env.wasm.proxy = false;
  }
  return ortModule;
}

async function fetchWithProgress(
  url: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`モデル取得失敗 (${response.status}): ${url}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader();

  if (!reader) {
    onProgress?.(100);
    return response.arrayBuffer();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        onProgress?.(Math.round((received / contentLength) * 100));
      }
    }
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  onProgress?.(100);
  return buffer.buffer;
}

async function loadLamaModelBuffer(
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  if (modelBuffer) return modelBuffer;

  const cached = await getCachedModel(LAMA_CACHE_KEY);
  if (cached) {
    modelBuffer = cached;
    onProgress?.(100);
    return cached;
  }

  const sources = [
    LAMA_MODEL_LOCAL,
    LAMA_MODEL_URL,
    "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
    "https://hf-mirror.com/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
  ];
  let lastError: Error | null = null;

  for (const url of sources) {
    try {
      const buffer = await fetchWithProgress(url, onProgress);
      modelBuffer = buffer;
      await setCachedModel(LAMA_CACHE_KEY, buffer);
      return buffer;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("モデル読み込み失敗");
    }
  }

  throw lastError ?? new Error("LaMaモデルの読み込みに失敗しました");
}

export function isLamaModelReady(): boolean {
  return modelBuffer !== null && session !== null;
}

export async function preloadLamaModel(
  onProgress?: (percent: number) => void
): Promise<void> {
  if (session) return;

  if (!downloadPromise) {
    downloadPromise = (async () => {
      await getOrt();
      await loadLamaModelBuffer(onProgress);
      if (!modelBuffer) {
        throw new Error("LaMaモデルが読み込まれていません");
      }
      const ort = await getOrt();
      session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
      });
    })();
  }

  await downloadPromise;
}

export async function downloadLamaModel(
  onProgress?: (percent: number) => void
): Promise<void> {
  await preloadLamaModel(onProgress);
}

async function getSession(): Promise<OrtSession> {
  await preloadLamaModel();
  if (!session) {
    throw new Error("LaMaセッションの初期化に失敗しました");
  }
  return session;
}

function imageDataToChwUint8(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const size = width * height;
  const chw = new Uint8Array(3 * size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const pi = y * width + x;
      chw[pi] = data[i];
      chw[size + pi] = data[i + 1];
      chw[2 * size + pi] = data[i + 2];
    }
  }

  return chw;
}

/** 白=修復対象(255)、黒=保持(0) */
function maskDataToChwUint8(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      mask[y * width + x] = gray > 127 ? 255 : 0;
    }
  }

  return mask;
}

function imageDataToChwFloat32(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const size = width * height;
  const chw = new Float32Array(3 * size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const pi = y * width + x;
      chw[pi] = data[i] / 255;
      chw[size + pi] = data[i + 1] / 255;
      chw[2 * size + pi] = data[i + 2] / 255;
    }
  }

  return chw;
}

function maskDataToChwFloat32(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const mask = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      mask[y * width + x] = gray > 127 ? 1.0 : 0.0;
    }
  }

  return mask;
}

function chwToImageData(
  data: Float32Array | Uint8Array,
  width: number,
  height: number
): ImageData {
  const imageData = new ImageData(width, height);
  const size = width * height;
  const isFloat = data instanceof Float32Array;
  let maxVal = 255;
  if (isFloat) {
    for (let i = 0; i < Math.min(500, data.length); i++) {
      if (data[i] > maxVal) maxVal = data[i];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const di = pi * 4;

      const read = (idx: number) => {
        const v = data[idx];
        if (isFloat) {
          return maxVal <= 1.5
            ? Math.round(Math.min(255, Math.max(0, v * 255)))
            : Math.round(Math.min(255, Math.max(0, v)));
        }
        return v;
      };

      imageData.data[di] = read(pi);
      imageData.data[di + 1] = read(size + pi);
      imageData.data[di + 2] = read(2 * size + pi);
      imageData.data[di + 3] = 255;
    }
  }

  return imageData;
}

function resolveInputNames(names: string[]) {
  const imageName =
    names.find((n) => n.toLowerCase().includes("image")) ?? names[0];
  const maskName =
    names.find((n) => n.toLowerCase().includes("mask")) ??
    names.find((n) => n !== imageName) ??
    names[1];
  return { imageName, maskName };
}

async function runInference(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  inferenceSession: OrtSession,
  ort: OrtModule,
  featherPx = computeInpaintFeatherPx(imageCanvas.width, imageCanvas.height)
): Promise<HTMLCanvasElement> {
  const resizedImage = resizeCanvas(imageCanvas, MODEL_SIZE, MODEL_SIZE);
  const resizedMask = resizeCanvas(maskCanvas, MODEL_SIZE, MODEL_SIZE);

  const imageCtx = resizedImage.getContext("2d")!;
  const maskCtx = resizedMask.getContext("2d")!;
  const imageData = imageCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const maskData = maskCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);

  const { imageName, maskName } = resolveInputNames(
    inferenceSession.inputNames
  );

  const feeds: Record<string, OrtTensor> = {};

  const tryUint8 = () => {
    feeds[imageName] = new ort.Tensor(
      "uint8",
      imageDataToChwUint8(imageData),
      [1, 3, MODEL_SIZE, MODEL_SIZE]
    );
    feeds[maskName] = new ort.Tensor(
      "uint8",
      maskDataToChwUint8(maskData),
      [1, 1, MODEL_SIZE, MODEL_SIZE]
    );
  };

  const tryFloat32 = () => {
    feeds[imageName] = new ort.Tensor(
      "float32",
      imageDataToChwFloat32(imageData),
      [1, 3, MODEL_SIZE, MODEL_SIZE]
    );
    feeds[maskName] = new ort.Tensor(
      "float32",
      maskDataToChwFloat32(maskData),
      [1, 1, MODEL_SIZE, MODEL_SIZE]
    );
  };

  let results: Record<string, OrtTensor>;
  try {
    tryUint8();
    results = await inferenceSession.run(feeds);
  } catch {
    tryFloat32();
    results = await inferenceSession.run(feeds);
  }

  const outputTensor = results[inferenceSession.outputNames[0]];
  const outputData = outputTensor.data as Float32Array | Uint8Array;

  const resultImageData = chwToImageData(outputData, MODEL_SIZE, MODEL_SIZE);
  const { canvas: result512, ctx: resultCtx } = createCanvas(
    MODEL_SIZE,
    MODEL_SIZE
  );
  resultCtx.putImageData(resultImageData, 0, 0);

  const resultFull = resizeCanvas(
    result512,
    imageCanvas.width,
    imageCanvas.height
  );

  return compositeWithSoftMask(
    imageCanvas,
    resultFull,
    maskCanvas,
    featherPx
  );
}

export async function inpaintWithLama(
  imageDataUrl: string,
  maskCanvas: HTMLCanvasElement,
  onModelProgress?: (percent: number) => void,
  options?: { featherPx?: number }
): Promise<string> {
  const ort = await getOrt();
  await downloadLamaModel(onModelProgress);
  const inferenceSession = await getSession();

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

  const finalCanvas = await runInference(
    imageCanvas,
    maskCanvas,
    inferenceSession,
    ort,
    featherPx
  );

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
