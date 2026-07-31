# KiriCut 部署与运维手册

> 版本：v0.1.0 · 仓库：https://github.com/gushenzheng1983-cmyk/kiricut  
> 正式域名：**https://kiricut.net**（www 同指）  
> VPS：206.119.182.153:55716（SSH）· 路径：`/home/kiricut` · 规格：2核 4G

---

## 0. 域名与 DNS（阿里云）

| 项 | 值 |
|----|-----|
| 正确访问地址 | **http://kiricut.net**（开通 SSL 后用 **https://kiricut.net**） |
| 备用 | http://www.kiricut.net 、http://206.119.182.153 |
| A 记录必须指向 | **206.119.182.153** |

### 阿里云 DNS 应设置

在 [阿里云 DNS / 云解析](https://dns.console.aliyun.com/) → `kiricut.net`：

| 主机记录 | 类型 | 记录值 |
|----------|------|--------|
| `@` | A | `206.119.182.153` |
| `www` | A | `206.119.182.153` |

不要指向旧 IP（如 `149.x`）、不要指向未配置回源的 CDN，否则会出现「连接被拒绝」或打开旧站。

本地自检：

```powershell
nslookup kiricut.net
# 应看到 Address: 206.119.182.153
curl.exe -I http://kiricut.net
# 期望 HTTP/1.1 200
curl.exe -I https://kiricut.net
# 开通 SSL 前会 Connection refused（443 未监听）；开通后应为 200
```

### HTTPS（443）两种做法

**推荐 A：Let's Encrypt（certbot，免费）**

前提：DNS A 已指向本 VPS，且 80 可从公网访问。

```bash
# SSH 到 VPS 后
apt-get update && apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d kiricut.net -d www.kiricut.net --non-interactive --agree-tos -m YOUR@EMAIL --redirect
# 开放防火墙（若启用 ufw）
ufw allow 80/tcp
ufw allow 443/tcp
nginx -t && systemctl reload nginx
```

续期：`certbot renew`（systemd timer 通常已自动）。

部署脚本会先写入 HTTP 模板，若已存在 `/etc/letsencrypt/live/kiricut.net/` 证书，会自动 `certbot install` 重新挂上 443，避免下次 `deploy:vps` 把 HTTPS 冲掉。

**备选 B：阿里云免费/付费 SSL 证书**

1. 阿里云 SSL 控制台申请证书 → 下载 Nginx 格式  
2. 上传到 VPS，例如 `/etc/nginx/ssl/kiricut.net.pem` 与 `.key`  
3. 在 nginx 增加 `listen 443 ssl;` + `ssl_certificate` / `ssl_certificate_key`  
4. 可选：HTTP 301 跳转到 HTTPS  

未开通 443 时，浏览器默认打开 `https://kiricut.net` 会 **Connection refused**——请先用 **http://** 或完成上述 SSL。

---

## 1. 架构总览

```
浏览器（用户）  →  https://kiricut.net 或 http://kiricut.net
    │
    ▼
nginx :80（及 :443，若已装证书）
    server_name kiricut.net www.kiricut.net;
    上传 20MB，超时 300s
    ▼
Next.js :3000（页面 + API 代理）
    │  /api/inpaint
    │  /api/remove-background
    │  /api/inpaint/health
    ▼
Python FastAPI :8765（AI 推理）
    ├── LaMa ONNX 修图
    └── rembg/u2net 抠图
```

### 任务分工

| 浏览器（客户端） | VPS（服务器） |
|----------------|--------------|
| 上传、拖拽、批量列表 | LaMa AI 修图 |
| 水印红框、快速覆盖 | rembg 抠图 |
| 结果预览、下载、店铺标 | 图片 >2048px 自动缩小 |
| 蒙版生成、轻量合成 | 并发控制（最多 2 路） |
| | 内存上限 + swap 缓冲 |

**原则**：重 CPU/内存的 AI 在服务器；要即时交互的在浏览器。

---

## 2. 版本对齐（Git ↔ VPS）

### 唯一真相源

**GitHub `master` 分支** = 权威版本。  
VPS 只做运行环境，不在上面手改代码。

### 版本号怎么看

- 网站右下角：`v0.1.0 · <git短哈希>`（如 `e24bdd8`）
- 本地：`src/lib/buildInfo.ts`（每次 build 自动生成）
- VPS：`python scripts/vps-ops.py version`

三者哈希一致 = 部署成功。

---

## 3. 日常发布流程（推荐）

### 本地

```powershell
cd C:\Users\feng3\kiricut

# 1. 改代码、自测
npm run dev

# 2. 提交并推到 GitHub
git add .
git commit -m "说明本次改动"
git push origin master
```

### 部署到 VPS

```powershell
# 设置密码（只需设一次，或写入系统环境变量）
$env:KIRICUT_VPS_PASSWORD = "你的密码"

# 标准部署：VPS git pull + build + 重启
npm run deploy:vps
```

### 部署后验收

```powershell
npm run vps:health
```

浏览器打开 **http://kiricut.net**（或 http://206.119.182.153），确认右下角版本号与本地 `git rev-parse --short HEAD` 一致。

---

## 4. 部署命令说明

| 命令 | 何时用 |
|------|--------|
| `npm run deploy:vps` | **日常**：VPS 已有 git，`git pull` 更新 |
| `npm run deploy:vps:bootstrap` | **首次对齐** 或 VPS 乱了：强制与 GitHub 硬同步 |
| `npm run deploy:vps:tar` | **紧急**：git 不可用，tar 全量传源码 |
| `npm run vps:health` | 快速健康检查 |
| `npm run vps:diagnose` | 详细诊断（内存、日志、OOM） |

环境变量（可选）：

| 变量 | 默认 |
|------|------|
| `KIRICUT_VPS_HOST` | `206.119.182.153` |
| `KIRICUT_VPS_PORT` | `55716` |
| `KIRICUT_VPS_USER` | `root` |
| `KIRICUT_VPS_PASSWORD` | 必填 |
| `KIRICUT_GIT_BRANCH` | `master` |
| `KIRICUT_GIT_REMOTE` | `https://github.com/gushenzheng1983-cmyk/kiricut.git` |

---

## 5. 首次 VPS 与 Git 长期对齐（一次性）

> **前提**：本地改动已 `git push` 到 GitHub。

```powershell
$env:KIRICUT_VPS_PASSWORD = "你的密码"
npm run deploy:vps:bootstrap
```

此命令会：

1. 在 `/home/kiricut` 初始化 git（若无）
2. `git reset --hard origin/master`（**丢弃 VPS 上手工改动**）
3. `npm run build`
4. 重启 `kiricut-inpaint`、`kiricut-next`、reload nginx

之后每次只需 `npm run deploy:vps`。

---

## 6. 服务器组件

### systemd 服务

| 服务 | 作用 | 内存限制 |
|------|------|----------|
| `kiricut-inpaint` | Python AI :8765 | MemoryMax 3G |
| `kiricut-next` | Next.js :3000 | MemoryMax 1G |
| `nginx` | 反向代理 :80 | — |

### 手动运维（SSH）

```bash
systemctl status kiricut-inpaint kiricut-next nginx
systemctl restart kiricut-inpaint
systemctl restart kiricut-next
journalctl -u kiricut-inpaint -f
tail -f /var/log/kiricut-build.log
```

### 配置文件位置

| 文件 | VPS 路径 |
|------|----------|
| nginx | `/etc/nginx/sites-available/kiricut`（模板：`scripts/nginx-kiricut.conf`，`server_name kiricut.net www.kiricut.net`） |
| Let's Encrypt | `/etc/letsencrypt/live/kiricut.net/`（certbot 安装后） |
| Python 服务 | `/etc/systemd/system/kiricut-inpaint.service` |
| Next 服务 | `/etc/systemd/system/kiricut-next.service` |
| 源码仓库 | `/home/kiricut` |

---

## 7. 防崩溃 / 内存保护

| 措施 | 说明 |
|------|------|
| Python MemoryMax=3G | 超限只杀 AI 进程，不拖死整机 |
| Next MemoryMax=1G + NODE_OPTIONS=768MB | 限制 Node 堆 |
| 2G swap | 短时突发缓冲 |
| AI 并发 ≤2 + 90s 排队超时 | 过载返回 503，不占死连接 |
| 双端 2048px 限制 | 客户端 + Python 都缩小大图 |
| 批量修图串行 | 不并发打爆 2 核 4G |

若频繁 OOM，可把 `kiricut-inpaint.service` 里 `AI_MAX_CONCURRENT` 改为 `1`。

---

## 8. 已删除 / 废弃的内容

以下已从代码库移除，**不要再使用**：

| 已删除 | 原因 |
|--------|------|
| `src/lib/server/lamaServer.ts` | Next.js 内重复跑 AI，浪费内存 |
| `src/lib/watermarkApi.ts` | 旧云端接口 |
| `onnxruntime-node` / `onnxruntime-web` 依赖 | AI 已全部迁到 Python |
| `public/ort/` WASM 文件 | 浏览器不再本地推理 |
| `scripts/deploy-vps-sync.py` 等 15+ 临时脚本 | 合并为 `deploy-vps.py` + `vps-ops.py` |
| `/api/remove-watermark` 路由 | 已删除，统一走 `/api/inpaint` |

### 保留的脚本

```
scripts/
  deploy-vps.py          # 唯一部署入口
  vps-ops.py             # 运维：health / diagnose / version
  write-build-info.mjs   # 生成版本号
  download-models.mjs    # 下载 LaMa 模型
  nginx-kiricut.conf     # nginx 配置模板
  kiricut-next.service   # Next systemd 模板
  setup-inpaint-service.sh
```

---

## 9. 常见问题

### 浏览器打不开 / Connection refused（常见：HTTPS）

- 症状：地址栏是 `https://kiricut.net`，提示无法连接 / 连接被拒绝  
- 原因：VPS 只监听 **80**，尚未装 SSL（443 未开）  
- 处理：先访问 **http://kiricut.net**；或按上文「HTTPS」用 certbot / 阿里云证书开通 443  
- 若 HTTP 也不通：查阿里云 DNS A 是否为 `206.119.182.153`（见第 0 节）

### 504 / 网页打不开

- 原因：Next 或 Python 在重启中
- 处理：等 1～2 分钟 → F5；仍不行 → `npm run vps:diagnose`

### 修图后右侧无图

- 查 nginx 日志是否有 `body too large`（应已修，限制 20MB）
- F12 → Network → `inpaint` 是否 200 且 JSON 含 `image` 字段
- 看「处理结果」标题后是否有 ✓

### 只显示文字、无界面

- CSS/JS 未加载：确认 `npm run build` 成功，`.next` 存在
- 强制刷新 F5

### VPS 与 GitHub 不一致

```powershell
npm run deploy:vps:bootstrap
```

### AI 服务繁忙（503）

- 同时请求过多，等几秒重试
- 或调低 `AI_MAX_CONCURRENT`

---

## 10. 本地开发

```powershell
npm install
npm run dev          # http://localhost:3000
```

本地 AI 需 Python 服务：

```powershell
cd python
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn inpaint_server:app --host 127.0.0.1 --port 8765
```

`.env.local`：

```
INPAINT_SERVICE_URL=http://127.0.0.1:8765
```

---

## 11. 安全检查

- **不要**把 VPS 密码提交到 Git
- **不要**在 VPS 上直接改源码（会被下次 deploy 覆盖）
- 建议定期修改 VPS root 密码
- GitHub 为唯一代码备份

---

## 12. 快速检查清单

发布前：

- [ ] 本地 `npm run build` 通过
- [ ] `git push origin master` 完成
- [ ] `npm run deploy:vps` 执行成功
- [ ] `npm run vps:health` 全绿
- [ ] 网站右下角版本号正确
- [ ] 上传一张图测试 AI 修图 + 右侧显示

---

*最后更新：2026-07-31*
