"use client";

import { useEffect, useState } from "react";
import { activateCode, getLicenseSummary, type StoredLicense } from "@/lib/license";
import { PRICING } from "@/lib/pricing";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
  onActivated: (license: StoredLicense) => void;
};

export default function UpgradeProModal({
  locale,
  open,
  onClose,
  onOpenSupport,
  onActivated,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alipayOk, setAlipayOk] = useState<boolean>(Boolean(PRICING.enableAlipay));
  const summary = getLicenseSummary();

  useEffect(() => {
    if (!open) return;
    setCode("");
    setMessage(null);
    setError(null);
    setAlipayOk(Boolean(PRICING.enableAlipay));
  }, [open]);

  if (!open) return null;

  const supportWechat = PRICING.supportWechat.trim();

  const onActivate = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await activateCode(code);
      if (!result.ok) {
        const map: Record<string, string> = {
          empty: t(locale, "proCodeEmpty"),
          invalid_format: t(locale, "proCodeInvalid"),
          bad_signature: t(locale, "proCodeInvalid"),
          expired: t(locale, "proCodeExpired"),
        };
        setError(map[result.reason] ?? t(locale, "proCodeInvalid"));
        return;
      }
      setMessage(t(locale, "proActivateOk", { date: result.license.expiresAt }));
      onActivated(result.license);
      void fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "activate_ok" }),
      }).catch(() => undefined);
      setTimeout(() => onClose(), 800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#12121a] p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-amber-200">
              {t(locale, "proUpgradeTitle")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              {t(locale, "proUpgradeSubtitle")}
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

        {summary.isPro && summary.expiresAt && (
          <div className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
            {t(locale, "proActiveUntil", { date: summary.expiresAt })}
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-semibold text-white/45">
              {t(locale, "proFreeTier")}
            </p>
            <p className="mt-1 text-lg font-black text-white">¥0</p>
            <ul className="mt-2 space-y-1 text-[10px] text-white/60">
              <li>· {t(locale, "proFreeDaily", { count: PRICING.freeDailyQuota })}</li>
              <li>· {t(locale, "proFreeBatch", { count: PRICING.freeMaxBatch })}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-3">
            <p className="text-[10px] font-semibold text-amber-200/80">Pro</p>
            <p className="mt-1 text-lg font-black text-amber-100">
              ¥{PRICING.monthlyPriceCny}
              <span className="text-[10px] font-semibold text-amber-200/70">
                /{t(locale, "proPerMonth")}
              </span>
            </p>
            <p className="text-[10px] text-amber-100/70">
              {t(locale, "proYearlyPrice", { price: PRICING.yearlyPriceCny })}
            </p>
            <ul className="mt-2 space-y-1 text-[10px] text-amber-50/80">
              <li>· {t(locale, "proBenefitUnlimited")}</li>
              <li>· {t(locale, "proBenefitBatch", { count: PRICING.proMaxBatch })}</li>
            </ul>
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-[11px] font-semibold text-white/70">
            {t(locale, "proPayStepsTitle")}
          </p>
          <ol className="mb-3 list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-white/55">
            <li>{t(locale, "proPayStep1")}</li>
            <li>{t(locale, "proPayStep2")}</li>
            <li>{t(locale, "proPayStep3")}</li>
          </ol>

          {PRICING.enableAlipay && alipayOk && (
            <div className="mb-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PRICING.alipayQrPath}
                alt="Alipay"
                className="mx-auto h-40 w-40 rounded-xl border border-white/10 bg-white object-contain p-1"
                onError={() => setAlipayOk(false)}
              />
              <p className="mt-2 text-[11px] font-semibold text-sky-200">
                {t(locale, "proAlipayOnly")}
              </p>
              <p className="mt-1 text-[9px] text-white/45">
                {t(locale, "proAlipayOnlyHint")}
              </p>
            </div>
          )}
          {PRICING.enableAlipay && !alipayOk && (
            <p className="mb-3 text-center text-[10px] text-amber-200">
              {t(locale, "proAlipayMissing")}
            </p>
          )}

          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-center text-[11px] text-cyan-100">
            {supportWechat
              ? t(locale, "proSupportWechat", { wechat: supportWechat })
              : t(locale, "proSupportWechatPlaceholder")}
          </div>
          {onOpenSupport && (
            <button
              type="button"
              onClick={onOpenSupport}
              className="mt-2 w-full rounded-lg border border-cyan-400/40 bg-cyan-500/20 py-2 text-[11px] font-bold text-cyan-50"
            >
              {t(locale, "supportBtn")} — {t(locale, "supportCasePay")}
            </button>
          )}
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] font-semibold text-white/70">
            {t(locale, "proCodeLabel")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KC-M-20260831-A1B2-C3D4E5F6"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-amber-400/50"
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              onClick={() => void onActivate()}
              className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40"
            >
              {busy ? "..." : t(locale, "proActivateBtn")}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-[10px] text-rose-300">{error}</p>
          )}
          {message && (
            <p className="mt-2 text-[10px] text-emerald-300">{message}</p>
          )}
        </div>

        <p className="text-[9px] leading-relaxed text-white/35">
          {t(locale, "proLegalNote")}
        </p>
      </div>
    </div>
  );
}
