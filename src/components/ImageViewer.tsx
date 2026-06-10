"use client";

import { useRef, useState, type RefObject } from "react";
import ImagePanel from "./ImagePanel";
import ImageActionBar from "./ImageActionBar";
import BatchImageList from "./BatchImageList";
import { type Locale, getPlatformLabel, t } from "@/lib/i18n";
import type { CoverZoneRect } from "@/lib/coverZoneRect";
import type { CoverSize } from "@/lib/watermarkZones";
import type { BatchImageItem, ProcessingStatus, WatermarkZone } from "@/types";

interface ImageViewerProps {
  locale: Locale;
  originalImageDataUrl: string | null;
  processedImageDataUrl: string | null;
  resultDisplayDataUrl: string | null;
  hasProcessedResult: boolean;
  hasImage: boolean;
  hasRemovedBackground: boolean;
  isProcessing?: boolean;
  processingStatus?: ProcessingStatus;
  modelProgress?: number;
  backgroundType: string;
  watermarkZone: WatermarkZone | null;
  coverColor: string;
  coverSize: CoverSize;
  customCoverRect?: CoverZoneRect | null;
  editableCoverZone?: boolean;
  coverColorPickMode?: boolean;
  onCoverZoneRectChange?: (rect: CoverZoneRect) => void;
  onCoverColorPicked?: (imgX: number, imgY: number) => void;
  activeStep: number;
  batchItems: BatchImageItem[];
  activeIndex: number;
  batchProgressCurrent?: number;
  learningCount?: number;
  learningConfidence?: "low" | "medium" | "high";
  selectedPlatformId?: string | null;
  onUpload: (files: File[]) => void;
  onSelectBatchItem: (index: number) => void;
  onFastPipeline?: () => void;
  workspaceRef: RefObject<HTMLElement | null>;
}

