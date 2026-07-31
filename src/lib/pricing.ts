/** Pro 定价与客服配置（方案一：支付宝 + 人工发码） */

export const PRICING = {
  monthlyPriceCny: 68,
  yearlyPriceCny: 398,
  /** 免费用户终身可导出张数（按浏览器 localStorage，非每日重置） */
  freeLifetimeExports: 1,
  /**
   * @deprecated 已弃用每日额度模型；保留字段避免旧引用崩，请用 freeLifetimeExports
   */
  freeDailyQuota: 0,
  /** 免费版单次批量上限（免费仅 1 张体验导出） */
  freeMaxBatch: 1,
  proMaxBatch: 120,

  /**
   * 客服微信号（上线前必填！）
   * 付费、发码、投诉、退款一律走客服，避免扯皮。
   */
  supportWechat: "-Guws-",
  /** 可选：备用邮箱，便于留痕 */
  supportEmail: "",
  /** 客服在线时段文案 */
  supportHours: "工作日 10:00–22:00（微信消息通常 2 小时内回复）",
  /** 客服说明（显示在联系客服弹窗） */
  supportNote:
    "请用支付宝付款，付款后发「付款截图 + 套餐（月卡/年卡）」给客服微信领取激活码。功能问题、退款咨询请同样联系客服。",

  /**
   * 客服「加好友」二维码（微信 → 我 → 二维码名片 → 保存）
   * 与收款码不同：这是加人用的，不是付款码。
   */
  supportQrPath: "/pay/support-wechat.png",
  /** 仅支付宝收款（暂不开放微信收款） */
  enableWechatPay: false,
  enableAlipay: true,
  wechatQrPath: "/pay/wechat.png",
  alipayQrPath: "/pay/alipay.png",
} as const;

export type PlanId = "M" | "Y" | "T";

export const PLAN_LABEL: Record<PlanId, { zh: string; ja: string; en: string }> = {
  M: { zh: "月卡", ja: "月額", en: "Monthly" },
  Y: { zh: "年卡", ja: "年額", en: "Yearly" },
  T: { zh: "试用", ja: "トライアル", en: "Trial" },
};

/** 与 scripts/generate-license.mjs 共用；客户端可见，仅作第一版防随便编造 */
export const LICENSE_SECRET = "kiricut-v1-domestic-pay-2026";

export function hasSupportWechat(): boolean {
  return PRICING.supportWechat.trim().length > 0;
}
