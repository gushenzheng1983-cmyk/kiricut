import type { BackgroundSettings } from "@/types";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

export function createCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context を取得できません");
  return { canvas, ctx };
}

export function drawImageToCanvas(
  image: HTMLImageElement,
  width?: number,
  height?: number
): HTMLCanvasElement {
  const w = width ?? image.naturalWidth;
  const h = height ?? image.naturalHeight;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
}

export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  type = "image/png"
): string {
  return canvas.toDataURL(type);
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((res) => res.blob());
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function getPixelColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const pixel = ctx.getImageData(
    Math.floor(x),
    Math.floor(y),
    1,
    1
  ).data;
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
}

export function applyBackground(
  foregroundCanvas: HTMLCanvasElement,
  settings: BackgroundSettings
): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(
    foregroundCanvas.width,
    foregroundCanvas.height
  );

  if (settings.type === "transparent") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(foregroundCanvas, 0, 0);
    return canvas;
  }

  if (settings.type === "solid" || settings.type === "custom") {
    const color =
      settings.type === "custom" ? settings.customColor : settings.solidColor;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (settings.type === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, settings.gradientStart);
    gradient.addColorStop(1, settings.gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(foregroundCanvas, 0, 0);
  return canvas;
}

export function resizeCanvas(
  source: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** AI 修图蒙版边缘羽化，避免红框硬切留下方框印 */
export function computeInpaintFeatherPx(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(10, Math.min(36, Math.round(shortSide * 0.022)));
}

/** 快速覆盖：仅框外缘轻微过渡，避免把原水印混回来 */
export function computeCoverFeatherPx(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(2, Math.min(6, Math.round(shortSide * 0.004)));
}

/** 覆盖+AI：先铺底色再修边，羽化略大于纯覆盖 */
export function computeCoverAiFeatherPx(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(5, Math.min(12, Math.round(shortSide * 0.009)));
}

/** AI 蒙版外扩，吃掉水印边缘光晕 */
export function computeMaskExpandPx(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(4, Math.min(14, Math.round(shortSide * 0.012)));
}

/** 框内核心区侵蚀，用于铺底色巩固 */
export function computeCoreErodePx(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.max(3, Math.min(10, Math.round(shortSide * 0.007)));
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized.padStart(6, "0").slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function morphMask(
  maskCanvas: HTMLCanvasElement,
  radius: number,
  mode: "expand" | "erode"
): HTMLCanvasElement {
  if (radius <= 0) return maskCanvas;
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const src = maskCanvas.getContext("2d")!.getImageData(0, 0, w, h);
  const out = new ImageData(w, h);
  const r = Math.ceil(radius);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const centerOn = src.data[i] >= 128;
      let match = mode === "expand" ? false : true;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            if (mode === "erode") match = false;
            continue;
          }
          const ni = (ny * w + nx) * 4;
          const neighborOn = src.data[ni] >= 128;
          if (mode === "expand" && neighborOn) match = true;
          if (mode === "erode" && !neighborOn) match = false;
        }
      }

      const on = mode === "expand" ? match : centerOn && match;
      const v = on ? 255 : 0;
      out.data[i] = v;
      out.data[i + 1] = v;
      out.data[i + 2] = v;
      out.data[i + 3] = 255;
    }
  }

  const { canvas, ctx } = createCanvas(w, h);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

export function expandMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  expandPx: number
): HTMLCanvasElement {
  return morphMask(maskCanvas, expandPx, "expand");
}

export function erodeMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  erodePx: number
): HTMLCanvasElement {
  return morphMask(maskCanvas, erodePx, "erode");
}

/** 蒙版白色区域铺底色（去水印前先盖住字） */
export function applyColorThroughMask(
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maskCanvas: HTMLCanvasElement,
  coverColor: string
): void {
  const { r, g, b } = parseHexColor(coverColor);
  const imageData = targetCtx.getImageData(0, 0, width, height);
  const maskData = maskCanvas.getContext("2d")!.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < width * height; i++) {
    const di = i * 4;
    const gray =
      (maskData.data[di] +
        maskData.data[di + 1] +
        maskData.data[di + 2]) /
      3;
    if (gray < 128) continue;
    data[di] = r;
    data[di + 1] = g;
    data[di + 2] = b;
    data[di + 3] = 255;
  }

  targetCtx.putImageData(imageData, 0, 0);
}

