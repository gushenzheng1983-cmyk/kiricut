import type { WatermarkZone } from "@/lib/watermarkZones";
import { DETECT_COVER_SIZE, getAllSearchBoxes } from "@/lib/watermarkZones";

type Roi = {
  id: WatermarkZone;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  edgeWeight: number;
};

type DetectionBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  score: number;
  source: string;
};

const ANALYSIS_MAX = 640;
const MIN_AREA_RATIO = 0.0008;
const MAX_AREA_RATIO = 0.38;
const CONFIDENCE_THRESHOLD = 0.22;

function toGray(rgb: Buffer, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function boxBlur(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const out = new Float32Array(width * height);
  const tmp = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const addX = Math.min(x + radius, width - 1);
      const subX = Math.max(x - radius - 1, 0);
      sum += src[y * width + addX] - src[y * width + subX];
      const denom = Math.min(x + radius + 1, width) - Math.max(x - radius, 0);
      tmp[y * width + x] = sum / denom;
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) {
      const addY = Math.min(y + radius, height - 1);
      const subY = Math.max(y - radius - 1, 0);
      sum += tmp[addY * width + x] - tmp[subY * width + x];
      const denom = Math.min(y + radius + 1, height) - Math.max(y - radius, 0);
      out[y * width + x] = sum / denom;
    }
  }

  return out;
}

function sobel(gray: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] +
        -2 * gray[idx - 1] +
        2 * gray[idx + 1] +
        -gray[idx + width - 1] +
        gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] +
        -2 * gray[idx - width] +
        -gray[idx - width + 1] +
        gray[idx + width - 1] +
        2 * gray[idx + width] +
        gray[idx + width + 1];
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

function getWatermarkSearchRois(
  width: number,
  height: number,
  zone: WatermarkZone = "auto"
): Roi[] {
  const boxes = getAllSearchBoxes(width, height, DETECT_COVER_SIZE);
  const rois = boxes.map((box) => ({
    id: box.id,
    x0: box.x0,
    y0: box.y0,
    x1: box.x1,
    y1: box.y1,
    edgeWeight: 1.0,
  }));

  if (zone === "auto") return rois;
  return rois.filter((roi) => roi.id === zone);
}

function clampBox(
  box: DetectionBox,
  width: number,
  height: number
): DetectionBox {
  return {
    ...box,
    x0: Math.max(0, Math.min(box.x0, width - 1)),
    y0: Math.max(0, Math.min(box.y0, height - 1)),
    x1: Math.max(1, Math.min(box.x1, width)),
    y1: Math.max(1, Math.min(box.y1, height)),
  };
}

function boxArea(box: DetectionBox): number {
  return Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
}

function expandBox(
  box: DetectionBox,
  width: number,
  height: number,
  padRatio = 0.06
): DetectionBox {
  const padX = Math.max(3, Math.floor((box.x1 - box.x0) * padRatio));
  const padY = Math.max(3, Math.floor((box.y1 - box.y0) * padRatio));
  return clampBox(
    {
      ...box,
      x0: box.x0 - padX,
      y0: box.y0 - padY,
      x1: box.x1 + padX,
      y1: box.y1 + padY,
    },
    width,
    height
  );
}

