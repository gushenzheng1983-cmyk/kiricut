"use client";

import {
  COVER_COLOR_PRESETS,
  getCoverColorPresetLabel,
} from "@/lib/coverColorPresets";
import { type Locale, t } from "@/lib/i18n";

interface CoverColorPaletteProps {
  locale: Locale;
  coverColor: string;
  /** 当前实际生效色（智能取色时与 coverColor 可能不同） */
  activeColor?: string;
  onCoverColorChange: (color: string) => void;
  onEyedropper: () => void;
  eyedropperDisabled?: boolean;
  hideEyedropper?: boolean;
}

export default function CoverColorPalette({
  locale,
  coverColor,
  activeColor,
  onCoverColorChange,
  onEyedropper,
  eyedropperDisabled = false,
  hideEyedropper = false,
}: CoverColorPaletteProps) {
  const active = (activeColor ?? coverColor).toUpperCase();

  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[9px] font-semibold text-violet-200/70">
          {t(locale, "coverColorPalette")}
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {COVER_COLOR_PRESETS.map((preset) => {
            const selected = active === preset.color.toUpperCase();
            return (
              <button
                key={preset.color}
                type="button"
                title={getCoverColorPresetLabel(locale, preset)}
                onClick={() => onCoverColorChange(preset.color)}
                className={`relative aspect-square rounded-md border-2 transition-all hover:scale-105 ${
                  selected
                    ? "border-amber-300 ring-2 ring-amber-300/70 shadow-md shadow-amber-400/40 scale-105"
                    : "border-white/20 hover:border-violet-300/60"
                }`}
                style={{ backgroundColor: preset.color }}
              >
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-800 drop-shadow-sm">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[9px] font-semibold text-violet-200/70">
          {t(locale, "coverColorCustom")}
        </p>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 p-1.5">
          <button
            type="button"
            onClick={() => onCoverColorChange("#ffffff")}
            className={`shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-[10px] font-bold transition-all ${
              active === "#FFFFFF"
                ? "border-amber-300 bg-white text-gray-800 ring-1 ring-amber-300/50"
                : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {t(locale, "coverWhite")}
          </button>
          <div
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-amber-300/50 shadow-inner"
            style={{ backgroundColor: activeColor ?? coverColor }}
          />
          <input
            type="color"
            value={coverColor}
            onChange={(e) => onCoverColorChange(e.target.value)}
            className="h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-white/15 bg-transparent"
          />
          <span className="shrink-0 font-mono text-[10px] font-semibold text-white/70">
            {active}
          </span>
        </div>
      </div>

      {!hideEyedropper && (
        <button
          type="button"
          onClick={onEyedropper}
          disabled={eyedropperDisabled}
          className="w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-200 transition-all hover:border-rose-400/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(locale, "coverEyedropper")}
        </button>
      )}
    </div>
  );
}
