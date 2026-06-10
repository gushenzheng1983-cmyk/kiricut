import { createCanvas, loadImage } from "@/lib/canvasUtils";
import type { CoverZoneRect } from "@/lib/coverZoneRect";
import {
  getZoneSearchBoxes,
  type CoverSize,
  type WatermarkZone,
  type ZoneBox,
} from "@/lib/watermarkZones";

type Rgb = [number, number, number];

function median(values: number[]): number {
  if (values.length === 0) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function rgbToHex([r, g, b]: Rgb): string {
  const toHex = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function collectStrip(
  data: Uint8ClampedArray,
  imgW: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  out: Rgb[]
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= imgW) continue;
      const i = (y * imgW + x) * 4;
      const a = data[i + 3];
      if (a < 128) continue;
      out.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
}

/** 在水印框内外缘采样背景色，避开整块水印区域中心 */
function sampleAroundBox(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  box: ZoneBox,
  ring: number
): Rgb[] {
  const samples: Rgb[] = [];
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;

  collectStrip(data, imgW, box.x0, Math.max(0, box.y0 - ring), bw, ring, samples);
  collectStrip(
    data,
    imgW,
    box.x0,
    Math.min(imgH - ring, box.y1),
    bw,
    ring,
    samples
  );
  collectStrip(
    data,
    imgW,
    Math.max(0, box.x0 - ring),
    box.y0,
    ring,
    bh,
    samples
  );
  collectStrip(
    data,
    imgW,
    Math.min(imgW - ring, box.x1),
    box.y0,
    ring,
    bh,
    samples
  );

  const edge = Math.max(1, Math.floor(Math.min(bw, bh) * 0.03));
  collectStrip(data, imgW, box.x0, box.y0, bw, edge, samples);
  collectStrip(data, imgW, box.x0, box.y1 - edge, bw, edge, samples);
  collectStrip(data, imgW, box.x0, box.y0, edge, bh, samples);
  collectStrip(data, imgW, box.x1 - edge, box.y0, edge, bh, samples);

  return samples;
}

function filterBackgroundSamples(samples: Rgb[]): Rgb[] {
  if (samples.length < 8) return samples;

  const rs = samples.map((s) => s[0]);
  const gs = samples.map((s) => s[1]);
  const bs = samples.map((s) => s[2]);
  const mr = median(rs);
  const mg = median(gs);
  const mb = median(bs);

  return samples.filter(([r, g, b]) => {
    const dist = Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb);
    return dist < 72;
  });
}

function medianColor(samples: Rgb[]): string {
  if (samples.length === 0) return "#ffffff";
  return rgbToHex([
    median(samples.map((s) => s[0])),
    median(samples.map((s) => s[1])),
    median(samples.map((s) => s[2])),
  ]);
}

/** 分析单张图在水印区域附近的背景主色 */
/** 精密吸色：点击位置小范围（默认 2px 半径）取中位色 */
export async function sampleColorAtPoint(
  imageDataUrl: string,
  imgX: number,
  imgY: number,
  radius = 2
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: Rgb[] = [];

  const cx = Math.floor(imgX);
  const cy = Math.floor(imgY);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3] < 128) continue;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  return medianColor(samples);
}

export async function detectCoverColorNearZone(
  imageDataUrl: string,
  zone: WatermarkZone,
  coverSize: CoverSize,
  customRect?: CoverZoneRect | null
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);

  const boxes = getZoneSearchBoxes(
    img.naturalWidth,
    img.naturalHeight,
    zone,
    coverSize,
    customRect
  );
  if (boxes.length === 0) return "#ffffff";

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ring = Math.max(1, Math.floor(Math.min(img.naturalWidth, img.naturalHeight) * 0.002));

  let allSamples: Rgb[] = [];
  for (const box of boxes) {
    allSamples = allSamples.concat(
      sampleAroundBox(
        imageData.data,
        canvas.width,
        canvas.height,
        box,
        ring
      )
    );
  }

  const filtered = filterBackgroundSamples(allSamples);
  return medianColor(filtered.length > 0 ? filtered : allSamples);
}
