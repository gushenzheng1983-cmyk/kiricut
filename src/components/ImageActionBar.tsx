"use client";

import { type Locale, type TranslationKey, t } from "@/lib/i18n";

interface ImageActionBarProps {
  locale: Locale;
  hasImage: boolean;
  isProcessing: boolean;
  watermarkZone: string | null;
  activeStep: number;
}

const STEP_HINT_KEYS: Record<number, TranslationKey> = {
  1: "stepHint1",
  2: "stepHint2",
  3: "stepHint3",
};

export default function ImageActionBar({
  locale,
  hasImage,
  isProcessing,
  watermarkZone,
  activeStep,
}: ImageActionBarProps) {
  const hintKey = STEP_HINT_KEYS[activeStep] ?? "stepHint3";

  return (
    <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-600">
          {isProcessing ? t(locale, "aiProcessing") : t(locale, hintKey)}
        </p>
        {hasImage && watermarkZone && !isProcessing && (
          <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
            {t(locale, "previewBoxShown")}
          </span>
        )}
      </div>
    </div>
  );
}
