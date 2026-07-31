"use client";

import { useRef, type ReactNode } from "react";
import ColorPalette from "./ColorPalette";
import SmartColorLearnPanel from "./SmartColorLearnPanel";
import {
  type Locale,
  getHintLabel,
  getPlatformExportNote,
  getPlatformLabel,
  getZoneLabelI18n,
  t,
} from "@/lib/i18n";
import {
  EXPORT_SIZE_QUICK_PRESETS,
  formatExportSizeLabel,
  getPlatformExportSpec,
  type ExportSize,
  type ExportSizeMode,
} from "@/lib/platformExport";
import { APP_VERSION, BUILD_SHA } from "@/lib/buildInfo";
import { BETA_SURVEY_URL, hasBetaSurveyLink } from "@/lib/betaFeedback";
import { downloadSettingsBundle } from "@/lib/settingsSync";
import {
  buildShopWatermarkText,
  hasShopLogoBranding,
  hasShopTextBranding,
} from "@/lib/shopWatermark";
import {
  clampCoverZoneRect,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";
import {
  COVER_SIZE_PRESETS,
  isCoverSizePreset,
  type CoverSize,
  WATERMARK_PLATFORM_PRESETS,
  type WatermarkZone,
} from "@/lib/watermarkZones";
import type {
  BackgroundSettings,
  BackgroundType,
  ProcessingStatus,
  ShopBrandingMode,
  ShopWatermarkSettings,
  ShopWatermarkPosition,
  CoverBlendMode,
  WatermarkRemovalMode,
} from "@/types";

const COVER_BLEND_MODES: CoverBlendMode[] = [
  "feather-ai",
  "feather",
  "flat",
];
const COVER_BLEND_LABEL_KEYS = {
  "feather-ai": "coverBlendFeatherAi",
  feather: "coverBlendFeather",
  flat: "coverBlendFlat",
} as const;
const COVER_BLEND_HINT_KEYS = {
  "feather-ai": "coverBlendFeatherAiHint",
  feather: "coverBlendFeatherHint",
  flat: "coverBlendFlatHint",
} as const;

const LOGO_MAX_BYTES = 1024 * 1024;
const BRANDING_MODES: ShopBrandingMode[] = ["text", "logo", "both"];
const BRANDING_MODE_LABEL_KEYS = {
  text: "shopBrandingMode_text",
  logo: "shopBrandingMode_logo",
  both: "shopBrandingMode_both",
} as const;

const ZONE_OPTION_KEYS = [
  { zone: "top-left" as const, labelKey: "zoneTopLeft" as const, descKey: "zoneTopLeftDesc" as const },
  { zone: "bottom-right" as const, labelKey: "zoneBottomRight" as const, descKey: "zoneBottomRightDesc" as const },
  { zone: "center" as const, labelKey: "zoneCenter" as const, descKey: "zoneCenterDesc" as const },
  { zone: "custom" as const, labelKey: "zoneCustom" as const, descKey: "zoneCustomDesc" as const },
];

interface ControlPanelProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  hasImage: boolean;
  batchCount: number;
  batchDoneCount: number;
  isBatchMode: boolean;
  hasProcessedResult: boolean;
  hasRemovedBackground: boolean;
  aiServiceOk: boolean;
  modelsReady: boolean;
  preloadLabel: string;
  status: ProcessingStatus;
  statusMessage: string;
  modelProgress: number;
  backgroundSettings: BackgroundSettings;
  watermarkZone: WatermarkZone | null;
  coverColor: string;
  previewCoverColor: string;
  coverColorAutoLearn: boolean;
  detectedCoverColor: string | null;
  learningCount: number;
  learningConfidence: "low" | "medium" | "high";
  coverColorPickMode: boolean;
  coverSize: CoverSize;
  customCoverRect: CoverZoneRect | null;
  selectedPlatformId: string | null;
  onCoverColorChange: (color: string) => void;
  onCoverColorAutoLearnChange: (enabled: boolean) => void;
  onCoverEyedropper: () => void;
  onCoverSizeChange: (size: CoverSize) => void;
  onCoverZoneRectChange: (rect: CoverZoneRect) => void;
  onPlatformSelect: (platformId: string, zone: WatermarkZone) => void;
  onUpload: (files: File[]) => void;
  onWatermarkZoneChange: (zone: WatermarkZone) => void;
  onAutoDetectZone: () => void;
  onRemoveWatermark: () => void;
  onFastPipeline: () => void;
  onRemoveBackground: () => void;
  onBackgroundTypeChange: (type: BackgroundType) => void;
  onBackgroundSettingsChange: (settings: Partial<BackgroundSettings>) => void;
  onEyedropper: () => void;
  onDownload: () => void;
  exportSizeMode: ExportSizeMode;
  customExportSize: ExportSize;
  onExportSizeModeChange: (mode: ExportSizeMode) => void;
  onCustomExportSizeChange: (size: ExportSize) => void;
  shopWatermark: ShopWatermarkSettings;
  onShopWatermarkChange: (patch: Partial<ShopWatermarkSettings>) => void;
  watermarkRemovalMode: WatermarkRemovalMode;
  onWatermarkRemovalModeChange: (mode: WatermarkRemovalMode) => void;
  onCornerRetouchPreset: () => void;
  onDiagonalWatermarkPreset: () => void;
  coverBlendMode: CoverBlendMode;
  onCoverBlendModeChange: (mode: CoverBlendMode) => void;
  onImportSettings: (file: File) => void;
  isPro: boolean;
  proExpiresAt: string | null;
  dailyUsed: number;
  dailyLimit: number | null;
  onOpenUpgrade: () => void;
  onOpenSupport: () => void;
}