function scoreRoi(
  gray: Float32Array,
  edges: Float32Array,
  blur: Float32Array,
  rgb: Buffer,
  width: number,
  height: number,
  roi: Roi
): DetectionBox | null {
  const roiW = roi.x1 - roi.x0;
  const roiH = roi.y1 - roi.y0;
  if (roiW < 8 || roiH < 8) return null;

  const scores = new Float32Array(roiW * roiH);
  let maxEdge = 1;
  let maxDiff = 1;

  for (let y = roi.y0; y < roi.y1; y++) {
    for (let x = roi.x0; x < roi.x1; x++) {
      const edge = edges[y * width + x];
      const diff = Math.abs(gray[y * width + x] - blur[y * width + x]);
      if (edge > maxEdge) maxEdge = edge;
      if (diff > maxDiff) maxDiff = diff;
    }
  }

  for (let y = roi.y0; y < roi.y1; y++) {
    for (let x = roi.x0; x < roi.x1; x++) {
      const i = y * width + x;
      const edgeNorm = edges[i] / maxEdge;
      const diffNorm = Math.abs(gray[i] - blur[i]) / maxDiff;

      const r = rgb[i * 3];
      const g = rgb[i * 3 + 1];
      const b = rgb[i * 3 + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const lum = gray[i] / 255;
      const washout =
        lum > 0.55 && lum < 0.97 && sat < 0.35 ? 1 - sat : 0;

      const localX = x - roi.x0;
      const localY = y - roi.y0;

      let positionBias = 0;
      if (roi.id === "center") {
        const cx = (width - 1) / 2;
        const cy = (height - 1) / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const maxDist = Math.hypot(cx, cy);
        positionBias = 1 - Math.min(1, dist / maxDist);
      } else {
        const edgeDistX = Math.min(x - roi.x0, roi.x1 - 1 - x) / roiW;
        const edgeDistY = Math.min(y - roi.y0, roi.y1 - 1 - y) / roiH;
        positionBias = 1 - Math.min(edgeDistX, edgeDistY);
      }

      const score =
        edgeNorm * 0.42 +
        diffNorm * 0.28 +
        washout * 0.18 +
        positionBias * 0.12;

      scores[localY * roiW + localX] = score;
    }
  }

  let threshold = 0.42;
  let bestBox: DetectionBox | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    let minX = roiW;
    let minY = roiH;
    let maxX = -1;
    let maxY = -1;
    let sum = 0;
    let count = 0;

    for (let ly = 0; ly < roiH; ly++) {
      for (let lx = 0; lx < roiW; lx++) {
        const s = scores[ly * roiW + lx];
        if (s < threshold) continue;
        minX = Math.min(minX, lx);
        minY = Math.min(minY, ly);
        maxX = Math.max(maxX, lx);
        maxY = Math.max(maxY, ly);
        sum += s;
        count++;
      }
    }

    if (count > 0 && maxX >= minX && maxY >= minY) {
      const areaRatio = (count / (width * height)) * roi.edgeWeight;
      const density = sum / count;
      const compactness =
        count / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
      const totalScore = density * 0.55 + compactness * 0.25 + areaRatio * 8;

      bestBox = {
        x0: roi.x0 + minX,
        y0: roi.y0 + minY,
        x1: roi.x0 + maxX + 1,
        y1: roi.y0 + maxY + 1,
        score: totalScore * roi.edgeWeight,
        source: roi.id,
      };
      break;
    }

    threshold -= 0.08;
  }

  return bestBox;
}

function fallbackForRegion(
  roi: Roi,
  width: number,
  height: number
): DetectionBox {
  const marginX = Math.max(4, Math.floor(width * 0.015));
  const marginY = Math.max(4, Math.floor(height * 0.015));
  const maskW = Math.floor(width * 0.28);
  const maskH = Math.floor(height * 0.2);

  if (roi.id === "top-left") {
    return {
      x0: marginX,
      y0: marginY,
      x1: marginX + maskW,
      y1: marginY + maskH,
      score: 0,
      source: "fallback-top-left",
    };
  }

  if (roi.id === "center") {
    const centerW = Math.floor(width * 0.34);
    const centerH = Math.floor(height * 0.22);
    const x0 = Math.floor((width - centerW) / 2);
    const y0 = Math.floor((height - centerH) / 2);
    return {
      x0,
      y0,
      x1: x0 + centerW,
      y1: y0 + centerH,
      score: 0,
      source: "fallback-center",
    };
  }

  return {
    x0: width - maskW - marginX,
    y0: height - maskH - marginY,
    x1: width - marginX,
    y1: height - marginY,
    score: 0,
    source: "fallback-bottom-right",
  };
}

function fillMaskFromBox(
  mask: Buffer,
  width: number,
  height: number,
  box: DetectionBox
): void {
  for (let y = box.y0; y < box.y1 && y < height; y++) {
    for (let x = box.x0; x < box.x1 && x < width; x++) {
      mask[y * width + x] = 255;
    }
  }
}

function dilateMask(mask: Buffer, width: number, height: number, radius: number) {
  const copy = Buffer.from(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (copy[y * width + x] === 0) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          mask[ny * width + nx] = 255;
        }
      }
    }
  }
}

export type WatermarkDetection = {
  mask: Buffer;
  boxes: DetectionBox[];
  confident: boolean;
};

export type DetectWatermarkOptions = {
  zone?: WatermarkZone;
};

function maskCoverage(mask: Buffer): number {
  let covered = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) covered++;
  }
  return covered / mask.length;
}

/** ユーザー指定ゾーン＝プレビュー赤枠と同じ領域を丸ごと修復 */
function buildFullZoneMask(
  width: number,
  height: number,
  zone: WatermarkZone
): WatermarkDetection {
  const zoneBoxes = getAllSearchBoxes(width, height, DETECT_COVER_SIZE).filter(
    (b) => b.id === zone
  );
  const mask = Buffer.alloc(width * height, 0);
  const boxes: DetectionBox[] = zoneBoxes.map((zb) => ({
    x0: zb.x0,
    y0: zb.y0,
    x1: zb.x1,
    y1: zb.y1,
    score: 1,
    source: zone,
  }));

  for (const box of boxes) {
    fillMaskFromBox(mask, width, height, box);
  }

  const dilate = Math.max(6, Math.floor(Math.min(width, height) * 0.012));
  dilateMask(mask, width, height, dilate);

  return { mask, boxes, confident: true };
}

