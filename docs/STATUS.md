# 开发进度

> 更新：2026-07-31（免费改为终身 1 次导出 + 支付宝硬付费墙）

## 定位

- 用户：跨境卖家，每天上百张白底商品图
- 必须原图画质；批量最多 120 张（Pro）
- **主推**：角落轻微水印 + **AI 修图**
- **次推**：Mercari 等斜角水印（旋转红框 + AI）
- **不主推**：画面正中超大斜水印（如 Amazon 整条对角）

## 收费（方案一 · 已落地）

| | 免费 | Pro |
|--|------|-----|
| 导出 | **终身 1 张**（本浏览器） | 不限 |
| 处理 | 导出前可试用；用完后硬锁 | 不限 |
| 批量 | 最多 1 张/次 | 最多 120 张 |
| 价格 | ¥0 | 月卡 ¥68 / 年卡 ¥398 |

- **不再使用**「每天 15 张」日额度模型
- 成功下载/导出后消耗免费体验（`kiricut-free-export-used`）；用完后上传/处理/导出均拦截并弹升级
- **客服必填**：`src/lib/pricing.ts` → `supportWechat`（侧栏常驻「联系客服」，付费/发码/投诉/退款）
- 收款：支付宝码（`public/pay/alipay.png`，侧栏 banner + 升级弹窗内嵌）+ 客服人工发码
- 激活码：侧栏「升级 Pro」弹窗粘贴；存 `localStorage` → `kiricut-license`
- 发卡：`npm run license:gen -- month` / `year` / `trial`（可加 `--count 5`）
- **内测过渡码**（试用至 2026-09-30）：
  - `KC-BETA-2026-THANKS`
  - `KC-BETA-FRIEND-PASS`
- **未做**：云端账号、Stripe（二期）

## 今日已完成（收费）

- `pricing.ts`：`freeLifetimeExports: 1`，弃用每日额度
- `usageQuota.ts`：终身免费导出计数 + `canProcess` / `canExport` / `consumeFreeExport`
- `UpgradeProModal` + 侧栏 Alipay QR banner / 额度徽章
- 去水印 / 批量流水线 / 去背景 / 下载 硬拦截

## 早前功能（摘要）

- AI 修图、快速覆盖、双水印链式、智能取色、可旋转红框、Mercari 预设、批量 ZIP

## 待办

1. 批量失败标红 + 单张重试
2. 批量缩略图显示店铺 LOGO
3. 二期：云端账号 / 自动发码

## localStorage

- `kiricut-preferences` — 平台、zone、coverSize、shopWatermark、locale 等
- `kiricut-cover-color-learning` — 按平台学习取色
- `kiricut-license` — Pro 激活信息
- `kiricut-free-export-used` — 免费体验导出是否已用（`1` = 已用完）

## 关键文件（收费）

- `src/lib/pricing.ts` · `license.ts` · `usageQuota.ts`
- `src/components/UpgradeProModal.tsx`
- `src/components/KiriCutApp.tsx` · `ControlPanel.tsx`
- `src/lib/i18n.ts`
- `scripts/generate-license.mjs`
- `public/pay/README.md`