const STEP_ACCENTS = {
  violet: {
    badgeActive: "bg-gradient-to-br from-violet-500 to-indigo-600 ring-2 ring-violet-400/60 shadow-lg shadow-violet-500/30",
    badgeDone: "bg-gradient-to-br from-violet-600/80 to-indigo-700/80",
    badgePending: "bg-white/5 text-white/30",
    labelActive: "text-violet-300",
    labelDone: "text-violet-400/80",
    borderActive: "border-violet-500/50 shadow-lg shadow-violet-500/10",
    borderDone: "border-violet-600/30",
    header: "from-violet-500/10 to-indigo-500/5",
    tag: "bg-violet-500/20 text-violet-300 border border-violet-400/30",
  },
  rose: {
    badgeActive: "bg-gradient-to-br from-rose-500 to-pink-600 ring-2 ring-rose-400/60 shadow-lg shadow-rose-500/30",
    badgeDone: "bg-gradient-to-br from-rose-600/80 to-pink-700/80",
    badgePending: "bg-white/5 text-white/30",
    labelActive: "text-rose-300",
    labelDone: "text-rose-400/80",
    borderActive: "border-rose-500/50 shadow-lg shadow-rose-500/10",
    borderDone: "border-rose-600/30",
    header: "from-rose-500/10 to-pink-500/5",
    tag: "bg-rose-500/20 text-rose-300 border border-rose-400/30",
  },
  sky: {
    badgeActive: "bg-gradient-to-br from-sky-500 to-cyan-600 ring-2 ring-sky-400/60 shadow-lg shadow-sky-500/30",
    badgeDone: "bg-gradient-to-br from-sky-600/80 to-cyan-700/80",
    badgePending: "bg-white/5 text-white/30",
    labelActive: "text-sky-300",
    labelDone: "text-sky-400/80",
    borderActive: "border-sky-500/50 shadow-lg shadow-sky-500/10",
    borderDone: "border-sky-600/30",
    header: "from-sky-500/10 to-cyan-500/5",
    tag: "bg-sky-500/20 text-sky-300 border border-sky-400/30",
  },
  emerald: {
    badgeActive: "bg-gradient-to-br from-emerald-500 to-teal-600 ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/30",
    badgeDone: "bg-gradient-to-br from-emerald-600/80 to-teal-700/80",
    badgePending: "bg-white/5 text-white/30",
    labelActive: "text-emerald-300",
    labelDone: "text-emerald-400/80",
    borderActive: "border-emerald-500/50 shadow-lg shadow-emerald-500/10",
    borderDone: "border-emerald-600/30",
    header: "from-emerald-500/10 to-teal-500/5",
    tag: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
  },
} as const;

const TIP_KEYS = ["tip1", "tip2", "tip3", "tip4", "tip5"] as const;

type AccentKey = keyof typeof STEP_ACCENTS;
type StepState = "done" | "active" | "pending";

function getStepState(
  step: number,
  hasImage: boolean,
  hasProcessedResult: boolean,
  hasRemovedBackground: boolean
): StepState {
  if (step === 1) return !hasImage ? "active" : "done";
  if (step === 2) {
    if (!hasImage) return "pending";
    return !hasProcessedResult ? "active" : "done";
  }
  if (step === 3) {
    if (!hasProcessedResult) return "pending";
    return !hasRemovedBackground ? "active" : "done";
  }
  if (step === 4) return !hasProcessedResult ? "pending" : "active";
  return "pending";
}

function StepBadge({
  step,
  state,
  accent,
}: {
  step: number;
  state: StepState;
  accent: AccentKey;
}) {
  const a = STEP_ACCENTS[accent];
  const cls =
    state === "active"
      ? a.badgeActive
      : state === "done"
        ? a.badgeDone
        : a.badgePending;

  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${cls}`}
    >
      {state === "done" ? "✓" : step}
    </span>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[9px] font-semibold tracking-wide text-white/40 uppercase">
      {children}
    </p>
  );
}

function PanelBlock({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-2 ${className}`}>
      <PanelLabel>{label}</PanelLabel>
      {children}
    </div>
  );
}

function ChipBtn({
  active,
  onClick,
  disabled,
  title,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-[40px] rounded-md px-2 py-2 text-[10px] font-semibold leading-tight transition-all disabled:opacity-40 md:min-h-0 md:px-1.5 md:py-1 ${
        active
          ? "bg-white/14 text-white ring-1 ring-white/20"
          : "border border-white/8 bg-white/[0.03] text-white/55 hover:bg-white/8"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function FlowStep({
  step,
  title,
  hint,
  state,
  accent,
  doneLabel,
  activeLabel,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  state: StepState;
  accent: AccentKey;
  doneLabel: string;
  activeLabel: string;
  children: ReactNode;
}) {
  const a = STEP_ACCENTS[accent];
  const border =
    state === "active"
      ? a.borderActive
      : state === "done"
        ? a.borderDone
        : "border-white/8";

  return (
    <section
      className={`panel-glass overflow-hidden rounded-xl border ${border} ${
        state === "pending" ? "opacity-70" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b border-white/8 bg-gradient-to-r px-2.5 py-2 ${a.header}`}
      >
        <StepBadge step={step} state={state} accent={accent} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[11px] font-semibold text-white/95">
            {title}
          </h2>
          <p className="truncate text-[9px] text-white/40" title={hint}>
            {hint}
          </p>
        </div>
        {state === "done" && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-medium ${a.tag}`}
          >
            {doneLabel}
          </span>
        )}
        {state === "active" && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-medium ${a.tag}`}
          >
            {activeLabel}
          </span>
        )}
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}
    >
      <span className="w-10 shrink-0 text-xs text-white/50">{label}</span>
      <div
        className="h-8 w-8 shrink-0 rounded-lg border border-white/20 shadow-inner"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 min-w-0 flex-1 cursor-pointer rounded-lg border border-white/15 bg-white/5 disabled:cursor-not-allowed"
      />
      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-white/40">
        {value.toUpperCase()}
      </span>
    </label>
  );
}