function boxToFullRoi(
  box: DetectionBox,
  width: number,
  height: number
): DetectionBox {
  const rois = getAllSearchBoxes(width, height, DETECT_COVER_SIZE);
  const roi = rois.find((r) => r.id === box.source);
  if (!roi) return box;
  return {
    x0: roi.x0,
    y0: roi.y0,
    x1: roi.x1,
    y1: roi.y1,
    score: box.score,
    source: box.source,
  };
}

/** 画像から水印候補を自動検出し、修復用マスクを生成 */
export function detectWatermarkMask(
  rgb: Buffer,
  width: number,
  height: number,
  options: DetectWatermarkOptions = {}
): WatermarkDetection {
  const zone = options.zone ?? "auto";

  if (zone !== "auto") {
    return buildFullZoneMask(width, height, zone);
  }

  const scale = Math.min(1, ANALYSIS_MAX / Math.max(width, height));
  const analysisW = Math.max(32, Math.round(width * scale));
  const analysisH = Math.max(32, Math.round(height * scale));

  const scaledRgb = Buffer.alloc(analysisW * analysisH * 3);
  for (let y = 0; y < analysisH; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < analysisW; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale));
      const srcI = (srcY * width + srcX) * 3;
      const dstI = (y * analysisW + x) * 3;
      scaledRgb[dstI] = rgb[srcI];
      scaledRgb[dstI + 1] = rgb[srcI + 1];
      scaledRgb[dstI + 2] = rgb[srcI + 2];
    }
  }

  const gray = toGray(scaledRgb, analysisW, analysisH);
  const blur = boxBlur(gray, analysisW, analysisH, 7);
  const edges = sobel(gray, analysisW, analysisH);

  const rois = getWatermarkSearchRois(analysisW, analysisH, zone);
  const candidates: DetectionBox[] = [];
  const userSpecifiedZone = zone !== "auto";

  for (const roi of rois) {
    const candidate = scoreRoi(
      gray,
      edges,
      blur,
      scaledRgb,
      analysisW,
      analysisH,
      roi
    );
    if (!candidate) continue;
    const areaRatio = boxArea(candidate) / (analysisW * analysisH);
    if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) continue;
    candidates.push(candidate);
  }

  const confidentHits = candidates
    .filter((c) => c.score >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  let finalBoxes: DetectionBox[] = [];
  let confident = confidentHits.length > 0;

  if (confident) {
    finalBoxes = confidentHits.map((box) => expandBox(box, analysisW, analysisH));
  } else if (candidates.length > 0) {
    const best = [...candidates].sort((a, b) => b.score - a.score)[0];
    finalBoxes = [expandBox(best, analysisW, analysisH)];
    confident = false;
  } else if (userSpecifiedZone && rois[0]) {
    finalBoxes = [
      expandBox(fallbackForRegion(rois[0], analysisW, analysisH), analysisW, analysisH),
    ];
    confident = false;
  } else {
    const bestRoi = rois[1] ?? rois[0];
    if (bestRoi) {
      finalBoxes = [
        expandBox(fallbackForRegion(bestRoi, analysisW, analysisH), analysisW, analysisH),
      ];
    }
    confident = false;
  }

  finalBoxes = finalBoxes.filter((box) => {
    const areaRatio = boxArea(box) / (analysisW * analysisH);
    return areaRatio <= MAX_AREA_RATIO;
  });

  if (finalBoxes.length === 0 && rois[0]) {
    finalBoxes = [expandBox(fallbackForRegion(rois[0], analysisW, analysisH), analysisW, analysisH)];
    confident = false;
  }

  const fullBoxes = finalBoxes.map((box) =>
    clampBox(
      {
        ...box,
        x0: Math.floor(box.x0 / scale),
        y0: Math.floor(box.y0 / scale),
        x1: Math.ceil(box.x1 / scale),
        y1: Math.ceil(box.y1 / scale),
        score: box.score,
        source: box.source,
      },
      width,
      height
    )
  );

  let boxesForMask = fullBoxes;

  if (boxesForMask.length > 0) {
    const totalDetectedArea = boxesForMask.reduce(
      (sum, box) => sum + boxArea(box),
      0
    );
    const imageArea = width * height;
    if (totalDetectedArea / imageArea < 0.008) {
      const best = [...boxesForMask].sort((a, b) => b.score - a.score)[0];
      boxesForMask = [boxToFullRoi(best, width, height)];
    }
  }

  const mask = Buffer.alloc(width * height, 0);
  for (const box of boxesForMask) {
    fillMaskFromBox(mask, width, height, expandBox(box, width, height, 0.04));
  }
  dilateMask(
    mask,
    width,
    height,
    Math.max(4, Math.floor(Math.min(width, height) * 0.008))
  );

  if (maskCoverage(mask) < 0.005 && rois[0]) {
    return buildFullZoneMask(width, height, rois[1]?.id ?? rois[0].id);
  }

  return { mask, boxes: boxesForMask, confident };
}
