# KiriCut（キリカット）

跨境 / 电商商品图批量处理：去平台水印、可选 AI 修图、店铺标识、背景处理。

**项目唯一目录：** `C:\Users\feng3\kiricut`  
（代码、文档、测试样图都放在这里，不要在别的文件夹找。）

## 启动

```powershell
cd C:\Users\feng3\kiricut
npm install
npm run dev
```

浏览器打开：**http://localhost:3000**

强刷页面：`Ctrl + Shift + R`

## 常用操作

| 场景 | 操作 |
|------|------|
| 角落小水印 | 预设「角落修图」→ AI 修图 → 对准红框 |
| Mercari 斜水印 | 点 **メルカリ** 或「斜角水印」→ 拖黄点 / 侧栏角度滑块 → AI 修图 |
| 批量 | 一次最多 120 张，第一张确认后再跑全批 |
| 设置备份 | 侧栏导出 JSON，换电脑可导入 |

## 文档（都在本仓库 `docs/`）

| 文件 | 内容 |
|------|------|
| [docs/STATUS.md](docs/STATUS.md) | 当前进度、待办 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 代码结构、关键文件 |
| [docs/TEST.md](docs/TEST.md) | 怎么测、样图放哪 |
| [AGENTS.md](AGENTS.md) | 给 Cursor / AI 用的项目说明 |
| [docs/agent/](docs/agent/) | AI 整理的备忘、导出（自动放这里） |

## 测试样图

放到 **`test-samples/`**（见该目录 README）。

## AI 修图（服务端）

AI 推理在 **VPS Python 服务**上运行（`onnxruntime` CPU），浏览器只上传图片+蒙版。

```bash
# VPS 首次部署 Python 服务
cd /opt/kiricut
bash scripts/setup-inpaint-service.sh
```

Next.js 通过 `INPAINT_SERVICE_URL`（默认 `http://127.0.0.1:8765`）转发到 Python API。

## GitHub 仓库

**https://github.com/gushenzheng1983-cmyk/kiricut**（默认分支 `master`）

大模型不进仓库（约 250MB），克隆后 `npm install` 会自动下载。

克隆到新电脑：

```powershell
git clone https://github.com/gushenzheng1983-cmyk/kiricut.git
cd kiricut
npm install
npm run dev
```
