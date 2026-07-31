# 发卡与收款运营备忘

## 收款与客服（必做）

1. **客服加好友二维码**（主入口）：微信「我 → 二维码」截图 → 存为 `public/pay/support-wechat.png`
2. **客服微信号**（备用）：`src/lib/pricing.ts` → `supportWechat`（已填 `-Guws-`）
3. 可选：`supportEmail`、`supportHours`
4. 收款码图：`public/pay/wechat.png`、`alipay.png`（付款用，和加好友码分开）
5. 用户侧：侧栏「联系客服」优先显示扫码；扫不了再复制微信号

客服处理范围：付款发码、效果问题、投诉退款。

## 发卡命令

```powershell
cd C:\Users\feng3\kiricut
npm run license:gen -- month
npm run license:gen -- year
npm run license:gen -- trial
npm run license:gen -- year --count 5
```

码格式：`KC-M-YYYYMMDD-XXXX-XXXXXXXX`（月卡 M / 年卡 Y / 试用 T）

## 免费规则（对外话术）

- 免费用户仅可 **导出 1 张**（同浏览器终身，不按天重置）
- 导出成功后硬锁：不能再处理/导出，需支付宝付款 + 客服发激活码开通 Pro
- 侧栏与升级弹窗均展示 `public/pay/alipay.png`

## 内测过渡（结束纯免费）

发给老测试用户其一即可（有效至 2026-09-30）：

- `KC-BETA-2026-THANKS`
- `KC-BETA-FRIEND-PASS`

话术示例：「可先免费体验导出 1 张；内测老用户送试用 Pro 至 9 月底。之后月卡 ¥68 / 年卡 ¥398。」

## 记账建议

表格列：日期 | 套餐 | 激活码 | 对方微信 | 金额 | 备注
