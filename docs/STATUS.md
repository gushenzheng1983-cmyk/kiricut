# 开发进度

> 更新：2026-07-31（收费方案一上线：微信/支付宝 + 激活码）

## 定位

- 用户：跨境卖家，每天上百张白底商品图
- 必须原图画质；批量最多 120 张（Pro）
- **主推**：角落轻微水印 + **AI 修图**
- **次推**：Mercari 等斜角水印（旋转红框 + AI）
- **不主推**：画面正中超大斜水印（如 Amazon 整条对角）

## 收费（方案一 · 已落地）

| | 免费 | Pro |
|--|------|-----|
| 每日处理 | 15 张 | 不限 |
| 批量 | 最多 5 张/次 | 最多 120 张 |
| 价格 | ¥0 | 月卡 ¥68 / 年卡 ¥398 |

- **客服必填**：`src/lib/pricing.ts` → `supportWechat`（侧栏常驻「联系客服」，付费/发码/投诉/退款）
- 收款：微信/支付宝码（图放 `public/pay/wechat.png`、`alipay.png`）+ 客服人工发码
- 激活码：侧栏「升级 Pro」弹窗粘贴；存 `localStorage` → `kiricut-license`
- 发卡：`npm run license:gen -- month` / `year` / `trial`（可加 `--count 5`）
- **内测过渡码**（试用至 2026-09-30）：
  - `KC-BETA-2026-THANKS`
  - `KC-BETA-FRIEND-PASS`
- **未做**：云端账号、Stripe（二期）

## 今日已完成（收费）

- `pricing.ts` / `license.ts` / `usageQuota.ts`
- `UpgradeProModal` + 侧栏升级入口 / 今日额度徽章
- 去水印 / 批量流水线 / 去背景入口额度拦截
- `scripts/generate-license.mjs` 本地发卡

## 早前功能（摘要）

- AI 修图、快速覆盖、双水印链式、智能取色、可旋转红框、Mercari 预设、批量 ZIP

## 待办

1. 批量失败标红 + 单张重试
2. 批量缩略图显示店铺 LOGO
3. 填入真实客服微信号 + 收款码图后对外宣布结束纯免费
4. 二期：云端账号 / 自动发码

## localStorage

- `kiricut-preferences` — 平台、zone、coverSize、shopWatermark、locale 等
- `kiricut-cover-color-learning` — 按平台学习取色
- `kiricut-license` — Pro 激活信息
- `kiricut-usage-quota` — 免费日额度计数

## 关键文件（收费）

- `src/lib/pricing.ts` · `license.ts` · `usageQuota.ts`
- `src/components/UpgradeProModal.tsx`
- `src/components/KiriCutApp.tsx` · `ControlPanel.tsx`
- `src/lib/i18n.ts`
- `scripts/generate-license.mjs`
- `public/pay/README.md`
