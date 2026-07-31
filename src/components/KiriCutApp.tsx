"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BatchConfirmDialog from "./BatchConfirmDialog";
import ImageViewer from "./ImageViewer";
import ControlPanel from "./ControlPanel";
import UpgradeProModal from "./UpgradeProModal";
import SupportContactModal from "./SupportContactModal";
import {
  AI_SERVICE_UNAVAILABLE,
  isAiServiceUnavailable,
} from "@/lib/aiService";
import { getLicenseSummary } from "@/lib/license";
import { PRICING } from "@/lib/pricing";
import {
  canProcess,
  getDailyUsed,
  getMaxBatchSize,
  recordUsage,
} from "@/lib/usageQuota";
import { removeImageBackground } from "@/lib/backgroundRemoval";
import { preloadAllModels } from "@/lib/preloadModels";
import {
  getCoverColorLearningStats,
  recordCoverColorLearning,
  resolveCoverColorForImage,
} from "@/lib/coverColorLearn";
import { sampleColorAtPoint } from "@/lib/coverColorDetect";
import {
  clampCoverZoneRect,
  getDefaultCoverZoneRect,
  getDiagonalWatermarkPreset,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import { importSettingsFromFile } from "@/lib/settingsSync";
import {
  applyShopBranding,
  type ShopBrandingPlacement,
} from "@/lib/shopWatermark";
import { preloadLamaModel } from "@/lib/lamaInpaint";
import { fillWatermarkZone } from "@/lib/watermarkFill";
import { inpaintWatermarkZone } from "@/lib/watermarkInpaint";
import { detectBestWatermarkZone } from "@/lib/watermarkDetectClient";
import { downloadImagesAsZip } from "@/lib/batchDownload";
import {
  clampExportSize,
  prepareExportDataUrl,
  resolveExportSize,
  type ExportSize,
  type ExportSizeMode,
} from "@/lib/platformExport";
import {
  type Locale,
  getPlatformLabel,
  getZoneLabelI18n,
  t,
} from "@/lib/i18n";
import {
  getCoverColorForPlatform,
  getCoverSizeForPlatform,
  getCustomCoverRectForPlatform,
  loadPreferences,
  saveCoverColorForPlatform,
  saveCoverSizeForPlatform,
  saveCustomCoverRectForPlatform,
  savePreferences,
} from "@/lib/userPreferences";
import {
  clampCoverSize,
  COVER_SIZE_PRESETS,
  DEFAULT_COVER_SIZE,
  WATERMARK_PLATFORM_PRESETS,
  WHITE_BG_PLATFORM_IDS,
  type CoverSize,
  type WatermarkZone,
} from "@/lib/watermarkZones";
import {
  applyBackground,
  createCanvas,
  downloadDataUrl,
  drawImageToCanvas,
  fileToDataUrl,
  loadImage,
} from "@/lib/canvasUtils";
import {
  DEFAULT_SHOP_WATERMARK,
  type BackgroundSettings,
  type BackgroundType,
  type BatchImageItem,
  type ProcessingStatus,
  type CoverBlendMode,
  type ShopWatermarkSettings,
  type WatermarkRemovalMode,
} from "@/types";

function formatUserError(error: unknown, locale: Locale): string {
  if (isAiServiceUnavailable(error)) {
    return t(locale, "aiServiceUnavailable");
  }
  if (
    error instanceof Error &&
    (error.message === AI_SERVICE_UNAVAILABLE ||
      error.message.includes("AI 推理服务") ||
      error.message.includes("无法连接 AI"))
  ) {
    return t(locale, "aiServiceUnavailable");
  }
  if (error instanceof Error) return error.message;
  return t(locale, "statusWatermarkFail");
}

const DEFAULT_BACKGROUND: BackgroundSettings = {
  type: "transparent",
  solidColor: "#ffffff",
  gradientStart: "#ffffff",
  gradientEnd: "#e5e7eb",
  customColor: "#ffffff",
};

function createBatchItem(file: File, dataUrl: string): BatchImageItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    originalDataUrl: dataUrl,
    processedDataUrl: null,
    bgRemovedDataUrl: null,
    status: "pending",
  };
}