/** 框内核心铺底色巩固，外圈保留 AI 过渡 — 平衡「修图」与「覆盖」 */
export async function applyCoverAnchor(
  imageDataUrl: string,
  fillMask: HTMLCanvasElement,
  coverColor: string,
  anchorStrength = 0.68
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const coreMask = erodeMaskCanvas(fillMask, computeCoreErodePx(w, h));
  const coreData = coreMask.getContext("2d")!.getImageData(0, 0, w, h).data;
  const { r, g, b } = parseHexColor(coverColor);

  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    const core =
      (coreData[di] + coreData[di + 1] + coreData[di + 2]) / 3 / 255;
    if (core <= 0) continue;
    const weight = anchorStrength * core;
    data[di] = Math.round(data[di] * (1 - weight) + r * weight);
    data[di + 1] = Math.round(data[di + 1] * (1 - weight) + g * weight);
    data[di + 2] = Math.round(data[di + 2] * (1 - weight) + b * weight);
  }

  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(data), w, h),
    0,
    0
  );
  return canvas.toDataURL("image/png");
}

export function featherMaskCanvas(
  maskCanvas: HTMLCanvasElement,
  featherPx: number
): HTMLCanvasElement {
  if (featherPx <= 0) {
    return maskCanvas;
  }
  const { canvas, ctx } = createCanvas(maskCanvas.width, maskCanvas.height);
  ctx.filter = `blur(${featherPx}px)`;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.filter = "none";
  return canvas;
}

/** 按羽化蒙版将修复层与原图融合（alpha 0~1） */
export function compositeWithSoftMask(
  original: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  featherPx = 0
): HTMLCanvasElement {
  const w = original.width;
  const h = original.height;
  const blendMask =
    featherPx > 0 ? featherMaskCanvas(mask, featherPx) : mask;
  const { canvas, ctx } = createCanvas(w, h);

  const origCtx = original.getContext("2d")!;
  const overCtx = overlay.getContext("2d")!;
  const maskCtx = blendMask.getContext("2d")!;

  const origData = origCtx.getImageData(0, 0, w, h);
  const overData = overCtx.getImageData(0, 0, w, h);
  const maskData = maskCtx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);

  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    const gray =
      (maskData.data[di] + maskData.data[di + 1] + maskData.data[di + 2]) / 3;
    const alpha = gray / 255;
    out.data[di] = Math.round(
      overData.data[di] * alpha + origData.data[di] * (1 - alpha)
    );
    out.data[di + 1] = Math.round(
      overData.data[di + 1] * alpha + origData.data[di + 1] * (1 - alpha)
    );
    out.data[di + 2] = Math.round(
      overData.data[di + 2] * alpha + origData.data[di + 2] * (1 - alpha)
    );
    out.data[di + 3] = 255;
  }

  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** 右下角水印区域の自動マスク（白=修復対象、黒=保持） */
export function createBottomRightWatermarkMask(
  width: number,
  height: number,
  widthRatio = 0.28,
  heightRatio = 0.2
): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const marginX = Math.max(4, Math.floor(width * 0.015));
  const marginY = Math.max(4, Math.floor(height * 0.015));
  const maskW = Math.floor(width * widthRatio);
  const maskH = Math.floor(height * heightRatio);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    width - maskW - marginX,
    height - maskH - marginY,
    maskW,
    maskH
  );

  return canvas;
}

export function imageDataToChwFloat32(
  imageData: ImageData
): Float32Array {
  const { width, height, data } = imageData;
  const chw = new Float32Array(3 * width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const pi = y * width + x;
      chw[pi] = data[i] / 255;
      chw[width * height + pi] = data[i + 1] / 255;
      chw[2 * width * height + pi] = data[i + 2] / 255;
    }
  }

  return chw;
}

export function maskDataToChwFloat32(
  imageData: ImageData
): Float32Array {
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

export function chwFloat32ToImageData(
  data: Float32Array,
  width: number,
  height: number
): ImageData {
  const imageData = new ImageData(width, height);
  const size = width * height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const di = pi * 4;
      imageData.data[di] = Math.min(255, Math.max(0, data[pi] * 255));
      imageData.data[di + 1] = Math.min(
        255,
        Math.max(0, data[size + pi] * 255)
      );
      imageData.data[di + 2] = Math.min(
        255,
        Math.max(0, data[2 * size + pi] * 255)
      );
      imageData.data[di + 3] = 255;
    }
  }

  return imageData;
}
