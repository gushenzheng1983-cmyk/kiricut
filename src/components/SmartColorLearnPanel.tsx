"use client";

import type { ReactNode } from "react";
import CoverColorPalette from "./CoverColorPalette";
import { type Locale, t } from "@/lib/i18n";

interface SmartColorLearnPanelProps {
  locale: Locale;
  hasImage: boolean;
  isProcessing: boolean;
  coverColorAutoLearn: boolean;
  onCoverColorAutoLearnChange: (enabled: boolean) => void;
  previewCoverColor: string;
  coverColor: string;
  learningCount: number;
  learningConfidence: "low" | "medium" | "high";
  selectedPlatformId: string | null;
  isBatchMode: boolean;
  batchCount: number;
  coverColorPickMode: boolean;
  onCoverColorChange: (color: string) => void;
  onCoverEyedropper: () => void;
}

function StepPill({
  done,
  active,
  children,
}: {
  done?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
        done
          ? "bg-emerald-500/20 text-emerald-200"
          : active
            ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40"
            : "bg-white/5 text-white/40"
      }`}
    >
      {done ? "✓" : "○"} {children}
    </span>
  );
}

export default function SmartColorLearnPanel({
  locale,
  hasImage,
  isProcessing,
  coverColorAutoLearn,
  onCoverColorAutoLearnChange,
  previewCoverColor,
  coverColor,
  learningCount,
  learningConfidence,
  selectedPlatformId,
  isBatchMode,
  batchCount,
  coverColorPickMode,
  onCoverColorChange,
  onCoverEyedropper,
}: SmartColorLearnPanelProps) {
  const step1Done = !!selectedPlatformId;
  const step2Done = coverColorAutoLearn;
  const step3NeedsAction = hasImage && learningCount === 0;
  const confidenceLabel =
    learningConfidence === "high"
      ? "coverLearnConfidenceHigh"
      : learningConfidence === "medium"
        ? "coverLearnConfidenceMedium"
        : "coverLearnConfidenceLow";

  return (
    <div className="rounded-xl border border-violet-400/30 bg-gradient-to-b from-violet-500/12 to-violet-950/20 p-2.5 shadow-inner">
      <label className="mb-2 flex cursor-pointer items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-violet-100">
            {t(locale, "learnPanelTitle")}
          </p>
          <p className="text-[8px] leading-snug text-violet-200/60">
            {t(locale, "coverAutoLearnHint")}
          </p>
        </div>
        <input
          type="checkbox"
          checked={coverColorAutoLearn}
          onChange={(e) => onCoverColorAutoLearnChange(e.target.checked)}
          className="h-5 w-5 shrink-0 cursor-pointer accent-violet-400"
        />
      </label>

      <div className="mb-2 flex flex-wrap gap-1">
        <StepPill done={step1Done}>{t(locale, "learnStep1Short")}</StepPill>
        <StepPill done={step2Done} active={!step2Done}>
          {t(locale, "learnStep2Short")}
        </StepPill>
      </div>

      <div
        className={`mb-2 rounded-lg border p-2 ${
          step3NeedsAction
            ? "border-amber-400/45 bg-amber-500/12 ring-1 ring-amber-400/25"
            : "border-violet-400/20 bg-black/20"
        }`}
      >
        <p className="mb-1.5 text-[10px] font-bold text-amber-100">
          {t(locale, "learnStep3Title")}
        </p>
        <p className="mb-2 text-[8px] leading-snug text-amber-100/70">
          {t(locale, "learnStep3Hint")}
        </p>
        <button
          type="button"
          onClick={onCoverEyedropper}
          disabled={!hasImage || isProcessing}
          className={`mb-2 w-full rounded-lg px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            coverColorPickMode
              ? "animate-pulse border-2 border-amber-300 bg-amber-500/35 shadow-lg shadow-amber-500/25"
              : step3NeedsAction
                ? "border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/30"
                : "border border-violet-400/35 bg-violet-500/15 hover:bg-violet-500/25"
          }`}
        >
          <span className="block text-[12px] font-bold text-white">
            {coverColorPickMode
              ? t(locale, "coverEyedropperActive")
              : t(locale, "coverEyedropperCta")}
          </span>
          <span className="mt-0.5 block text-[9px] text-white/65">
            {t(locale, "coverEyedropper")}
          </span>
        </button>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
          <div
            className="h-9 w-9 shrink-0 rounded-md border-2 border-white/25 shadow-inner"
            style={{ backgroundColor: previewCoverColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-white/50">{t(locale, "coverDetectedColor")}</p>
            <p className="font-mono text-[11px] font-bold text-white">
              {previewCoverColor.toUpperCase()}
            </p>
          </div>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold ${
              learningConfidence === "high"
                ? "bg-emerald-500/25 text-emerald-200"
                : learningConfidence === "medium"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "bg-white/10 text-white/45"
            }`}
          >
            {t(locale, confidenceLabel)}
          </span>
        </div>
      </div>

      <div className="mb-2 rounded-lg border border-emerald-400/25 bg-emerald-500/8 p-2">
        <p className="mb-1 text-[10px] font-bold text-emerald-100">
          {t(locale, "learnStep4Title")}
        </p>
        <p className="mb-1.5 text-[8px] leading-snug text-emerald-100/65">
          {t(locale, "learnStep4Hint")}
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md bg-black/25 px-2 py-1.5">
          <span className="text-[10px] font-semibold text-emerald-200">
            {learningCount > 0
              ? t(locale, "coverLearnedStats", { count: learningCount })
              : t(locale, "learnStep4Empty")}
          </span>
          {isBatchMode && batchCount > 1 && (
            <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[8px] font-bold text-emerald-100">
              {t(locale, "learnStep4Batch", { count: batchCount })}
            </span>
          )}
        </div>
      </div>

      <CoverColorPalette
        locale={locale}
        coverColor={coverColor}
        activeColor={previewCoverColor}
        onCoverColorChange={onCoverColorChange}
        onEyedropper={onCoverEyedropper}
        eyedropperDisabled={!hasImage || isProcessing}
        hideEyedropper
      />
    </div>
  );
}
