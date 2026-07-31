# KiriCut — Agent 说明

<!-- BEGIN:nextjs-agent-rules -->
This Next.js version may differ from training data. Read `node_modules/next/dist/docs/` before changing framework code.
<!-- END:nextjs-agent-rules -->

## 唯一工作目录

```
C:\Users\feng3\kiricut
```

不要用 `C:\Users\feng3\.dbus-keyrings` 或 `.cursor\projects\...` 当项目根。  
用户应用 Cursor 时请 **Open Folder → kiricut**。

## 启动

```powershell
cd C:\Users\feng3\kiricut
npm run dev
```

## 文档入口

| 文件 | 用途 |
|------|------|
| `docs/STATUS.md` | 进度与待办 |
| `docs/ARCHITECTURE.md` | 文件地图与数据流 |
| `docs/TEST.md` | 测试步骤 |
| `test-samples/` | 测试图片 |
| `docs/agent/` | **AI 新建文件默认放这里**（notes / exports） |

## 文件存放约定

- **唯一根目录**：`C:\Users\feng3\kiricut`
- 写代码 → `src/`
- 写文档 / 备忘 → `docs/` 或 `docs/agent/notes/`
- 测试图 → `test-samples/`
- 没有文件夹 → **自己创建**，不要散到 `.cursor\projects\` 或用户其它目录

## 产品规则（改代码前记住）

1. 角落轻水印 = 主战场，默认 **AI 修图**
2. 快速覆盖 ≠ 真修图；仅白底空白角标批量
3. Mercari 斜水印：旋转红框 + AI；平台按钮自动 `getDiagonalWatermarkPreset()`
4. 保持原图画质；小步改动；改完跑 `npx tsc --noEmit`
5. 不要未经要求 commit / push
6. **免费 = 终身 1 次导出**（`localStorage` `kiricut-free-export-used`），用完硬锁处理/导出直至开通 Pro；无每日额度

## 常用文件

- 主逻辑：`src/components/KiriCutApp.tsx`
- 红框旋转：`src/components/EditableCoverZone.tsx`, `src/lib/coverZoneRect.ts`
- AI 修图：`src/lib/watermarkInpaint.ts`, `src/lib/lamaInpaint.ts`
- 侧栏：`src/components/ControlPanel.tsx`
- 文案：`src/lib/i18n.ts`

## 自测（有 Browser MCP 时）

1. 打开 http://localhost:3000
2. 用 `test-samples/` 里的图上传
3. 验证黄点旋转、Mercari 预设、AI 结果