export default function KiriCutApp() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useState<Locale>("zh");
  const [batchItems, setBatchItems] = useState<BatchImageItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [licenseTick, setLicenseTick] = useState(0);
  const [quotaTick, setQuotaTick] = useState(0);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(
    null
  );
  const [watermarkZone, setWatermarkZone] = useState<WatermarkZone | null>(
    null
  );
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelsReady, setModelsReady] = useState(true);
  const [aiServiceOk, setAiServiceOk] = useState(true);
  const [preloadLabel, setPreloadLabel] = useState("AI 服务");
  const [backgroundSettings, setBackgroundSettings] =
    useState<BackgroundSettings>(DEFAULT_BACKGROUND);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [coverColor, setCoverColor] = useState("#ffffff");
  const [coverColorAutoLearn, setCoverColorAutoLearn] = useState(true);
  const [detectedCoverColor, setDetectedCoverColor] = useState<string | null>(
    null
  );
  const [learningCount, setLearningCount] = useState(0);
  const [learningConfidence, setLearningConfidence] = useState<
    "low" | "medium" | "high"
  >("low");
  const [coverSize, setCoverSize] = useState<CoverSize>(DEFAULT_COVER_SIZE);
  const [customCoverRect, setCustomCoverRect] =
    useState<CoverZoneRect | null>(null);
  const [coverColorPickMode, setCoverColorPickMode] = useState(false);
  const [shopWatermark, setShopWatermark] =
    useState<ShopWatermarkSettings>(DEFAULT_SHOP_WATERMARK);
  const [watermarkRemovalMode, setWatermarkRemovalMode] =
    useState<WatermarkRemovalMode>("ai");
  const [coverBlendMode, setCoverBlendMode] =
    useState<CoverBlendMode>("feather-ai");
  const [pendingBatchAction, setPendingBatchAction] = useState<
    "remove" | "pipeline" | null
  >(null);
  const [batchProgressCurrent, setBatchProgressCurrent] = useState(0);
  const manualColorOverrideItemId = useRef<string | null>(null);
  const [exportSizeMode, setExportSizeMode] =
    useState<ExportSizeMode>("platform");
  const [customExportSize, setCustomExportSize] = useState<ExportSize>({
    width: 1000,
    height: 1000,
  });

  const activeItem = batchItems[activeIndex] ?? null;
  const isBatchMode = batchItems.length > 1;
  const licenseInfo = useMemo(() => getLicenseSummary(), [licenseTick]);
  const dailyUsed = useMemo(() => getDailyUsed(), [quotaTick, licenseTick]);
  const dailyLimit = licenseInfo.isPro ? null : PRICING.freeDailyQuota;

  const ensureCanProcess = useCallback(
    (requested: number): boolean => {
      const check = canProcess(requested);
      if (check.ok) return true;
      if (check.reason === "daily_quota") {
        setStatusMessage(
          t(locale, "proQuotaDailyReached", {
            used: check.used,
            limit: check.limit,
          })
        );
      } else {
        setStatusMessage(
          t(locale, "proQuotaBatchLimit", {
            limit: check.limit,
            requested: check.requested,
            proLimit: PRICING.proMaxBatch,
          })
        );
      }
      setShowUpgradeModal(true);
      return false;
    },
    [locale]
  );

  const originalImageDataUrl = activeItem?.originalDataUrl ?? null;
  const processedImageDataUrl = activeItem?.processedDataUrl ?? null;
  const bgRemovedDataUrl = activeItem?.bgRemovedDataUrl ?? null;
  const hasRemovedBackground = !!bgRemovedDataUrl;
  const [resultDisplayDataUrl, setResultDisplayDataUrl] = useState<
    string | null
  >(null);

  const batchDoneCount = useMemo(
    () => batchItems.filter((i) => i.status === "done").length,
    [batchItems]
  );

  const applyPlatformSettings = useCallback(
    (platformId: string, zone: WatermarkZone) => {
      const prefs = loadPreferences();
      const size = getCoverSizeForPlatform(prefs, platformId);
      const defaultColor = WHITE_BG_PLATFORM_IDS.has(platformId)
        ? "#ffffff"
        : prefs.coverColor;
      const color = getCoverColorForPlatform(prefs, platformId, defaultColor);
      const savedRect = getCustomCoverRectForPlatform(prefs, platformId);
      const zoneToUse =
        prefs.lastPlatformId === platformId && prefs.lastWatermarkZone
          ? prefs.lastWatermarkZone
          : zone;

      setSelectedPlatformId(platformId);
      setCoverSize(size);
      setCoverColor(color);

      if (platformId === "mercari") {
        setWatermarkZone("custom");
        const mercariRect =
          savedRect && Math.abs(savedRect.rotationDeg ?? 0) > 0.5
            ? savedRect
            : getDiagonalWatermarkPreset();
        setCustomCoverRect(mercariRect);
      } else if (zoneToUse === "auto") {
        setWatermarkZone(null);
        setCustomCoverRect(null);
      } else if (zoneToUse === "custom" && savedRect) {
        setWatermarkZone("custom");
        setCustomCoverRect(savedRect);
      } else {
        setWatermarkZone(zoneToUse);
        setCustomCoverRect(null);
      }
      return { size, color };
    },
    []
  );

  useEffect(() => {
    const prefs = loadPreferences();
    setLocale(prefs.locale);
    if (prefs.lastPlatformId) {
      const preset = WATERMARK_PLATFORM_PRESETS.find(
        (p) => p.id === prefs.lastPlatformId
      );
      if (preset) {
        applyPlatformSettings(preset.id, preset.zone);
      } else {
        setCoverColor(prefs.coverColor);
        setCoverSize(prefs.coverSize);
      }
    } else {
      setCoverColor(prefs.coverColor);
      setCoverSize(prefs.coverSize);
      if (
        prefs.lastWatermarkZone &&
        prefs.lastWatermarkZone !== "auto"
      ) {
        setWatermarkZone(prefs.lastWatermarkZone);
      }
    }
    setExportSizeMode(prefs.exportSizeMode);
    setCustomExportSize(prefs.customExportSize);
    setCoverColorAutoLearn(prefs.coverColorAutoLearn);
    setShopWatermark(prefs.shopWatermark);
    setWatermarkRemovalMode(prefs.watermarkRemovalMode);
    setCoverBlendMode(prefs.coverBlendMode);
    setPrefsLoaded(true);
  }, [applyPlatformSettings]);

  useEffect(() => {
    if (!prefsLoaded || watermarkRemovalMode !== "ai") return;
    let cancelled = false;
    setModelsReady(false);
    setPreloadLabel(t(locale, "aiModelPreload"));
    preloadLamaModel((percent) => {
      if (!cancelled) setModelProgress(percent);
    })
      .then(() => {
        if (!cancelled) {
          setModelsReady(true);
          setAiServiceOk(true);
          setModelProgress(100);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsReady(false);
          setAiServiceOk(false);
          setStatusMessage(t(locale, "aiServiceUnavailable"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [watermarkRemovalMode, prefsLoaded, locale]);

  const refreshLearningStats = useCallback(() => {
    const stats = getCoverColorLearningStats(selectedPlatformId);
    setLearningCount(stats.totalProcessed);
    setLearningConfidence(stats.confidence);
  }, [selectedPlatformId]);

  useEffect(() => {
    refreshLearningStats();
  }, [refreshLearningStats, selectedPlatformId]);

  const previewCoverColor =
    coverColorAutoLearn && detectedCoverColor
      ? detectedCoverColor
      : coverColor;

  const brandingPlacement = useMemo((): ShopBrandingPlacement | null => {
    if (!watermarkZone) return null;
    return {
      zone: watermarkZone,
      coverSize,
      customRect: customCoverRect,
    };
  }, [watermarkZone, coverSize, customCoverRect]);

  useEffect(() => {
    manualColorOverrideItemId.current = null;
  }, [activeIndex]);

  useEffect(() => {
    if (
      !coverColorAutoLearn ||
      !originalImageDataUrl ||
      !watermarkZone ||
      !prefsLoaded
    ) {
      setDetectedCoverColor(null);
      return;
    }

    if (
      activeItem &&
      manualColorOverrideItemId.current === activeItem.id
    ) {
      return;
    }

    let cancelled = false;
    setStatusMessage(t(locale, "statusCoverDetecting"));

    resolveCoverColorForImage(
      originalImageDataUrl,
      watermarkZone,
      coverSize,
      selectedPlatformId,
      coverColor,
      customCoverRect
    ).then((color) => {
      if (cancelled) return;
      setDetectedCoverColor(color);
      setStatusMessage(
        selectedPlatformId
          ? t(locale, "statusPlatformReady", {
              platform: getPlatformLabel(locale, selectedPlatformId),
              zone: getZoneLabelI18n(locale, watermarkZone),
            })
          : t(locale, "statusZoneSelected", {
              zone: getZoneLabelI18n(locale, watermarkZone),
            })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    coverColorAutoLearn,
    originalImageDataUrl,
    watermarkZone,
    coverSize,
    selectedPlatformId,
    coverColor,
    prefsLoaded,
    locale,
    activeIndex,
    activeItem,
    customCoverRect,
  ]);

  useEffect(() => {
    if (!prefsLoaded || !selectedPlatformId) return;
    setStatusMessage(
      t(locale, "rememberedPlatform", {
        platform: getPlatformLabel(locale, selectedPlatformId),
      })
    );
  }, [prefsLoaded, selectedPlatformId, locale]);

  const composeDisplayUrl = useCallback(
    async (
      processedUrl: string,
      foregroundUrl: string | null
    ): Promise<string> => {
      if (foregroundUrl) {
        let fg = foregroundUrl;
        if (brandingPlacement) {
          fg = await applyShopBranding(
            foregroundUrl,
            shopWatermark,
            brandingPlacement
          );
        }
        const img = await loadImage(fg);
        const fgCanvas = drawImageToCanvas(img);
        const composed = applyBackground(fgCanvas, backgroundSettings);
        return composed.toDataURL("image/png");
      }

      let url = processedUrl;
      if (brandingPlacement) {
        url = await applyShopBranding(
          processedUrl,
          shopWatermark,
          brandingPlacement
        );
      }
      return url;
    },
    [shopWatermark, brandingPlacement, backgroundSettings]
  );

  useEffect(() => {
    if (!processedImageDataUrl) {
      setResultDisplayDataUrl(null);
      return;
    }
    // 先立刻显示修图结果，避免合成层异步失败时右侧一直空白
    setResultDisplayDataUrl(processedImageDataUrl);
    let cancelled = false;
    composeDisplayUrl(processedImageDataUrl, bgRemovedDataUrl)
      .then((url) => {
        if (!cancelled) setResultDisplayDataUrl(url);
      })
      .catch((error) => {
        console.error("composeDisplayUrl failed:", error);
        if (!cancelled) setResultDisplayDataUrl(processedImageDataUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [processedImageDataUrl, bgRemovedDataUrl, composeDisplayUrl]);

  useEffect(() => {
    let cancelled = false;
    preloadAllModels(({ label, percent }) => {
      if (cancelled) return;
      setPreloadLabel(label);
      setModelProgress(percent);
    }).catch(() => {});
    preloadLamaModel((percent) => {
      if (!cancelled) setModelProgress(percent);
    })
      .then(() => {
        if (!cancelled) {
          setModelsReady(true);
          setAiServiceOk(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsReady(false);
          setAiServiceOk(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
    savePreferences({ locale: next });
  };

  const handlePlatformSelect = (platformId: string, zone: WatermarkZone) => {
    const { color } = applyPlatformSettings(platformId, zone);
    savePreferences({
      lastPlatformId: platformId,
      lastWatermarkZone: zone,
      coverColor: color,
    });
    setStatusMessage(
      t(locale, "statusPlatformReady", {
        platform: getPlatformLabel(locale, platformId),
        zone: getZoneLabelI18n(locale, zone),
      })
    );
  };

  const handleAutoDetectZone = async () => {
    if (!originalImageDataUrl) {
      setStatusMessage(t(locale, "statusUploadStep1"));
      return;
    }
    setStatusMessage(t(locale, "autoDetectRunning"));
    try {
      const { zone } = await detectBestWatermarkZone(originalImageDataUrl);
      if (!zone) {
        setWatermarkZone(null);
        setCustomCoverRect(null);
        setStatusMessage(t(locale, "autoDetectNone"));
        return;
      }
      setCustomCoverRect(null);
      setWatermarkZone(zone);
      const matched = WATERMARK_PLATFORM_PRESETS.find((p) => p.zone === zone);
      if (matched) setSelectedPlatformId(matched.id);
      savePreferences({
        lastWatermarkZone: zone,
        lastPlatformId: matched?.id ?? selectedPlatformId,
      });
      setStatusMessage(
        t(locale, "autoDetectFound", {
          zone: getZoneLabelI18n(locale, zone),
        })
      );
    } catch {
      setStatusMessage(t(locale, "autoDetectNone"));
    }
  };

  const handleWatermarkZoneChange = (zone: WatermarkZone) => {
    if (zone === "auto") {
      void handleAutoDetectZone();
      return;
    }
    setWatermarkZone(zone);
    const matched = WATERMARK_PLATFORM_PRESETS.find((p) => p.zone === zone);
    if (zone === "custom") {
      const prefs = loadPreferences();
      const saved = selectedPlatformId
        ? getCustomCoverRectForPlatform(prefs, selectedPlatformId)
        : null;
      setCustomCoverRect(
        saved ?? getDefaultCoverZoneRect("center", coverSize)
      );
    } else {
      setCustomCoverRect(null);
    }
    if (zone !== "custom") {
      setSelectedPlatformId(matched?.id ?? selectedPlatformId);
    }
    savePreferences({
      lastWatermarkZone: zone,
      lastPlatformId:
        zone === "custom"
          ? selectedPlatformId
          : (matched?.id ?? selectedPlatformId),
    });
    setStatusMessage(
      t(locale, "statusZoneSelected", {
        zone: getZoneLabelI18n(locale, zone),
      })
    );
  };

  const handleCoverZoneRectChange = (rect: CoverZoneRect) => {
    const next = clampCoverZoneRect(rect);
    setCustomCoverRect(next);
    setWatermarkZone("custom");
    if (selectedPlatformId) {
      saveCustomCoverRectForPlatform(selectedPlatformId, next);
      savePreferences({
        lastWatermarkZone: "custom",
        lastPlatformId: selectedPlatformId,
      });
    } else {
      savePreferences({ lastWatermarkZone: "custom" });
    }
  };

  const handleUpload = async (files: File[]) => {
    const maxBatch = getMaxBatchSize();
    const imageFiles = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, maxBatch);
    if (imageFiles.length === 0) return;

    if (files.filter((f) => f.type.startsWith("image/")).length > maxBatch) {
      setStatusMessage(
        t(locale, "proQuotaBatchLimit", {
          limit: maxBatch,
          requested: files.filter((f) => f.type.startsWith("image/")).length,
          proLimit: PRICING.proMaxBatch,
        })
      );
      if (!licenseInfo.isPro) setShowUpgradeModal(true);
    }

    try {
      const items: BatchImageItem[] = [];
      for (const file of imageFiles) {
        const dataUrl = await fileToDataUrl(file);
        items.push(createBatchItem(file, dataUrl));
      }
      setBatchItems(items);
      setActiveIndex(0);
      setPendingBatchAction(null);
      setBatchProgressCurrent(0);
      setBackgroundSettings(DEFAULT_BACKGROUND);

      if (imageFiles.length > 1) {
        setStatusMessage(
          watermarkZone && selectedPlatformId
            ? `${t(locale, "batchReadyWithSettings", {
                count: imageFiles.length,
                platform: getPlatformLabel(locale, selectedPlatformId),
              })} · ${t(locale, "fastPipelineHint")}`
            : t(locale, "batchReady", { count: imageFiles.length })
        );
      } else {
        setStatusMessage(
          watermarkZone && selectedPlatformId
            ? t(locale, "singleReadyWithSettings", {
                platform: getPlatformLabel(locale, selectedPlatformId),
              })
            : watermarkZone
              ? t(locale, "statusZoneSelected", {
                  zone: getZoneLabelI18n(locale, watermarkZone),
                })
              : t(locale, "statusUploaded")
        );
      }
    } catch {
      setStatusMessage(t(locale, "statusUploadFail"));
    }
  };

  const updateBatchItem = (
    id: string,
    patch: Partial<BatchImageItem>
  ) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleWatermarkRemovalModeChange = (mode: WatermarkRemovalMode) => {
    setWatermarkRemovalMode(mode);
    savePreferences({ watermarkRemovalMode: mode });
  };

  const handleCoverBlendModeChange = (mode: CoverBlendMode) => {
    setCoverBlendMode(mode);
    savePreferences({ coverBlendMode: mode });
  };

  const handleCornerRetouchPreset = () => {
    setWatermarkRemovalMode("ai");
    setWatermarkZone("bottom-right");
    const size = clampCoverSize(COVER_SIZE_PRESETS.small);
    setCoverSize(size);
    setCustomCoverRect(null);
    savePreferences({
      watermarkRemovalMode: "ai",
      lastWatermarkZone: "bottom-right",
      coverSize: size,
    });
    setStatusMessage(t(locale, "cornerRetouchReady"));
  };

  const handleDiagonalWatermarkPreset = () => {
    const preset = getDiagonalWatermarkPreset();
    setWatermarkRemovalMode("ai");
    setWatermarkZone("custom");
    setCustomCoverRect(preset);
    savePreferences({
      watermarkRemovalMode: "ai",
      lastWatermarkZone: "custom",
    });
    if (selectedPlatformId) {
      saveCustomCoverRectForPlatform(selectedPlatformId, preset);
    }
    setStatusMessage(t(locale, "diagonalWatermarkReady"));
  };

  const processOneWatermark = async (
    item: BatchImageItem,
    zone: WatermarkZone,
    size: CoverSize,
    onModelProgress?: (percent: number) => void
  ): Promise<string> => {
    const customRect = customCoverRect;
    /** 同一图多处水印：必须在上次结果上继续修，不能每次都从原图重来 */
    const sourceUrl = item.processedDataUrl ?? item.originalDataUrl;

    const anchorColor = coverColorAutoLearn
      ? await resolveCoverColorForImage(
          sourceUrl,
          zone,
          size,
          selectedPlatformId,
          coverColor,
          customRect
        )
      : coverColor;

    if (watermarkRemovalMode === "ai") {
      if (coverColorAutoLearn) {
        recordCoverColorLearning(selectedPlatformId, anchorColor, false);
      }
      return inpaintWatermarkZone(
        sourceUrl,
        zone,
        size,
        customRect,
        (percent) => {
          onModelProgress?.(percent);
          setModelProgress(percent);
          if (percent < 100) {
            setStatusMessage(
              t(locale, "aiProcessingProgress", { percent })
            );
          }
        },
        anchorColor
      );
    }

    if (coverColorAutoLearn) {
      recordCoverColorLearning(selectedPlatformId, anchorColor, false);
    }

    return fillWatermarkZone(
      sourceUrl,
      zone,
      anchorColor,
      size,
      customRect,
      coverBlendMode
    );
  };

  const handleShopWatermarkChange = (patch: Partial<ShopWatermarkSettings>) => {
    setShopWatermark((prev) => {
      const next = { ...prev, ...patch };
      savePreferences({ shopWatermark: next });
      return next;
    });
  };

  const handleCoverColorChange = (color: string) => {
    setCoverColor(color);
    if (coverColorAutoLearn) {
      setDetectedCoverColor(color);
      if (activeItem) {
        manualColorOverrideItemId.current = activeItem.id;
      }
    }
    recordCoverColorLearning(selectedPlatformId, color, true);
    refreshLearningStats();
    if (selectedPlatformId) {
      saveCoverColorForPlatform(selectedPlatformId, color);
    } else {
      savePreferences({ coverColor: color });
    }
  };

  const handleCoverColorAutoLearnChange = (enabled: boolean) => {
    setCoverColorAutoLearn(enabled);
    savePreferences({ coverColorAutoLearn: enabled });
    if (!enabled) {
      setDetectedCoverColor(null);
    }
  };

  const handleCoverEyedropper = () => {
    if (!originalImageDataUrl) return;
    setCoverColorPickMode(true);
    setStatusMessage(t(locale, "coverEyedropper"));
  };

  const handleCoverColorPicked = async (imgX: number, imgY: number) => {
    if (!originalImageDataUrl) return;
    setCoverColorPickMode(false);
    try {
      const color = await sampleColorAtPoint(
        originalImageDataUrl,
        imgX,
        imgY,
        2
      );
      handleCoverColorChange(color);
      setStatusMessage(
        t(locale, "statusCoverColorPicked", { color: color.toUpperCase() })
      );
    } catch {
      setStatusMessage(t(locale, "statusEyedropperCancel"));
    }
  };

  const handleExportSizeModeChange = (mode: ExportSizeMode) => {
    setExportSizeMode(mode);
    savePreferences({ exportSizeMode: mode });
  };

  const handleCustomExportSizeChange = (size: ExportSize) => {
    const next = clampExportSize(size);
    setCustomExportSize(next);
    savePreferences({ customExportSize: next });
  };

  const handleCoverSizeChange = (size: CoverSize) => {
    const next = clampCoverSize(size);
    setCoverSize(next);
    if (watermarkZone === "custom" && customCoverRect) {
      const nextRect = clampCoverZoneRect({
        ...customCoverRect,
        widthPercent: next.widthPercent,
        heightPercent: next.heightPercent,
      });
      setCustomCoverRect(nextRect);
      if (selectedPlatformId) {
        saveCustomCoverRectForPlatform(selectedPlatformId, nextRect);
      }
    }
    if (selectedPlatformId) {
      saveCoverSizeForPlatform(selectedPlatformId, next);
    } else {
      savePreferences({ coverSize: next });
    }
  };

  const processWatermarkTargets = async (
    targets: BatchImageItem[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ successes: { fileName: string; dataUrl: string }[]; failed: number }> => {
    if (!watermarkZone) return { successes: [], failed: 0 };

    const successes: { fileName: string; dataUrl: string }[] = [];
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      const current = i + 1;
      onProgress?.(current, targets.length);
      setBatchProgressCurrent(current);
      updateBatchItem(item.id, { status: "processing", error: undefined });

      try {
        const coverOnly = await processOneWatermark(
          item,
          watermarkZone,
          coverSize,
          (percent) => {
            setModelProgress(percent);
            if (percent < 100) {
              setStatusMessage(
                t(locale, "aiProcessingProgress", { percent })
              );
            }
          }
        );
        if (!coverOnly?.startsWith("data:image")) {
          throw new Error(t(locale, "statusWatermarkFail"));
        }
        // 先保存修图结果，店铺标失败也不丢图
        updateBatchItem(item.id, {
          status: "done",
          processedDataUrl: coverOnly,
          bgRemovedDataUrl: null,
        });
        setResultDisplayDataUrl(coverOnly);

        let result = coverOnly;
        if (brandingPlacement) {
          try {
            result = await applyShopBranding(
              coverOnly,
              shopWatermark,
              brandingPlacement
            );
          } catch (brandingError) {
            console.warn("applyShopBranding failed, using cover only:", brandingError);
          }
        }
        successes.push({ fileName: item.fileName, dataUrl: result });
      } catch (error) {
        failed++;
        updateBatchItem(item.id, {
          status: "error",
          error: formatUserError(error, locale),
        });
      }
    }

    return { successes, failed };
  };

  const executeRemoveWatermark = async () => {
    if (!watermarkZone || batchItems.length === 0) return;

    const targets = isBatchMode
      ? batchItems
      : [batchItems[activeIndex]].filter(Boolean);

    if (targets.length === 0) return;
    if (!ensureCanProcess(targets.length)) return;

    try {
      setStatus("inpainting");
      setBatchProgressCurrent(0);
      const continuingFromProcessed =
        !isBatchMode && !!targets[0]?.processedDataUrl;
      const { successes, failed } = await processWatermarkTargets(
        targets,
        (current, total) => {
          setStatusMessage(
            isBatchMode
              ? t(
                  locale,
                  watermarkRemovalMode === "ai"
                    ? "aiBatchProcessing"
                    : "batchProcessing",
                  { current, total }
                )
              : continuingFromProcessed
                ? t(locale, "statusWatermarkContinue", {
                    zone: getZoneLabelI18n(locale, watermarkZone),
                  })
                : watermarkRemovalMode === "ai"
                  ? t(locale, "processingWatermarkAi")
                  : t(locale, "statusProcessingZone", {
                      zone: getZoneLabelI18n(locale, watermarkZone),
                    })
          );
        }
      );

      if (successes.length > 0) {
        recordUsage(successes.length);
        setQuotaTick((n) => n + 1);
      }

      setStatus("idle");
      setBatchProgressCurrent(0);
      setModelProgress(0);

      if (failed > 0 && successes.length === 0) {
        setStatusMessage(t(locale, "statusWatermarkFail"));
      } else if (isBatchMode) {
        setStatusMessage(t(locale, "statusBatchDone", { count: successes.length }));
      } else if (continuingFromProcessed) {
        setStatusMessage(t(locale, "statusWatermarkDoneChain"));
      } else {
        setStatusMessage(t(locale, "statusWatermarkDone"));
      }
      refreshLearningStats();
    } catch (error) {
      setStatus("idle");
      setBatchProgressCurrent(0);
      setModelProgress(0);
      setStatusMessage(formatUserError(error, locale));
      if (isAiServiceUnavailable(error)) setAiServiceOk(false);
    }
  };

  const handleRemoveWatermark = () => {
    if (!watermarkZone || batchItems.length === 0) return;
    if (isBatchMode && batchItems.length > 1) {
      setPendingBatchAction("remove");
      return;
    }
    void executeRemoveWatermark();
  };

  const executeFastPipeline = async () => {
    if (!watermarkZone || batchItems.length === 0) return;

    const targets = isBatchMode ? batchItems : [batchItems[activeIndex]];
    if (targets.length === 0) return;
    if (!ensureCanProcess(targets.length)) return;

    try {
      setExportSizeMode("original");
      savePreferences({ exportSizeMode: "original" });
      setStatus("inpainting");
      setBatchProgressCurrent(0);

      const { successes, failed } = await processWatermarkTargets(
        targets,
        (current, total) => {
          setStatusMessage(
            watermarkRemovalMode === "ai"
              ? t(locale, "aiBatchProcessing", { current, total })
              : t(locale, "fastPipelineRunning", { current, total })
          );
        }
      );

      if (successes.length === 0) {
        setStatus("idle");
        setBatchProgressCurrent(0);
        setStatusMessage(t(locale, "statusWatermarkFail"));
        return;
      }

      recordUsage(successes.length);
      setQuotaTick((n) => n + 1);
      setStatusMessage(t(locale, "pipelinePackaging"));

      const platformTag = selectedPlatformId ?? "export";
      if (successes.length > 1) {
        await downloadImagesAsZip(
          successes,
          `kiricut-${platformTag}-original-${Date.now()}.zip`
        );
      } else {
        const name =
          targets[0]?.fileName.replace(/\.[^.]+$/, "") ?? "kiricut";
        downloadDataUrl(successes[0].dataUrl, `${name}-original.png`);
      }

      setStatus("idle");
      setBatchProgressCurrent(0);
      refreshLearningStats();
      setStatusMessage(
        failed > 0
          ? t(locale, "pipelineDonePartial", {
              count: successes.length,
              failed,
            })
          : t(locale, "pipelineDone", { count: successes.length })
      );
    } catch (error) {
      setStatus("idle");
      setBatchProgressCurrent(0);
      setModelProgress(0);
      setStatusMessage(formatUserError(error, locale));
      if (isAiServiceUnavailable(error)) setAiServiceOk(false);
    }
  };

  const handleFastPipeline = () => {
    if (!watermarkZone || batchItems.length === 0) return;
    if (isBatchMode && batchItems.length > 1) {
      setPendingBatchAction("pipeline");
      return;
    }
    void executeFastPipeline();
  };

  const handleConfirmBatch = () => {
    const action = pendingBatchAction;
    setPendingBatchAction(null);
    if (action === "remove") void executeRemoveWatermark();
    if (action === "pipeline") void executeFastPipeline();
  };

  const handleImportSettings = async (file: File) => {
    try {
      await importSettingsFromFile(file);
      setStatusMessage(t(locale, "settingsImportOk"));
      window.location.reload();
    } catch {
      setStatusMessage(t(locale, "statusUploadFail"));
    }
  };

  const handleRemoveBackground = async () => {
    if (!activeItem) return;
    const source = processedImageDataUrl ?? originalImageDataUrl;
    if (!source) return;
    if (!ensureCanProcess(1)) return;

    try {
      setStatus("removing-background");
      setModelProgress(0);
      setStatusMessage(t(locale, "aiProcessingBgHint"));

      const result = await removeImageBackground(source, (percent) => {
        setModelProgress(percent);
        setStatusMessage(t(locale, "aiProcessingProgress", { percent }));
      });
      const prevBg = activeItem.bgRemovedDataUrl;
      if (prevBg?.startsWith("blob:")) {
        URL.revokeObjectURL(prevBg);
      }
      updateBatchItem(activeItem.id, { bgRemovedDataUrl: result });
      recordUsage(1);
      setQuotaTick((n) => n + 1);
      setStatus("idle");
      setModelProgress(0);
      setStatusMessage(t(locale, "statusBgDone"));
    } catch (error) {
      setStatus("idle");
      setModelProgress(0);
      setStatusMessage(
        isAiServiceUnavailable(error)
          ? t(locale, "aiServiceUnavailable")
          : error instanceof Error
            ? error.message
            : t(locale, "statusBgFail")
      );
      if (isAiServiceUnavailable(error)) setAiServiceOk(false);
    }
  };

  const handleEyedropper = async () => {
    if (!processedImageDataUrl) return;

    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (
          window as Window & {
            EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
          }
        ).EyeDropper();
        const result = await eyeDropper.open();
        setBackgroundSettings((prev) => ({
          ...prev,
          type: "custom",
          customColor: result.sRGBHex,
        }));
      } catch {
        setStatusMessage(t(locale, "statusEyedropperCancel"));
      }
      return;
    }

    setStatusMessage(t(locale, "statusEyedropperPick"));
    const img = await loadImage(resultDisplayDataUrl ?? processedImageDataUrl);
    const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);

    const handler = (e: MouseEvent) => {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const hex = `#${[pixel[0], pixel[1], pixel[2]]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
      setBackgroundSettings((prev) => ({
        ...prev,
        type: "custom",
        customColor: hex,
      }));
      setStatusMessage(t(locale, "statusColorPicked", { color: hex }));
      document.body.removeChild(pickerCanvas);
    };

    const pickerCanvas = document.createElement("canvas");
    pickerCanvas.width = window.innerWidth;
    pickerCanvas.height = window.innerHeight;
    pickerCanvas.style.cssText =
      "position:fixed;inset:0;z-index:9999;cursor:crosshair;opacity:0.01";
    pickerCanvas.addEventListener("click", handler, { once: true });
    document.body.appendChild(pickerCanvas);

    setTimeout(() => {
      if (document.body.contains(pickerCanvas)) {
        document.body.removeChild(pickerCanvas);
      }
    }, 5000);
  };

  const exportForDownload = async (item: BatchImageItem): Promise<string> => {
    if (!item.processedDataUrl) {
      throw new Error("No processed image");
    }
    const composed = await composeDisplayUrl(
      item.processedDataUrl,
      item.bgRemovedDataUrl
    );
    return prepareExportDataUrl(
      composed,
      exportSizeMode,
      selectedPlatformId,
      customExportSize
    );
  };

  const getExportFilenameSuffix = (): string => {
    const target = resolveExportSize(
      exportSizeMode,
      selectedPlatformId,
      customExportSize
    );
    if (!target) return "original";
    return `${target.width}x${target.height}`;
  };

  const handleDownload = async () => {
    const downloadable = batchItems.filter((i) => i.processedDataUrl);
    const sizeSuffix = getExportFilenameSuffix();
    const platformTag = selectedPlatformId ?? "export";

    try {
      if (isBatchMode && downloadable.length > 1) {
        const exportedItems = await Promise.all(
          downloadable.map(async (item) => ({
            fileName: item.fileName,
            dataUrl: await exportForDownload(item),
          }))
        );
        await downloadImagesAsZip(
          exportedItems,
          `kiricut-${platformTag}-${sizeSuffix}-${Date.now()}.zip`
        );
        return;
      }

      const downloadItem =
        activeItem?.processedDataUrl ? activeItem : downloadable[0];
      if (downloadItem?.processedDataUrl) {
        const exported = await exportForDownload(downloadItem);
        const name =
          activeItem?.fileName.replace(/\.[^.]+$/, "") ?? "kiricut";
        downloadDataUrl(exported, `${name}-${sizeSuffix}.png`);
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : t(locale, "statusUploadFail")
      );
    }
  };

  const isProcessing =
    status !== "idle" && status !== "preloading-models";

  const bottomStepHint = !originalImageDataUrl
    ? 1
    : !processedImageDataUrl
      ? 2
      : 3;

  return (
    <div
      ref={workspaceRef}
      className="flex h-[100dvh] w-screen flex-col md:h-screen md:flex-row"
    >
      {pendingBatchAction && isBatchMode && (
        <BatchConfirmDialog
          locale={locale}
          count={batchItems.length}
          action={pendingBatchAction}
          previewColor={previewCoverColor}
          onConfirm={handleConfirmBatch}
          onCancel={() => setPendingBatchAction(null)}
        />
      )}
      <UpgradeProModal
        locale={locale}
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onOpenSupport={() => {
          setShowUpgradeModal(false);
          setShowSupportModal(true);
        }}
        onActivated={() => {
          setLicenseTick((n) => n + 1);
          setQuotaTick((n) => n + 1);
        }}
      />
      <SupportContactModal
        locale={locale}
        open={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
      <section className="relative flex-1 min-h-[48dvh] bg-white md:min-h-0 md:w-[68%]">
        <ImageViewer
          locale={locale}
          originalImageDataUrl={originalImageDataUrl}
          processedImageDataUrl={processedImageDataUrl}
          resultDisplayDataUrl={resultDisplayDataUrl}
          hasProcessedResult={!!processedImageDataUrl}
          hasImage={batchItems.length > 0}
          hasRemovedBackground={hasRemovedBackground}
          isProcessing={isProcessing}
          processingStatus={status}
          modelProgress={modelProgress}
          backgroundType={backgroundSettings.type}
          watermarkZone={watermarkZone}
          coverColor={previewCoverColor}
          coverSize={coverSize}
          customCoverRect={customCoverRect}
          editableCoverZone={
            !!watermarkZone && watermarkZone !== "auto"
          }
          coverColorPickMode={coverColorPickMode}
          onCoverZoneRectChange={handleCoverZoneRectChange}
          onCoverColorPicked={handleCoverColorPicked}
          activeStep={bottomStepHint}
          batchItems={batchItems}
          activeIndex={activeIndex}
          batchProgressCurrent={batchProgressCurrent}
          learningCount={learningCount}
          learningConfidence={learningConfidence}
          selectedPlatformId={selectedPlatformId}
          onUpload={handleUpload}
          onSelectBatchItem={setActiveIndex}
          onFastPipeline={
            watermarkZone && isBatchMode ? handleFastPipeline : undefined
          }
          workspaceRef={workspaceRef}
        />
      </section>

      <aside className="flex max-h-[46dvh] min-h-0 shrink-0 flex-col overflow-hidden border-t border-white/10 md:max-h-none md:h-full md:w-[min(100%,22rem)] md:max-w-[22rem] md:min-w-[17.5rem] md:border-t-0">
        <ControlPanel
          locale={locale}
          onLocaleChange={handleLocaleChange}
          hasImage={batchItems.length > 0}
          batchCount={batchItems.length}
          batchDoneCount={batchDoneCount}
          isBatchMode={isBatchMode}
          hasProcessedResult={batchDoneCount > 0 || !!processedImageDataUrl}
          hasRemovedBackground={hasRemovedBackground}
          aiServiceOk={aiServiceOk}
          modelsReady={modelsReady}
          preloadLabel={preloadLabel}
          status={status}
          statusMessage={statusMessage}
          modelProgress={modelProgress}
          backgroundSettings={backgroundSettings}
          watermarkZone={watermarkZone}
          coverColor={coverColor}
          previewCoverColor={previewCoverColor}
          coverColorAutoLearn={coverColorAutoLearn}
          detectedCoverColor={detectedCoverColor}
          learningCount={learningCount}
          learningConfidence={learningConfidence}
          coverColorPickMode={coverColorPickMode}
          coverSize={coverSize}
          customCoverRect={customCoverRect}
          selectedPlatformId={selectedPlatformId}
          onCoverColorChange={handleCoverColorChange}
          onCoverColorAutoLearnChange={handleCoverColorAutoLearnChange}
          onCoverEyedropper={handleCoverEyedropper}
          onCoverSizeChange={handleCoverSizeChange}
          onCoverZoneRectChange={handleCoverZoneRectChange}
          onPlatformSelect={handlePlatformSelect}
          onWatermarkZoneChange={handleWatermarkZoneChange}
          onAutoDetectZone={handleAutoDetectZone}
          onUpload={handleUpload}
          onRemoveWatermark={handleRemoveWatermark}
          onFastPipeline={handleFastPipeline}
          onRemoveBackground={handleRemoveBackground}
          onBackgroundTypeChange={(type) =>
            setBackgroundSettings((prev) => ({ ...prev, type }))
          }
          onBackgroundSettingsChange={(settings) =>
            setBackgroundSettings((prev) => ({ ...prev, ...settings }))
          }
          onEyedropper={handleEyedropper}
          onDownload={handleDownload}
          exportSizeMode={exportSizeMode}
          customExportSize={customExportSize}
          onExportSizeModeChange={handleExportSizeModeChange}
          onCustomExportSizeChange={handleCustomExportSizeChange}
          shopWatermark={shopWatermark}
          onShopWatermarkChange={handleShopWatermarkChange}
          watermarkRemovalMode={watermarkRemovalMode}
          onWatermarkRemovalModeChange={handleWatermarkRemovalModeChange}
          onCornerRetouchPreset={handleCornerRetouchPreset}
          onDiagonalWatermarkPreset={handleDiagonalWatermarkPreset}
          coverBlendMode={coverBlendMode}
          onCoverBlendModeChange={handleCoverBlendModeChange}
          onImportSettings={handleImportSettings}
          isPro={licenseInfo.isPro}
          proExpiresAt={licenseInfo.expiresAt}
          dailyUsed={dailyUsed}
          dailyLimit={dailyLimit}
          onOpenUpgrade={() => setShowUpgradeModal(true)}
          onOpenSupport={() => setShowSupportModal(true)}
        />
      </aside>
    </div>
  );
}
