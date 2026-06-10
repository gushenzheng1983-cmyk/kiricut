# 开发进度

> 更新：2026-06-08（今日收工 · 明日封闭测试）

## 定位

- 用户：跨境卖家，每天上百张白底商品图
- 必须原图画质；批量最多 120 张
- **主推**：角落轻微水印 + **AI 修图**
- **次推**：Mercari 等斜角水印（旋转红框 + AI）
- **不主推**：画面正中超大斜水印（如 Amazon 整条对角）

## 今日已完成（2026-06-08）

### 交互

- **框控制条**：可拖动，**全界面**任意位置（Portal 浮层）；红框移动 + 方向/大小/角度按钮
- **侧栏**：关键项默认展开（覆盖色、店铺标、去背景步骤）；智能取色独立大面板
- **智能取色面板**：③ 吸色大按钮 + ④ 批量学习进度；色板当前色 **✓ 高亮**
- 吸色时左侧原图 **大黄条** 提示

### 去水印质量

- **AI 修图**：智能混合（蒙版外扩 → 铺底色 → LaMa → 核心区巩固）
- **快速覆盖**：纯色块真正实色；铺色+窄羽化；铺色+AI修边（先铺色再 AI）
- **双水印修复**：第二次起在 **上次结果上继续修**，不再从原图重来（修 A 再修 B，A 不会回来）

### 背景

- `processedDataUrl`（去水印）与 `bgRemovedDataUrl`（去背景）**分层存储**
- 换背景色不再导致水印「复活」

### 学习

- 按平台本地学习底色；手动吸色权重更高；样本多了更信任历史色
- 侧栏显示：已从 N 张学习 / 刚开始学 · 学习中 · 学习成熟

### 其他（早前已有）

- 可旋转红框、Mercari 斜框预设、智能识别单框
- 蒙版羽化减「框印」；批量确认、流水线、设置导出导入
- `npx tsc --noEmit` 通过

## 明日测试前准备

| 项 | 说明 |
|----|------|
| 启动 | `cd C:\Users\feng3\kiricut; npm run dev` → http://localhost:3000 |
| 样图 | 放入 `test-samples/`（见 `docs/TEST.md`） |
| 问卷 | 文案 `docs/BETA_SURVEY.md`；链接填入 `src/lib/betaFeedback.ts` 的 `BETA_SURVEY_URL` 后侧栏才显示入口 |
| 强刷 | 测试前 `Ctrl+Shift+R` |

## 待办（测试后）

1. 批量失败标红 + 单张重试
2. 批量缩略图显示店铺 LOGO
3. 问卷链接上线 + 测试话术定稿
4. 收费规则 / 真云端账号（未做）

## localStorage

- `kiricut-preferences` — 平台、zone、coverSize、shopWatermark、locale 等
- `kiricut-cover-color-learning` — 按平台学习取色（含校正权重）

## 关键文件（今日动过）

- `src/components/KiriCutApp.tsx` — 双水印链式处理、背景分层
- `src/components/SmartColorLearnPanel.tsx` — 智能取色 UI
- `src/components/EditableCoverZone.tsx` — 可拖动控制条
- `src/lib/watermarkInpaint.ts` — AI 智能混合
- `src/lib/watermarkFill.ts` — 覆盖三种模式
- `src/lib/coverColorLearn.ts` — 学习算法加强