export default function ImageViewer({
  locale,
  originalImageDataUrl,
  processedImageDataUrl,
  resultDisplayDataUrl,
  hasProcessedResult,
  hasImage,
  hasRemovedBackground,
  isProcessing = false,
  processingStatus = "idle",
  modelProgress = 0,
  backgroundType,
  watermarkZone,
  coverColor,
  coverSize,
  customCoverRect = null,
  editableCoverZone = false,
  coverColorPickMode = false,
  onCoverZoneRectChange,
  onCoverColorPicked,
  activeStep,
  batchItems,
  activeIndex,
  batchProgressCurrent = 0,
  learningCount = 0,
  selectedPlatformId = null,
  onUpload,
  onSelectBatchItem,
  onFastPipeline,
  workspaceRef,
}: ImageViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length) onUpload(list);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        {!originalImageDataUrl ? (
          <div
            className={`flex h-full w-full cursor-pointer items-center justify-center p-8 transition-colors ${
              isDragOver ? "bg-violet-50" : "bg-white"
            }`}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isProcessing) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
              disabled={isProcessing}
            />
            <div
              className={`flex max-w-lg flex-col items-center rounded-2xl border-2 border-dashed px-10 py-12 text-center transition-colors ${
                isDragOver
                  ? "border-violet-400 bg-violet-50"
                  : "border-gray-300 bg-gray-50 hover:border-violet-300"
              }`}
            >
              <p className="text-xl font-bold text-gray-800">
                {t(locale, "heroTitle")}
              </p>
              <div className="mt-4 space-y-1.5 text-sm text-gray-600">
                <p>1. {t(locale, "heroStep1")}</p>
                <p>2. {t(locale, "heroStep2")}</p>
                <p>3. {t(locale, "heroStep3")}</p>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                  {t(locale, "heroFeature1")}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  {t(locale, "heroFeature2")}
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-700">
                  {t(locale, "heroFeature3")}
                </span>
              </div>
              <p className="mt-5 text-base font-semibold text-violet-600">
                {t(locale, "dropUpload")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t(locale, "dropHint")}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {t(locale, "dropBatch")}
              </p>
              {selectedPlatformId && learningCount > 0 && (
                <p className="mt-3 text-[11px] text-emerald-600">
                  {t(locale, "lastUsedPlatform", {
                    platform: getPlatformLabel(locale, selectedPlatformId),
                    count: learningCount,
                  })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">
            {batchItems.length > 1 && (
              <div className="shrink-0 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-700">
                    {isProcessing && batchProgressCurrent > 0
                      ? t(locale, "batchProgress", {
                          current: batchProgressCurrent,
                          total: batchItems.length,
                        })
                      : t(locale, "batchBarUploaded", {
                          count: batchItems.length,
                        })}
                  </span>
                  {onFastPipeline && watermarkZone && !isProcessing && (
                    <button
                      type="button"
                      onClick={onFastPipeline}
                      className="btn-panel-pipeline rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      {t(locale, "fastPipeline", {
                        platform: selectedPlatformId
                          ? getPlatformLabel(locale, selectedPlatformId)
                          : t(locale, "fastPipelineFallback"),
                      })}
                    </button>
                  )}
                </div>
                {isProcessing && batchProgressCurrent > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{
                        width: `${(batchProgressCurrent / batchItems.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-gray-200 md:border-b-0 md:border-r">
              <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-xs font-semibold text-gray-600">
                  {t(locale, "originalLabel")}
                  {watermarkZone ? t(locale, "previewZone") : ""}
                  {batchItems.length > 1 ? ` · ${t(locale, "batchConfirmTitle")}` : ""}
                </span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-visible bg-white">
                <ImagePanel
                  imageDataUrl={originalImageDataUrl}
                  highlightZone={watermarkZone}
                  coverColor={coverColor}
                  coverSize={coverSize}
                  customCoverRect={customCoverRect}
                  editableCoverZone={editableCoverZone}
                  autoZoneHint={
                    watermarkZone === "auto"
                      ? t(locale, "autoDetectPickManual")
                      : undefined
                  }
                  onCoverZoneRectChange={onCoverZoneRectChange}
                  coverColorPickMode={coverColorPickMode}
                  onCoverColorPicked={onCoverColorPicked}
                  workspaceRef={workspaceRef}
                />
              </div>
            </div>

            <div className="flex min-h-[220px] min-w-0 flex-1 flex-col md:min-h-0">
              <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-xs font-semibold text-gray-600">
                  {t(locale, "resultLabel")}
                  {hasProcessedResult ? " ✓" : ""}
                </span>
              </div>
              <div className="relative min-h-[180px] flex-1 bg-white md:min-h-0">
                <ImagePanel
                  imageDataUrl={
                    processedImageDataUrl ?? resultDisplayDataUrl
                  }
                  simpleDisplay
                  showTransparentGrid={
                    hasProcessedResult &&
                    hasRemovedBackground &&
                    backgroundType === "transparent"
                  }
                  placeholder={t(locale, "resultPlaceholder")}
                />
              </div>
            </div>

            {(processingStatus === "inpainting" ||
              processingStatus === "removing-background") && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                <div className="mx-4 flex max-w-xs flex-col items-center gap-3 rounded-2xl bg-white/95 px-6 py-5 shadow-xl">
                  <div className="ai-spinner" />
                  <p className="text-center text-sm font-semibold text-violet-700">
                    {processingStatus === "removing-background"
                      ? t(locale, "aiProcessingBgHint")
                      : t(locale, "aiProcessingHint")}
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="ai-progress-bar h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(6, modelProgress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {t(locale, "aiProcessingProgress", {
                      percent: modelProgress,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      <BatchImageList
        items={batchItems}
        activeIndex={activeIndex}
        locale={locale}
        onSelect={onSelectBatchItem}
      />

      <ImageActionBar
        locale={locale}
        hasImage={hasImage}
        isProcessing={isProcessing}
        watermarkZone={watermarkZone}
        activeStep={activeStep}
      />
    </div>
  );
}