export default function ControlPanel({
  locale,
  onLocaleChange,
  hasImage,
  batchCount,
  batchDoneCount,
  isBatchMode,
  hasProcessedResult,
  hasRemovedBackground,
  aiServiceOk,
  modelsReady,
  preloadLabel,
  status,
  statusMessage,
  modelProgress,
  backgroundSettings,
  watermarkZone,
  coverColor,
  previewCoverColor,
  coverColorAutoLearn,
  detectedCoverColor,
  learningCount,
  learningConfidence,
  coverColorPickMode,
  coverSize,
  customCoverRect,
  selectedPlatformId,
  onCoverColorChange,
  onCoverColorAutoLearnChange,
  onCoverEyedropper,
  onCoverSizeChange,
  onCoverZoneRectChange,
  onPlatformSelect,
  onUpload,
  onWatermarkZoneChange,
  onAutoDetectZone,
  onRemoveWatermark,
  onFastPipeline,
  onRemoveBackground,
  onBackgroundTypeChange,
  onBackgroundSettingsChange,
  onEyedropper,
  onDownload,
  exportSizeMode,
  customExportSize,
  onExportSizeModeChange,
  onCustomExportSizeChange,
  shopWatermark,
  onShopWatermarkChange,
  watermarkRemovalMode,
  onWatermarkRemovalModeChange,
  onCornerRetouchPreset,
  onDiagonalWatermarkPreset,
  coverBlendMode,
  onCoverBlendModeChange,
  onImportSettings,
  isPro,
  proExpiresAt,
  dailyUsed,
  dailyLimit,
  onOpenUpgrade,
  onOpenSupport,
}: ControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const settingsImportRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const isProcessing = status !== "idle";
  const stepState = (step: number): StepState =>
    getStepState(step, hasImage, hasProcessedResult, hasRemovedBackground);

  const isWatermarkDisabled =
    !hasImage ||
    isProcessing ||
    !watermarkZone ||
    watermarkZone === "auto" ||
    (watermarkRemovalMode === "ai" && (!modelsReady || !aiServiceOk));
  const isBackgroundDisabled =
    !hasImage || isProcessing || !modelsReady || !aiServiceOk;
  const isDownloadDisabled = !hasProcessedResult || isProcessing;
  const isBgSettingsDisabled = !hasRemovedBackground || isProcessing;
  const platformExportSpec = selectedPlatformId
    ? getPlatformExportSpec(selectedPlatformId)
    : null;
  const resolvedExportLabel =
    exportSizeMode === "original"
      ? null
      : exportSizeMode === "platform" && platformExportSpec
        ? formatExportSizeLabel(platformExportSpec)
        : formatExportSizeLabel(customExportSize);

  const workflow = [
    { step: 1, short: t(locale, "stepUpload"), accent: "violet" as const },
    { step: 2, short: t(locale, "stepWatermark"), accent: "rose" as const },
    { step: 3, short: t(locale, "stepBackground"), accent: "sky" as const },
    { step: 4, short: t(locale, "stepDownload"), accent: "emerald" as const },
  ];

  const backgroundTypes = [
    ["transparent", t(locale, "bgTransparent")],
    ["solid", t(locale, "bgSolid")],
    ["gradient", t(locale, "bgGradient")],
    ["custom", t(locale, "bgCustom")],
  ] as const;

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onUpload(Array.from(list));
  };

  const defaultStatus =
    hasImage && watermarkZone
      ? t(locale, "statusZoneSelected", {
          zone: getZoneLabelI18n(locale, watermarkZone),
        })
      : hasImage
        ? t(locale, "statusUploaded")
        : t(locale, "statusUploadStep1");

  return (
    <div className="panel-shell flex h-full flex-col text-white">
      <header className="panel-header-glow shrink-0 border-b border-white/8 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-black shadow-md shadow-violet-500/25">
              K
            </div>
            <div className="min-w-0">
              <h1 className="panel-title-gradient truncate text-sm font-bold tracking-tight">
                キリカット
              </h1>
              <p className="truncate text-[9px] text-white/45">
                {t(locale, "appSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => onLocaleChange("zh")}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                locale === "zh"
                  ? "bg-violet-600 text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {t(locale, "langZh")}
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange("ja")}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                locale === "ja"
                  ? "bg-violet-600 text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {t(locale, "langJa")}
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange("en")}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                locale === "en"
                  ? "bg-violet-600 text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {t(locale, "langEn")}
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {isPro ? (
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="min-w-0 flex-1 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2 py-1.5 text-left"
            >
              <span className="text-[10px] font-bold text-emerald-200">
                {t(locale, "proBadge")}
              </span>
              {proExpiresAt && (
                <span className="ml-1.5 text-[9px] text-emerald-200/70">
                  {t(locale, "proActiveUntil", { date: proExpiresAt })}
                </span>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1.5 text-[10px] font-bold text-black shadow-md shadow-amber-500/25"
              >
                {t(locale, "proUpgradeBtn")}
              </button>
              {dailyLimit !== null && (
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold text-white/55">
                  {t(locale, "proQuotaBadge", {
                    used: dailyUsed,
                    limit: dailyLimit,
                  })}
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onOpenSupport}
            className="shrink-0 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100"
          >
            {t(locale, "supportBtn")}
          </button>
        </div>
      </header>

      <div className="panel-progress-track shrink-0 border-b border-white/8 px-3 py-2">
        <div className="flex items-center justify-between gap-0.5">
          {workflow.map((item, index) => {
            const state = stepState(item.step);
            const a = STEP_ACCENTS[item.accent];
            return (
              <div key={item.step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-0.5">
                  <StepBadge
                    step={item.step}
                    state={state}
                    accent={item.accent}
                  />
                  <span
                    className={`max-w-[3.5rem] truncate text-center text-[8px] font-semibold ${
                      state === "active"
                        ? a.labelActive
                        : state === "done"
                          ? a.labelDone
                          : "text-white/25"
                    }`}
                  >
                    {item.short}
                  </span>
                </div>
                {index < workflow.length - 1 && (
                  <div
                    className={`mx-0.5 mb-3 h-px flex-1 rounded-full ${
                      state === "done"
                        ? "bg-gradient-to-r from-white/20 to-white/10"
                        : "bg-white/8"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        <div className="panel-glass rounded-lg px-2.5 py-2">
          <p className="text-[9px] font-semibold text-cyan-400/75 uppercase">
            {t(locale, "statusTitle")}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/80">
            {statusMessage || defaultStatus}
          </p>
          {(status === "preloading-models" ||
            status === "downloading-model" ||
            status === "inpainting" ||
            status === "removing-background") &&
            modelProgress >= 0 && (
              <div className="mt-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="ai-progress-bar h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, modelProgress)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/50">
                  {status === "inpainting"
                    ? t(locale, "aiProcessingProgress", {
                        percent: modelProgress,
                      })
                    : status === "removing-background"
                      ? t(locale, "aiProcessingProgress", {
                          percent: modelProgress,
                        })
                      : `${preloadLabel} ${modelProgress}%`}
                </p>
              </div>
            )}
        </div>

        {!aiServiceOk && (
          <div className="panel-tips-glow rounded-lg px-2.5 py-2 text-[10px] leading-snug text-amber-100">
            {t(locale, "aiServiceUnavailable")}
          </div>
        )}

        <details className="panel-tips-glow group rounded-lg" open>
          <summary className="cursor-pointer list-none px-2.5 py-2 text-[10px] font-semibold text-amber-200/90 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-1">
              <span>💡 {t(locale, "tipsTitle")}</span>
              <span className="text-[8px] text-amber-300/70 group-open:hidden">
                {t(locale, "tipsExpand")}
              </span>
            </span>
          </summary>
          <ul className="space-y-1 border-t border-amber-400/20 px-2.5 py-2">
            {TIP_KEYS.map((key) => (
              <li
                key={key}
                className="text-[9px] leading-snug text-amber-100/70"
              >
                · {t(locale, key)}
              </li>
            ))}
          </ul>
        </details>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          disabled={isProcessing}
        />
        <input
          ref={batchInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          disabled={isProcessing}
        />

        <FlowStep
          step={1}
          title={t(locale, "step1Title")}
          hint={t(locale, "step1Hint")}
          state={stepState(1)}
          accent="violet"
          doneLabel={t(locale, "done")}
          activeLabel={t(locale, "current")}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="btn-panel-primary rounded-lg px-2 py-2 text-[10px] font-bold text-white transition-all disabled:opacity-40"
            >
              {hasImage ? t(locale, "changeImage") : t(locale, "chooseUpload")}
            </button>
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              disabled={isProcessing}
              className="rounded-lg border border-violet-400/35 bg-violet-500/12 px-2 py-2 text-[10px] font-semibold text-violet-200 transition-all hover:bg-violet-500/20 disabled:opacity-40"
            >
              {t(locale, "chooseBatchUpload")}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] text-violet-300/55">
            {isBatchMode
              ? selectedPlatformId && watermarkZone
                ? t(locale, "batchReadyWithSettings", {
                    count: batchCount,
                    platform: getPlatformLabel(locale, selectedPlatformId),
                  })
                : t(locale, "batchReady", { count: batchCount })
              : hasImage
                ? t(locale, "imageReady")
                : t(locale, "afterUpload")}
          </p>
        </FlowStep>

        <FlowStep
          step={2}
          title={t(locale, "step2Title")}
          hint={t(locale, "step2Hint")}
          state={stepState(2)}
          accent="rose"
          doneLabel={t(locale, "done")}
          activeLabel={t(locale, "current")}
        >
          {!hasImage ? (
            <p className="text-center text-[11px] text-white/30">
              {t(locale, "completeStep1")}
            </p>
          ) : (
            <>
              <PanelBlock label={t(locale, "platformQuick")}>
                <div className="grid grid-cols-4 gap-1">
                  {WATERMARK_PLATFORM_PRESETS.map((preset) => {
                    const selected = selectedPlatformId === preset.id;
                    return (
                      <ChipBtn
                        key={preset.id}
                        active={selected}
                        title={t(locale, "watermarkAt", {
                          hint: getHintLabel(locale, preset.hint),
                        })}
                        onClick={() =>
                          onPlatformSelect(preset.id, preset.zone)
                        }
                        className={
                          selected
                            ? "!bg-gradient-to-br !from-rose-500 !to-pink-600 !text-white !ring-rose-400/50"
                            : ""
                        }
                      >
                        {getPlatformLabel(locale, preset.id)}
                      </ChipBtn>
                    );
                  })}
                </div>
              </PanelBlock>

              <PanelBlock label={t(locale, "removalModeTitle")}>
                <div className="mb-1 grid grid-cols-2 gap-1">
                  <ChipBtn
                    title={t(locale, "cornerRetouchPresetHint")}
                    onClick={onCornerRetouchPreset}
                    className="!border-violet-400/30 !bg-violet-500/10 !text-violet-100"
                  >
                    {t(locale, "cornerRetouchPreset")}
                  </ChipBtn>
                  <ChipBtn
                    title={t(locale, "diagonalWatermarkPresetHint")}
                    onClick={onDiagonalWatermarkPreset}
                    className="!border-amber-400/30 !bg-amber-500/10 !text-amber-100"
                  >
                    {t(locale, "diagonalWatermarkPreset")}
                  </ChipBtn>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <ChipBtn
                    active={watermarkRemovalMode === "ai"}
                    title={t(locale, "removalModeAiHint")}
                    onClick={() => onWatermarkRemovalModeChange("ai")}
                    className={
                      watermarkRemovalMode === "ai"
                        ? "!border-violet-400/40 !bg-violet-500/20 !text-violet-100"
                        : ""
                    }
                  >
                    {t(locale, "removalModeAi")} ★
                  </ChipBtn>
                  <ChipBtn
                    active={watermarkRemovalMode === "cover"}
                    title={t(locale, "removalModeCoverHint")}
                    onClick={() => onWatermarkRemovalModeChange("cover")}
                    className={
                      watermarkRemovalMode === "cover"
                        ? "!border-rose-400/40 !bg-rose-500/20 !text-rose-100"
                        : ""
                    }
                  >
                    {t(locale, "removalModeCover")}
                  </ChipBtn>
                </div>
              </PanelBlock>
              {watermarkRemovalMode === "ai" && !modelsReady && (
                <p className="mb-1 text-[9px] text-violet-300/75">
                  {t(locale, "statusAiModelLoading")} {modelProgress}%
                </p>
              )}

              <SmartColorLearnPanel
                locale={locale}
                hasImage={hasImage}
                isProcessing={isProcessing}
                coverColorAutoLearn={coverColorAutoLearn}
                onCoverColorAutoLearnChange={onCoverColorAutoLearnChange}
                previewCoverColor={previewCoverColor}
                coverColor={coverColor}
                learningCount={learningCount}
                learningConfidence={learningConfidence}
                selectedPlatformId={selectedPlatformId}
                isBatchMode={isBatchMode}
                batchCount={batchCount}
                coverColorPickMode={coverColorPickMode}
                onCoverColorChange={onCoverColorChange}
                onCoverEyedropper={onCoverEyedropper}
              />

              <PanelBlock
                label={t(locale, "manualZone")}
                className="mb-1.5"
              >
                <div className="mb-1 grid grid-cols-4 gap-0.5">
                  {ZONE_OPTION_KEYS.map((option) => (
                    <ChipBtn
                      key={option.zone}
                      active={watermarkZone === option.zone}
                      title={t(locale, option.descKey)}
                      onClick={() => onWatermarkZoneChange(option.zone)}
                      className={
                        watermarkZone === option.zone
                          ? "!bg-gradient-to-b !from-rose-500 !to-pink-600 !text-white"
                          : ""
                      }
                    >
                      {t(locale, option.labelKey)}
                    </ChipBtn>
                  ))}
                </div>
                <ChipBtn
                  title={t(locale, "zoneAutoDesc")}
                  onClick={onAutoDetectZone}
                  className="w-full !border-cyan-400/30 !bg-cyan-500/12 !text-cyan-100"
                >
                  {t(locale, "autoDetectZone")}
                </ChipBtn>
                <p className="mt-1 text-[8px] text-white/30">
                  {t(locale, "dragZoneHint")}
                </p>
              </PanelBlock>

              <PanelBlock label={t(locale, "coverSize")}>
                <div className="mb-1 grid grid-cols-3 gap-0.5">
                  {(
                    [
                      ["small", "coverSizeSmall"],
                      ["medium", "coverSizeMedium"],
                      ["large", "coverSizeLarge"],
                    ] as const
                  ).map(([preset, labelKey]) => (
                    <ChipBtn
                      key={preset}
                      active={isCoverSizePreset(coverSize, preset)}
                      onClick={() =>
                        onCoverSizeChange(COVER_SIZE_PRESETS[preset])
                      }
                      className={
                        isCoverSizePreset(coverSize, preset)
                          ? "!bg-gradient-to-b !from-rose-500 !to-pink-600 !text-white"
                          : ""
                      }
                    >
                      {t(locale, labelKey)}
                    </ChipBtn>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 flex justify-between text-[8px] text-white/45">
                      <span>{t(locale, "coverWidth")}</span>
                      <span className="font-mono text-rose-200/80">
                        {Math.round(coverSize.widthPercent * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={6}
                      max={45}
                      step={1}
                      value={Math.round(coverSize.widthPercent * 100)}
                      onChange={(e) =>
                        onCoverSizeChange({
                          ...coverSize,
                          widthPercent: Number(e.target.value) / 100,
                        })
                      }
                      className="h-1 w-full cursor-pointer accent-rose-400"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 flex justify-between text-[8px] text-white/45">
                      <span>{t(locale, "coverHeight")}</span>
                      <span className="font-mono text-rose-200/80">
                        {Math.round(coverSize.heightPercent * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={35}
                      step={1}
                      value={Math.round(coverSize.heightPercent * 100)}
                      onChange={(e) =>
                        onCoverSizeChange({
                          ...coverSize,
                          heightPercent: Number(e.target.value) / 100,
                        })
                      }
                      className="h-1 w-full cursor-pointer accent-rose-400"
                    />
                  </div>
                </div>
              </PanelBlock>

              {watermarkZone === "custom" && customCoverRect && (
                <PanelBlock label={t(locale, "coverZoneRotation")}>
                  <div className="rounded-lg border border-amber-400/25 bg-amber-500/8 p-2">
                    <label className="mb-1 flex justify-between text-[8px] text-white/45">
                      <span title={t(locale, "coverZoneRotationHint")}>
                        {t(locale, "coverZoneRotation")}
                      </span>
                      <span className="font-mono text-amber-200/90">
                        {customCoverRect.rotationDeg ?? 0}°
                      </span>
                    </label>
                    <input
                      type="range"
                      min={-75}
                      max={75}
                      step={1}
                      value={customCoverRect.rotationDeg ?? 0}
                      onChange={(e) =>
                        onCoverZoneRectChange(
                          clampCoverZoneRect({
                            ...customCoverRect,
                            rotationDeg: Number(e.target.value),
                          })
                        )
                      }
                      className="mb-2 h-1 w-full cursor-pointer accent-amber-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-0.5 flex justify-between text-[8px] text-white/45">
                          <span>{t(locale, "coverZoneWidthCustom")}</span>
                          <span className="font-mono text-amber-200/80">
                            {Math.round(customCoverRect.widthPercent * 100)}%
                          </span>
                        </label>
                        <input
                          type="range"
                          min={8}
                          max={92}
                          step={1}
                          value={Math.round(
                            customCoverRect.widthPercent * 100
                          )}
                          onChange={(e) =>
                            onCoverZoneRectChange(
                              clampCoverZoneRect({
                                ...customCoverRect,
                                widthPercent: Number(e.target.value) / 100,
                              })
                            )
                          }
                          className="h-1 w-full cursor-pointer accent-amber-400"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 flex justify-between text-[8px] text-white/45">
                          <span>{t(locale, "coverZoneHeightCustom")}</span>
                          <span className="font-mono text-amber-200/80">
                            {Math.round(customCoverRect.heightPercent * 100)}%
                          </span>
                        </label>
                        <input
                          type="range"
                          min={6}
                          max={58}
                          step={1}
                          value={Math.round(
                            customCoverRect.heightPercent * 100
                          )}
                          onChange={(e) =>
                            onCoverZoneRectChange(
                              clampCoverZoneRect({
                                ...customCoverRect,
                                heightPercent: Number(e.target.value) / 100,
                              })
                            )
                          }
                          className="h-1 w-full cursor-pointer accent-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                </PanelBlock>
              )}

              {watermarkRemovalMode === "cover" && (
              <PanelBlock label={`${t(locale, "coverColor")} · ${t(locale, "coverBlendTitle")}`}>
              <div className="space-y-2">
              <div className="grid grid-cols-3 gap-0.5">
                {COVER_BLEND_MODES.map((mode) => (
                  <ChipBtn
                    key={mode}
                    active={coverBlendMode === mode}
                    title={t(locale, COVER_BLEND_HINT_KEYS[mode])}
                    onClick={() => onCoverBlendModeChange(mode)}
                    className={
                      coverBlendMode === mode
                        ? "!bg-rose-500/35 !text-rose-100"
                        : ""
                    }
                  >
                    {t(locale, COVER_BLEND_LABEL_KEYS[mode])}
                  </ChipBtn>
                ))}
              </div>
              <p className="text-[8px] leading-snug text-amber-200/75">
                {t(locale, COVER_BLEND_HINT_KEYS[coverBlendMode])}
              </p>
              <p className="text-[8px] leading-snug text-white/35">
                {t(locale, "coverBlendHint")}
              </p>

              {!coverColorAutoLearn && detectedCoverColor && (
                <p className="text-[10px] text-amber-300/70">
                  {t(locale, "coverManualOverride")}
                </p>
              )}
              </div>
              </PanelBlock>
              )}

              <PanelBlock label={t(locale, "shopWatermarkTitle")}>
              <div className="space-y-1.5">
              <p className="text-[8px] text-white/35">{t(locale, "shopWatermarkHint")}</p>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={shopWatermark.enabled}
                  onChange={(e) =>
                    onShopWatermarkChange({ enabled: e.target.checked })
                  }
                  className="accent-rose-400"
                />
                <span className="text-[10px] font-semibold text-white/70">
                  {t(locale, "shopWatermarkEnable")}
                </span>
              </label>
              {shopWatermark.enabled && (
                <div className="space-y-1.5 rounded-md border border-rose-500/15 bg-rose-500/5 p-2">
                  <p className="text-[10px] font-semibold text-white/55">
                    {t(locale, "shopBrandingMode")}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {BRANDING_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          onShopWatermarkChange({ brandingMode: mode })
                        }
                        className={`rounded-lg px-1 py-1.5 text-[9px] font-semibold ${
                          shopWatermark.brandingMode === mode
                            ? "bg-rose-500/40 text-rose-100"
                            : "bg-white/5 text-white/50"
                        }`}
                      >
                        {t(locale, BRANDING_MODE_LABEL_KEYS[mode])}
                      </button>
                    ))}
                  </div>

                  {(shopWatermark.brandingMode === "text" ||
                    shopWatermark.brandingMode === "both") && (
                    <>
                      <input
                        type="text"
                        value={shopWatermark.shopName}
                        placeholder={t(locale, "shopWatermarkName")}
                        onChange={(e) =>
                          onShopWatermarkChange({ shopName: e.target.value })
                        }
                        className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white"
                      />
                      {!hasShopTextBranding(shopWatermark) && (
                        <p className="text-[10px] text-amber-300/80">
                          {t(locale, "shopWatermarkNeedName")}
                        </p>
                      )}
                      <label className="flex items-center gap-2 text-[10px] text-white/60">
                        <input
                          type="checkbox"
                          checked={shopWatermark.includeDate}
                          onChange={(e) =>
                            onShopWatermarkChange({
                              includeDate: e.target.checked,
                            })
                          }
                          className="accent-rose-400"
                        />
                        {t(locale, "shopWatermarkDate")}
                      </label>
                      <p className="text-[10px] text-white/50">
                        {t(locale, "shopWatermarkPosition")}
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["bottom-left", "posBottomLeft"],
                            ["bottom-right", "posBottomRight"],
                            ["top-left", "posTopLeft"],
                            ["top-right", "posTopRight"],
                          ] as const
                        ).map(([pos, key]) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() =>
                              onShopWatermarkChange({
                                position: pos as ShopWatermarkPosition,
                              })
                            }
                            className={`rounded px-1 py-1 text-[9px] font-semibold ${
                              shopWatermark.position === pos
                                ? "bg-rose-500/40 text-rose-100"
                                : "bg-white/5 text-white/50"
                            }`}
                          >
                            {t(locale, key)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/50">
                          {t(locale, "shopWatermarkColor")}
                        </span>
                        <input
                          type="color"
                          value={shopWatermark.color}
                          onChange={(e) =>
                            onShopWatermarkChange({ color: e.target.value })
                          }
                          className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                        />
                      </div>
                      {buildShopWatermarkText(shopWatermark) && (
                        <p className="rounded-lg bg-black/40 px-2 py-1.5 text-[10px] font-semibold text-white">
                          {t(locale, "shopWatermarkPreview", {
                            text: buildShopWatermarkText(shopWatermark),
                          })}
                        </p>
                      )}
                    </>
                  )}

                  {(shopWatermark.brandingMode === "logo" ||
                    shopWatermark.brandingMode === "both") && (
                    <>
                      <p className="text-[10px] leading-relaxed text-white/45">
                        {t(locale, "shopLogoHint")}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => logoUploadRef.current?.click()}
                          className="flex-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-2 text-[10px] font-semibold text-rose-100"
                        >
                          {shopWatermark.logoDataUrl
                            ? t(locale, "shopLogoChange")
                            : t(locale, "shopLogoUpload")}
                        </button>
                        {shopWatermark.logoDataUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onShopWatermarkChange({ logoDataUrl: null })
                            }
                            className="rounded-lg border border-white/15 px-2 py-2 text-[10px] text-white/50"
                          >
                            {t(locale, "shopLogoRemove")}
                          </button>
                        )}
                        <input
                          ref={logoUploadRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > LOGO_MAX_BYTES) {
                              alert(t(locale, "shopLogoTooLarge"));
                              e.target.value = "";
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = reader.result as string;
                              onShopWatermarkChange({ logoDataUrl: dataUrl });
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {shopWatermark.logoDataUrl && (
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
                          <img
                            src={shopWatermark.logoDataUrl}
                            alt="logo"
                            className="h-10 w-10 object-contain"
                          />
                          <span className="text-[10px] text-emerald-300/80">
                            {t(locale, "shopLogoReady")}
                          </span>
                        </div>
                      )}
                      {!hasShopLogoBranding(shopWatermark) && (
                        <p className="text-[10px] text-amber-300/80">
                          {t(locale, "shopWatermarkNeedLogo")}
                        </p>
                      )}
                      {!watermarkZone && (
                        <p className="text-[10px] text-amber-300/80">
                          {t(locale, "shopLogoNeedZone")}
                        </p>
                      )}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-white/50">
                            {t(locale, "shopLogoScale")}
                          </span>
                          <span className="font-mono text-[10px] text-rose-200">
                            {Math.round(shopWatermark.logoScalePercent * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={30}
                          max={100}
                          step={5}
                          value={Math.round(
                            shopWatermark.logoScalePercent * 100
                          )}
                          onChange={(e) =>
                            onShopWatermarkChange({
                              logoScalePercent:
                                Number(e.target.value) / 100,
                            })
                          }
                          className="w-full accent-rose-400"
                        />
                        <p className="mt-1 text-[10px] text-white/40">
                          {t(locale, "shopLogoScaleHint")}
                        </p>
                      </div>
                    </>
                  )}

                  <p className="text-[8px] text-white/35">
                    {t(locale, "shopWatermarkApplyHint")}
                  </p>
                </div>
              )}
              </div>
              </PanelBlock>

              {isBatchMode && watermarkZone && (
                <div className="mb-1.5">
                  <button
                    type="button"
                    onClick={onFastPipeline}
                    disabled={isWatermarkDisabled}
                    className="btn-panel-pipeline w-full rounded-lg px-2 py-3 text-[11px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 md:py-2 md:text-[10px]"
                  >
                    {isProcessing && status === "inpainting"
                      ? t(
                          locale,
                          watermarkRemovalMode === "ai"
                            ? "processingWatermarkAi"
                            : "processingWatermark"
                        )
                      : t(locale, "fastPipeline", {
                          platform: selectedPlatformId
                            ? getPlatformLabel(locale, selectedPlatformId)
                            : t(locale, "fastPipelineFallback"),
                        })}
                  </button>
                  <p className="mt-1 text-center text-[8px] text-amber-300/65">
                    {t(locale, "fastPipelineHint")}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={onRemoveWatermark}
                disabled={isWatermarkDisabled}
                className="btn-panel-watermark w-full rounded-lg px-2 py-3.5 text-[12px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 md:py-2.5 md:text-[11px]"
              >
                {isProcessing && status === "inpainting"
                  ? t(
                      locale,
                      watermarkRemovalMode === "ai"
                        ? "processingWatermarkAi"
                        : "processingWatermark"
                    )
                  : isBatchMode
                    ? t(locale, "batchRemoveWatermark", {
                        count: batchCount,
                      })
                    : t(
                        locale,
                        watermarkRemovalMode === "ai"
                          ? "removeWatermarkAi"
                          : "removeWatermark"
                      )}
              </button>
              {!watermarkZone && (
                <p className="mt-1 text-center text-[9px] text-amber-400/85">
                  {t(locale, "selectZoneFirst")}
                </p>
              )}
            </>
          )}
        </FlowStep>

        <FlowStep
          step={3}
          title={`${t(locale, "step3Title")}（${t(locale, "step3Optional")}）`}
          hint={t(locale, "step3Hint")}
          state={stepState(3)}
          accent="sky"
          doneLabel={t(locale, "done")}
          activeLabel={t(locale, "current")}
        >
          {!hasImage ? (
            <p className="text-center text-[11px] text-white/30">
              {t(locale, "completeStep1")}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={onRemoveBackground}
                disabled={isBackgroundDisabled}
                className="btn-panel-bg mb-2 w-full rounded-lg px-2 py-3.5 text-[12px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 md:py-2 md:text-[10px]"
              >
                {isProcessing && status === "removing-background"
                  ? t(locale, "processingBg")
                  : hasRemovedBackground
                    ? t(locale, "reRemoveBackground")
                    : t(locale, "removeBackground")}
              </button>

              <p className="mb-2 text-[10px] font-semibold text-sky-300/70">
                {t(locale, "bgStyle")}
                {!hasRemovedBackground && (
                  <span className="text-white/30">
                    {t(locale, "bgAfterRemove")}
                  </span>
                )}
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {backgroundTypes.map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onBackgroundTypeChange(type)}
                    disabled={isBgSettingsDisabled}
                    className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                      backgroundSettings.type === type
                        ? "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/25"
                        : "border border-white/10 bg-white/5 text-white/50 hover:border-sky-400/40 hover:bg-sky-500/10 disabled:opacity-40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {backgroundSettings.type === "solid" && (
                <ColorRow
                  label={t(locale, "colorLabel")}
                  value={backgroundSettings.solidColor}
                  onChange={(color) =>
                    onBackgroundSettingsChange({ solidColor: color })
                  }
                  disabled={isBgSettingsDisabled}
                />
              )}

              {backgroundSettings.type === "gradient" && (
                <div className="space-y-2">
                  <ColorRow
                    label={t(locale, "gradientStart")}
                    value={backgroundSettings.gradientStart}
                    onChange={(color) =>
                      onBackgroundSettingsChange({ gradientStart: color })
                    }
                    disabled={isBgSettingsDisabled}
                  />
                  <ColorRow
                    label={t(locale, "gradientEnd")}
                    value={backgroundSettings.gradientEnd}
                    onChange={(color) =>
                      onBackgroundSettingsChange({ gradientEnd: color })
                    }
                    disabled={isBgSettingsDisabled}
                  />
                </div>
              )}

              <div
                className={
                  isBgSettingsDisabled ? "pointer-events-none opacity-40" : ""
                }
              >
                <p className="mb-2 mt-3 text-[10px] font-semibold text-sky-300/70">
                  {t(locale, "quickPalette")}
                </p>
                <ColorPalette
                  locale={locale}
                  backgroundSettings={backgroundSettings}
                  onBackgroundTypeChange={onBackgroundTypeChange}
                  onBackgroundSettingsChange={onBackgroundSettingsChange}
                  onEyedropper={onEyedropper}
                  eyedropperDisabled={isBgSettingsDisabled}
                />
              </div>
            </>
          )}
        </FlowStep>

        <FlowStep
          step={4}
          title={t(locale, "step4Title")}
          hint={t(locale, "step4Hint")}
          state={stepState(4)}
          accent="emerald"
          doneLabel={t(locale, "done")}
          activeLabel={t(locale, "current")}
        >
          <PanelBlock label={t(locale, "exportSizeTitle")}>
          <div className="mb-1.5 grid grid-cols-3 gap-0.5">
            {(
              [
                ["platform", "exportModePlatform"],
                ["custom", "exportModeCustom"],
                ["original", "exportModeOriginal"],
              ] as const
            ).map(([mode, labelKey]) => {
              const disabled =
                mode === "platform" && !platformExportSpec;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => onExportSizeModeChange(mode)}
                  className={`rounded-md px-1 py-1 text-[9px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                    exportSizeMode === mode
                      ? "bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25"
                      : "border border-white/10 bg-white/5 text-white/50 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
                  }`}
                >
                  {t(locale, labelKey)}
                </button>
              );
            })}
          </div>

          {exportSizeMode === "platform" && platformExportSpec && (
            <div className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-200">
                {t(locale, "exportPlatformSpec", {
                  platform: getPlatformLabel(locale, selectedPlatformId!),
                  size: formatExportSizeLabel(platformExportSpec),
                })}
              </p>
              {getPlatformExportNote(locale, selectedPlatformId!) && (
                <p className="mt-0.5 text-[10px] text-emerald-300/70">
                  {getPlatformExportNote(locale, selectedPlatformId!)}
                </p>
              )}
            </div>
          )}

          {exportSizeMode === "custom" && (
            <div className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-white/50">
                  {t(locale, "exportCustomWidth")}
                  <input
                    type="number"
                    min={100}
                    max={4096}
                    value={customExportSize.width}
                    onChange={(e) =>
                      onCustomExportSizeChange({
                        ...customExportSize,
                        width: Number(e.target.value) || 100,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white"
                  />
                </label>
                <label className="block text-[10px] text-white/50">
                  {t(locale, "exportCustomHeight")}
                  <input
                    type="number"
                    min={100}
                    max={4096}
                    value={customExportSize.height}
                    onChange={(e) =>
                      onCustomExportSizeChange({
                        ...customExportSize,
                        height: Number(e.target.value) || 100,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white"
                  />
                </label>
              </div>
              <p className="text-[10px] text-white/40">
                {t(locale, "exportQuickSizes")}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {EXPORT_SIZE_QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.width}
                    type="button"
                    onClick={() => onCustomExportSizeChange(preset)}
                    className={`rounded-lg px-1 py-1.5 font-mono text-[10px] font-semibold transition-all ${
                      customExportSize.width === preset.width &&
                      customExportSize.height === preset.height
                        ? "bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/50"
                        : "border border-white/10 bg-white/5 text-white/50 hover:bg-emerald-500/10"
                    }`}
                  >
                    {preset.width}
                  </button>
                ))}
              </div>
            </div>
          )}

          </PanelBlock>
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloadDisabled}
            className="btn-panel-download w-full rounded-lg px-2 py-2.5 text-[11px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBatchMode && batchDoneCount > 1
              ? t(locale, "batchDownload", { count: batchDoneCount })
              : t(locale, "downloadImage")}
          </button>
          <p className="mt-1 text-center text-[8px] text-emerald-300/55">
            {hasProcessedResult
              ? resolvedExportLabel
                ? t(locale, "downloadReady", { size: resolvedExportLabel })
                : t(locale, "downloadReadyOriginal")
              : t(locale, "downloadNeedProcess")}
          </p>
        </FlowStep>
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
          <p className="mb-1 text-[9px] font-semibold text-violet-300/65">
            {t(locale, "settingsSyncTitle")}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => downloadSettingsBundle()}
              className="flex-1 rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-1 text-[9px] font-semibold text-violet-200"
            >
              {t(locale, "settingsExport")}
            </button>
            <button
              type="button"
              onClick={() => settingsImportRef.current?.click()}
              className="flex-1 rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 py-1 text-[9px] font-semibold text-violet-200"
            >
              {t(locale, "settingsImport")}
            </button>
            <input
              ref={settingsImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportSettings(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {hasBetaSurveyLink() && (
          <a
            href={BETA_SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-2 text-center text-[10px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/18"
          >
            {t(locale, "betaSurveyBtn")}
          </a>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/8 bg-black/25 px-2.5 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloadDisabled}
          className="btn-panel-download w-full rounded-lg px-2 py-2 text-[10px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          {hasProcessedResult
            ? isBatchMode && batchDoneCount > 1
              ? t(locale, "batchDownload", { count: batchDoneCount })
              : t(locale, "footerDownload")
            : t(locale, "footerDownloadNeed")}
        </button>
        <button
          type="button"
          onClick={onOpenSupport}
          className="mt-1.5 w-full rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/18"
        >
          {t(locale, "supportBtn")} · {t(locale, "supportCaseRefund")}
        </button>
        <p className="mt-1.5 text-center text-[9px] text-white/35">
          v{APP_VERSION} · {BUILD_SHA}
        </p>
      </footer>
    </div>
  );
}
