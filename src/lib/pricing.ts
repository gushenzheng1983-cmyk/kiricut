/** Pro 定价与客服配置（方案一：微信/支付宝 + 人工发码） */

export const PRICING = {
  monthlyPriceCny: 68,
  yearlyPriceCny: 398,
  freeDailyQuota: 15,
  freeMaxBatch: 5,
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
    "付款后请发「付款截图 + 套餐（月卡/年卡）」给客服领取激活码。功能问题、退款咨询请同样联系客服，勿在评论区争吵。",

  /**
   * 客服「加好友」二维码（微信 → 我 → 二维码名片 → 保存）
   * 与收款码不同：这是加人用的，不是付款码。
   */
  supportQrPath: "/pay/support-wechat.png",
  /** 收款码（付款用） */
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
