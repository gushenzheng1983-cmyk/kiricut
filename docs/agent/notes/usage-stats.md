# 用量后台（轻量版）

## 问题

免费期内有人用过，但以前**没有后台**，看不到人数。

## 现在怎么搞

### 1）查历史（立刻）

看 Nginx 访问日志里有没有人打开页面 / 调 AI：

```powershell
$env:KIRICUT_VPS_PASSWORD="你的VPS密码"
python scripts/vps-usage-report.py
```

能看到：按日 PV、`/api/inpaint` 次数、抠图次数。  
注意：日志会轮转，太久以前的可能已经删了。

### 2）往后的统计（部署后自动记）

不存图片、不记账号，只记次数到服务器文件 `data/usage-stats.json`：

| 事件 | 含义 |
|------|------|
| `page_ping` | 有人打开应用 |
| `inpaint_ok` / `inpaint_fail` | AI 修图成功/失败 |
| `bg_ok` / `bg_fail` | 抠图成功/失败 |
| `activate_ok` | 有人激活了 Pro 码 |

查看方式（部署后）：

```text
GET https://你的域名/api/usage?days=30
```

建议在 VPS 环境变量加密钥：

```text
USAGE_STATS_SECRET=随便一串长密码
```

然后：

```text
GET /api/usage?days=30&secret=随便一串长密码
```

或本地：

```powershell
curl "http://localhost:3000/api/usage?days=30"
```

## 隐私

- 不上传、不保存商品图到统计文件  
- 只有计数，没有用户名、没有微信号  
- 图片仍按原逻辑处理（修图走服务端推理，统计只记次数）
