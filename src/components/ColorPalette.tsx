"use client";

import { type Locale, t } from "@/lib/i18n";
import type { BackgroundSettings, BackgroundType } from "@/types";

const PRESET_COLORS = [
  "#FFFFFF",
  "#F5F5F5",
  "#E5E5E5",
  "#D4D4D4",
  "#000000",
  "#1A1A1A",
  "#3B82F6",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#FFF8E7",
  "#E8F4F8",
  "#F0FFF0",
  "#FFE4E1",
];

interface ColorPaletteProps {
  locale: Locale;
  backgroundSettings: BackgroundSettings;
  onBackgroundTypeChange: (type: BackgroundType) => void;
  onBackgroundSettingsChange: (settings: Partial<BackgroundSettings>) => void;
  onEyedropper: () => void;
  eyedropperDisabled: boolean;
}

function getActiveColor(settings: BackgroundSettings): string {
  switch (settings.type) {
    case "solid":
      return settings.solidColor;
    case "gradient":
      return settings.gradientStart;
    case "custom":
      return settings.customColor;
    default:
      return settings.customColor;
  }
}

export default function ColorPalette({
  locale,
  backgroundSettings,
  onBackgroundTypeChange,
  onBackgroundSettingsChange,
  onEyedropper,
  eyedropperDisabled,
}: ColorPaletteProps) {
  const activeColor = getActiveColor(backgroundSettings);

  const applyPreset = (color: string) => {
    onBackgroundTypeChange("custom");
    onBackgroundSettingsChange({ customColor: color });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold text-sky-300/60">
          {t(locale, "bgColorPreview")}
        </p>
        {backgroundSettings.type === "transparent" ? (
          <div
            className="h-20 w-full rounded-xl border border-white/15 shadow-inner"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
              backgroundColor: "#333",
            }}
          />
        ) : backgroundSettings.type === "gradient" ? (
          <div
            className="h-20 w-full rounded-xl border border-white/15 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${backgroundSettings.gradientStart}, ${backgroundSettings.gradientEnd})`,
            }}
          />
        ) : (
          <div
            className="h-20 w-full rounded-xl border border-white/15 shadow-lg"
            style={{ backgroundColor: activeColor }}
          />
        )}
        <p className="mt-2 text-center font-mono text-[10px] text-white/40">
          {backgroundSettings.type === "transparent"
            ? t(locale, "bgTransparent")
            : backgroundSettings.type === "gradient"
              ? `${backgroundSettings.gradientStart.toUpperCase()} → ${backgroundSettings.gradientEnd.toUpperCase()}`
              : activeColor.toUpperCase()}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-sky-300/60">
          {t(locale, "bgColorPresets")}
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => applyPreset(color)}
              className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                activeColor.toUpperCase() === color.toUpperCase() &&
                backgroundSettings.type !== "transparent"
                  ? "border-sky-400 ring-2 ring-sky-400/50 shadow-md shadow-sky-500/30"
                  : "border-white/15 hover:border-sky-400/50"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-sky-300/60">
          {t(locale, "bgCustom")}
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <div
            className="h-10 w-10 shrink-0 rounded-lg border border-white/20 shadow-inner"
            style={{ backgroundColor: backgroundSettings.customColor }}
          />
          <input
            type="color"
            value={backgroundSettings.customColor}
            onChange={(e) => {
              onBackgroundTypeChange("custom");
              onBackgroundSettingsChange({ customColor: e.target.value });
            }}
            className="h-10 min-w-0 flex-1 cursor-pointer rounded-lg border border-white/15 bg-transparent"
          />
          <span className="shrink-0 font-mono text-[10px] text-white/40">
            {backgroundSettings.customColor.toUpperCase()}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onEyedropper}
        disabled={eyedropperDisabled}
        className="w-full rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2.5 text-xs font-semibold text-sky-200 transition-all hover:border-sky-400/50 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t(locale, "bgEyedropper")}
      </button>
    </div>
  );
}
