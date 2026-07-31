"use client";

import { useState } from "react";
import { hasSupportWechat, PRICING } from "@/lib/pricing";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  open: boolean;
  onClose: () => void;
};

export default function SupportContactModal({ locale, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrOk, setQrOk] = useState(true);
  const wechat = PRICING.supportWechat.trim();
  const email = PRICING.supportEmail.trim();

  if (!open) return null;

  const copyWechat = async () => {
    if (!wechat) return;
    try {
      await navigator.clipboard.writeText(wechat);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#12121a] p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-cyan-200">
              {t(locale, "supportTitle")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              {t(locale, "supportSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-center">
          <p className="mb-2 text-[11px] font-semibold text-cyan-100">
            {t(locale, "supportQrHint")}
          </p>
          {qrOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={PRICING.supportQrPath}
              alt={t(locale, "supportQrAlt")}
              className="mx-auto h-44 w-44 rounded-xl border border-white/15 bg-white object-contain p-2"
              onError={() => setQrOk(false)}
            />
          ) : (
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-amber-400/40 bg-amber-500/10 px-3 text-[10px] leading-relaxed text-amber-100">
              {t(locale, "supportQrMissing")}
            </div>
          )}
          <p className="mt-2 text-[10px] text-white/50">{PRICING.supportHours}</p>
        </div>

        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-semibold text-white/55">
            {t(locale, "supportWechatFallback")}
          </p>
          {hasSupportWechat() ? (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm font-bold text-white">
                {wechat}
              </code>
              <button
                type="button"
                onClick={() => void copyWechat()}
                className="shrink-0 rounded-lg bg-cyan-500 px-3 py-2 text-[11px] font-bold text-black"
              >
                {copied ? t(locale, "supportCopied") : t(locale, "supportCopy")}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-semibold text-amber-200">
              {t(locale, "supportWechatMissing")}
            </p>
          )}
        </div>

        {email && (
          <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
            {t(locale, "supportEmailLabel")}:{" "}
            <span className="font-mono text-white">{email}</span>
          </div>
        )}

        <ul className="mb-3 space-y-1.5 text-[10px] leading-relaxed text-white/60">
          <li>· {t(locale, "supportCasePay")}</li>
          <li>· {t(locale, "supportCaseBug")}</li>
          <li>· {t(locale, "supportCaseRefund")}</li>
        </ul>

        <p className="text-[9px] leading-relaxed text-white/40">{PRICING.supportNote}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 py-2 text-[11px] font-semibold text-white/80 hover:bg-white/10"
        >
          {t(locale, "supportClose")}
        </button>
      </div>
    </div>
  );
}
