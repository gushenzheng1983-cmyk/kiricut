"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import EditableCoverZone from "./EditableCoverZone";
import {
  clampCoverZoneRect,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import {
  getZoneSearchBoxes,
  resolveCoverZoneRect,
  type CoverSize,
  type WatermarkZone,
} from "@/lib/watermarkZones";

interface ImagePanelProps {
  imageDataUrl: string | null;
  showTransparentGrid?: boolean;
  placeholder?: string;
  highlightZone?: WatermarkZone | null;
  coverColor?: string;
  coverSize?: CoverSize;
  customCoverRect?: CoverZoneRect | null;
  editableCoverZone?: boolean;
  autoZoneHint?: string;
  onCoverZoneRectChange?: (rect: CoverZoneRect) => void;
  coverColorPickMode?: boolean;
  onCoverColorPicked?: (imgX: number, imgY: number) => void;
  workspaceRef?: RefObject<HTMLElement | null>;
}

interface DisplaySize {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export default function ImagePanel({
  imageDataUrl,
  showTransparentGrid = false,
  placeholder,
  highlightZone = null,
  coverColor = "#ffffff",
  coverSize,
  customCoverRect = null,
  editableCoverZone = false,
  autoZoneHint,
  onCoverZoneRectChange,
  coverColorPickMode = false,
  onCoverColorPicked,
  workspaceRef,
}: ImagePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState<DisplaySize>({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const renderImage = useCallback(() => {
    const container = containerRef.current;
    const canvas = imageCanvasRef.current;
    const img = imageRef.current;

    if (!container || !canvas || !img) return;

    const maxWidth = container.clientWidth - 16;
    const maxHeight = container.clientHeight - 16;
    const ratio = Math.min(
      maxWidth / img.naturalWidth,
      maxHeight / img.naturalHeight,
      1
    );

    const displayWidth = Math.floor(img.naturalWidth * ratio);
    const displayHeight = Math.floor(img.naturalHeight * ratio);

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    setDisplaySize({
      width: displayWidth,
      height: displayHeight,
      offsetX: (container.clientWidth - displayWidth) / 2,
      offsetY: (container.clientHeight - displayHeight) / 2,
    });
  }, []);

  useEffect(() => {
    if (!imageDataUrl) {
      imageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      renderImage();
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, renderImage]);

  useEffect(() => {
    const handleResize = () => renderImage();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderImage]);

  const handlePickClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!coverColorPickMode || !imageRef.current || !onCoverColorPicked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const scaleX = imageRef.current.naturalWidth / displaySize.width;
    const scaleY = imageRef.current.naturalHeight / displaySize.height;
    const imgX = Math.floor(dx * scaleX);
    const imgY = Math.floor(dy * scaleY);
    onCoverColorPicked(imgX, imgY);
  };

  if (!imageDataUrl) {
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center"
      >
        <p className="text-sm text-gray-400">{placeholder}</p>
      </div>
    );
  }

  const display = displaySize;
  const img = imageRef.current;
  const canEditZone =
    editableCoverZone &&
    highlightZone &&
    highlightZone !== "auto" &&
    onCoverZoneRectChange;

  const activeRect =
    img && highlightZone && coverSize
      ? resolveCoverZoneRect(
          highlightZone,
          coverSize,
          customCoverRect
        )
      : null;

  const legacyBoxes =
    img && highlightZone && !canEditZone
      ? getZoneSearchBoxes(
          img.naturalWidth,
          img.naturalHeight,
          highlightZone,
          coverSize,
          customCoverRect
        )
      : [];
  const scaleX = img ? display.width / img.naturalWidth : 1;
  const scaleY = img ? display.height / img.naturalHeight : 1;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-visible">
      {showTransparentGrid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        />
      )}
      {coverColorPickMode && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2">
          <span className="max-w-md rounded-xl border-2 border-amber-200 bg-amber-500 px-4 py-2 text-center text-[12px] font-bold text-white shadow-xl">
            🎯 吸色中：请点击干净背景（避开水印）
          </span>
        </div>
      )}
      <div
        ref={overlayRef}
        data-kiri-image-overlay
        className={`absolute overflow-visible ${coverColorPickMode ? "cursor-crosshair" : ""}`}
        style={{
          left: display.offsetX,
          top: display.offsetY,
          width: display.width,
          height: display.height,
        }}
        onClick={handlePickClick}
      >
        <canvas
          ref={imageCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {canEditZone && activeRect && workspaceRef && (
          <EditableCoverZone
            rect={activeRect}
            displayWidth={display.width}
            displayHeight={display.height}
            coverColor={coverColor}
            workspaceRef={workspaceRef}
            onRectChange={(next) =>
              onCoverZoneRectChange(clampCoverZoneRect(next))
            }
          />
        )}
        {highlightZone === "auto" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <p className="rounded-lg bg-black/55 px-3 py-2 text-center text-[10px] leading-snug text-amber-100">
              {autoZoneHint ?? "请使用「智能识别」或手动选一个位置"}
            </p>
          </div>
        )}
        {!canEditZone &&
          highlightZone !== "auto" &&
          legacyBoxes.map((box, index) => (
            <div
              key={`${box.x0}-${box.y0}-${index}`}
              className="pointer-events-none absolute border-2 border-dashed border-red-500"
              style={{
                left: box.x0 * scaleX,
                top: box.y0 * scaleY,
                width: (box.x1 - box.x0) * scaleX,
                height: (box.y1 - box.y0) * scaleY,
                backgroundColor: `${coverColor}99`,
              }}
            >
              <span className="absolute -top-5 left-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
                覆盖预览
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
