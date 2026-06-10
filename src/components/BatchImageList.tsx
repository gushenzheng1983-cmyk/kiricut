"use client";

import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { BatchImageItem } from "@/types";

interface BatchImageListProps {
  items: BatchImageItem[];
  activeIndex: number;
  locale: Locale;
  onSelect: (index: number) => void;
}

const STATUS_COLORS = {
  pending: "border-white/15 bg-white/5",
  processing: "border-sky-400/60 bg-sky-500/20",
  done: "border-emerald-400/50 bg-emerald-500/10",
  error: "border-rose-400/50 bg-rose-500/10",
};

export default function BatchImageList({
  items,
  activeIndex,
  locale,
  onSelect,
}: BatchImageListProps) {
  if (items.length <= 1) return null;

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600">
          {t(locale, "batchList")} ({items.length})
        </span>
        <span className="text-[10px] text-emerald-600">
          {doneCount}/{items.length} {t(locale, "batchDone")}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(index)}
            className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
              index === activeIndex
                ? "border-violet-500 ring-2 ring-violet-300/50"
                : STATUS_COLORS[item.status]
            }`}
          >
            <img
              src={item.processedDataUrl ?? item.originalDataUrl}
              alt={item.fileName}
              className="h-14 w-14 object-cover"
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[9px] text-white">
              {index + 1}
            </span>
            {item.status === "processing" && (
              <span className="absolute inset-0 flex items-center justify-center bg-sky-500/40 text-[9px] font-bold text-white">
                ...
              </span>
            )}
            {item.status === "error" && (
              <span className="absolute inset-0 flex items-center justify-center bg-rose-500/50 text-[9px] font-bold text-white">
                !
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
