#!/usr/bin/env python3
"""查 VPS 历史访问 / AI 调用量（nginx access.log）。

用法:
  set KIRICUT_VPS_PASSWORD=你的密码
  python scripts/vps-usage-report.py
"""
import os
import sys

import paramiko

HOST = os.environ.get("KIRICUT_VPS_HOST", "149.30.239.121")
PASSWORD = os.environ.get("KIRICUT_VPS_PASSWORD", "")

cmds = [
    "date",
    "echo '=== access.log 总行数 ==='",
    "wc -l /var/log/nginx/access.log 2>/dev/null || echo NO_ACCESS_LOG",
    "echo '=== 最近 7 天按日 PV（整站）==='",
    "awk '{print $4}' /var/log/nginx/access.log 2>/dev/null | cut -d: -f1 | tr -d '[' | sort | uniq -c | tail -7",
    "echo '=== AI 修图 API 次数（/api/inpaint）==='",
    "grep -c 'POST /api/inpaint' /var/log/nginx/access.log 2>/dev/null || echo 0",
    "echo '=== 抠图 API 次数（/api/remove-background）==='",
    "grep -c 'POST /api/remove-background' /var/log/nginx/access.log 2>/dev/null || echo 0",
    "echo '=== 最近 20 条 AI 相关访问 ==='",
    "grep -E 'POST /api/(inpaint|remove-background)' /var/log/nginx/access.log 2>/dev/null | tail -20 || echo NONE",
    "echo '=== 新统计文件（部署后）==='",
    "ls -la /home/kiricut/data/usage-stats.json 2>/dev/null || echo '尚未生成 usage-stats.json（需部署含统计的版本并有人用过）'",
    "python3 - <<'PY'\nimport json,os\np='/home/kiricut/data/usage-stats.json'\nif os.path.isfile(p):\n  d=json.load(open(p))\n  print('updatedAt', d.get('updatedAt'))\n  days=sorted((d.get('days') or {}).items())[-7:]\n  for k,v in days: print(k, v)\nelse:\n  print('NO_STATS_FILE')\nPY",
]

if not PASSWORD:
    print("请先设置环境变量 KIRICUT_VPS_PASSWORD", file=sys.stderr)
    sys.exit(1)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=30)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for cmd in cmds:
    print(f"\n=== {cmd.splitlines()[0][:80]} ===")
    _, o, e = c.exec_command(cmd, timeout=60)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    print(out or err or "(empty)")
c.close()
