"use client";

import { type Locale, t } from "@/lib/i18n";

interface BatchConfirmDialogProps {
  locale: Locale;
  count: number;
  action: "remove" | "pipeline";
  previewColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BatchConfirmDialog({
  locale,
  count,
  action,
  previewColor,
  onConfirm,
  onCancel,
}: BatchConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-b from-gray-900 to-gray-950 p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">
          {t(locale, "batchConfirmTitle")}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {t(locale, "batchConfirmHint", { count })}
        </p>
        <ul className="mt-3 space-y-1.5 text-[11px] text-white/50">
          <li>· {t(locale, "batchConfirmCheck1")}</li>
          <li>· {t(locale, "batchConfirmCheck2")}</li>
          <li className="flex items-center gap-2">
            · {t(locale, "batchConfirmCheck3")}
            <span
              className="inline-block h-4 w-4 rounded border border-white/20"
              style={{ backgroundColor: previewColor }}
            />
            <span className="font-mono text-white/40">
              {previewColor.toUpperCase()}
            </span>
          </li>
        </ul>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            {t(locale, "batchConfirmCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white ${
              action === "pipeline"
                ? "btn-panel-pipeline"
                : "btn-panel-watermark"
            }`}
          >
            {action === "pipeline"
              ? t(locale, "batchConfirmPipeline", { count })
              : t(locale, "batchConfirmRun", { count })}
          </button>
        </div>
      </div>
    </div>
  );
}
