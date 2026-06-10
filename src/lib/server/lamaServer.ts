import fs from "fs";
import path from "path";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import type { WatermarkZone } from "@/lib/watermarkZones";
import { detectWatermarkMask } from "./watermarkDetect";

const MODEL_SIZE = 512;

const MODEL_PATHS = [
  path.join(process.cwd(), "public/models/big-lama.onnx"),
];

const MODEL_URLS = [
  "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
  "https://huggingface.co/lxfater/inpaint-web/resolve/main/models/big-lama.onnx",
];

let session: ort.InferenceSession | null = null;
let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function ensureModelFile(): Promise<string> {
  for (const modelPath of MODEL_PATHS) {
    if (fs.existsSync(modelPath)) {
      return modelPath;
    }
  }

  const modelDir = path.join(process.cwd(), "public/models");
  const modelPath = path.join(modelDir, "big-lama.onnx");
  fs.mkdirSync(modelDir, { recursive: true });

  let lastError: Error | null = null;
  for (const url of MODEL_URLS) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024 * 1024) continue;
      fs.writeFileSync(modelPath, buffer);
      return modelPath;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("モデルダウンロード失敗");
    }
  }

  throw (
    lastError ??
    new Error(
      "サーバーにLaMaモデルがありません。npm run setup-models を実行してください"
    )
  );
}

async function getSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const modelPath = await ensureModelFile();
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
      });
      return session;
    })();
  }
  return sessionPromise;
}

function imageToChwFloat32(rgb: Buffer, size: number): Float32Array {
  const chw = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    chw[i] = rgb[i * 3] / 255;
    chw[size * size + i] = rgb[i * 3 + 1] / 255;
    chw[2 * size * size + i] = rgb[i * 3 + 2] / 255;
  }
  return chw;
}

function maskToChwFloat32(mask: Buffer, size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    out[i] = mask[i] > 127 ? 1.0 : 0.0;
  }
  return out;
}

function chwFloat32ToRgb(data: Float32Array, size: number): Buffer {
  const rgb = Buffer.alloc(size * size * 3);
  let maxVal = 0;
  for (let i = 0; i < Math.min(500, data.length); i++) {
    if (data[i] > maxVal) maxVal = data[i];
  }
  const scale = maxVal <= 1.5;

  for (let i = 0; i < size * size; i++) {
    const r = data[i];
    const g = data[size * size + i];
    const b = data[2 * size * size + i];
    rgb[i * 3] = Math.round(scale ? r * 255 : r);
    rgb[i * 3 + 1] = Math.round(scale ? g * 255 : g);
    rgb[i * 3 + 2] = Math.round(scale ? b * 255 : b);
  }
  return rgb;
}

function resolveInputNames(names: readonly string[]) {
  const imageName =
    names.find((n) => n.toLowerCase().includes("image")) ?? names[0];
  const maskName =
    names.find((n) => n.toLowerCase().includes("mask")) ??
    names.find((n) => n !== imageName) ??
    names[1];
  return { imageName, maskName };
}

async function runInference(
  imageRgb: Buffer,
  maskGray: Buffer
): Promise<Buffer> {
  const inferenceSession = await getSession();
  const { imageName, maskName } = resolveInputNames(
    inferenceSession.inputNames
  );

  const imageTensor = new ort.Tensor(
    "float32",
    imageToChwFloat32(imageRgb, MODEL_SIZE),
    [1, 3, MODEL_SIZE, MODEL_SIZE]
  );
  const maskTensor = new ort.Tensor(
    "float32",
    maskToChwFloat32(maskGray, MODEL_SIZE),
    [1, 1, MODEL_SIZE, MODEL_SIZE]
  );

  const feeds: Record<string, ort.Tensor> = {
    [imageName]: imageTensor,
    [maskName]: maskTensor,
  };

  const results = await inferenceSession.run(feeds);
  const output = results[inferenceSession.outputNames[0]];
  const outputRgb = chwFloat32ToRgb(
    output.data as Float32Array,
    MODEL_SIZE
  );

  return sharp(outputRgb, {
    raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 3 },
  })
    .png()
    .toBuffer();
}

export async function removeWatermarkServer(
  imageBuffer: Buffer,
  zone: WatermarkZone = "auto"
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("画像のサイズを読み取れません");
  }

  const originalRgb = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer();

  const { mask: maskFull } = detectWatermarkMask(originalRgb, width, height, {
    zone,
  });

  const imageRgb = await sharp(imageBuffer)
    .resize(MODEL_SIZE, MODEL_SIZE)
    .removeAlpha()
    .raw()
    .toBuffer();

  let mask512 = await sharp(maskFull, {
    raw: { width, height, channels: 1 },
  })
    .resize(MODEL_SIZE, MODEL_SIZE, { kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer();

  for (let i = 0; i < mask512.length; i++) {
    mask512[i] = mask512[i] > 127 ? 255 : 0;
  }

  let maskPixelCount = 0;
  for (let i = 0; i < mask512.length; i++) {
    if (mask512[i] > 127) maskPixelCount++;
  }
  if (maskPixelCount < 16) {
    throw new Error("水印区域が検出できませんでした。位置を選び直してください");
  }

  const inpaint512 = await runInference(imageRgb, mask512);

  const inpaintFull = await sharp(inpaint512)
    .resize(width, height)
    .removeAlpha()
    .raw()
    .toBuffer();

  const output = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const useInpaint = maskFull[i] > 127;
    const src = useInpaint ? inpaintFull : originalRgb;
    output[i * 3] = src[i * 3];
    output[i * 3 + 1] = src[i * 3 + 1];
    output[i * 3 + 2] = src[i * 3 + 2];
  }

  return sharp(output, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}
