# 代码结构

```
kiricut/
├── src/
│   ├── app/                 # Next.js 入口
│   ├── components/
│   │   ├── KiriCutApp.tsx   # 主状态、批量流程
│   │   ├── ControlPanel.tsx # 右侧步骤 1–3
│   │   ├── ImageViewer.tsx  # 左右对比预览
│   │   ├── ImagePanel.tsx   # 单图 + 红框层
│   │   └── EditableCoverZone.tsx  # 可旋转红框
│   ├── lib/
│   │   ├── watermarkFill.ts      # 快速覆盖
│   │   ├── watermarkInpaint.ts   # AI 蒙版
│   │   ├── lamaInpaint.ts        # LaMa 模型
│   │   ├── coverZoneRect.ts      # 红框几何 + 斜角预设
│   │   ├── watermarkZones.ts     # 平台 / 区域
│   │   ├── userPreferences.ts    # localStorage
│   │   ├── shopWatermark.ts      # 店铺标识
│   │   └── i18n.ts
│   └── types/
├── scripts/download-models.mjs
├── public/models/           # ONNX（npm 自动下载）
├── docs/                    # 文档
└── test-samples/            # 测试样图
```

## 去水印数据流

1. 用户选 zone + 红框（`CoverZoneRect`，含 `rotationDeg`）
2. **AI 模式** → `inpaintWatermarkZone` → 旋转或矩形蒙版 → LaMa
3. **覆盖模式** → `fillWatermarkZone` → 涂色 / 羽化
4. 结果存 `processedDataUrl`（无店铺标）
5. 预览 / 下载 → `applyShopBranding()` 叠文字 / LOGO

## 关键类型

- `WatermarkRemovalMode`: `"ai"` | `"cover"`
- `WatermarkZone`: `top-left` | `bottom-right` | `center` | `custom` | `auto`
- `CoverZoneRect`: `xPercent`, `yPercent`, `widthPercent`, `heightPercent`, `rotationDeg?`
