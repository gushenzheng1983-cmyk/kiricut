#!/usr/bin/env python3
"""VPS 运维：python scripts/vps-ops.py [health|diagnose|version]"""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("KIRICUT_VPS_HOST", "149.30.239.121")
USER = os.environ.get("KIRICUT_VPS_USER", "root")
PASSWORD = os.environ.get("KIRICUT_VPS_PASSWORD", "")

HEALTH_CMDS = [
    "nproc",
    "free -h",
    "swapon --show",
    "systemctl is-active nginx kiricut-inpaint kiricut-next",
    "curl -s http://127.0.0.1:8765/health",
    "curl -s http://127.0.0.1:3000/api/inpaint/health",
    "curl -s -o /dev/null -w 'HOME:%{http_code}\n' http://127.0.0.1/",
]

DIAGNOSE_CMDS = HEALTH_CMDS + [
    "uptime",
    "df -h /",
    "ss -tlnp | grep -E ':8765|:3000|:80'",
    "cd /home/kiricut && git rev-parse --short HEAD 2>/dev/null || echo NO_GIT",
    "grep BUILD_SHA /home/kiricut/src/lib/buildInfo.ts 2>/dev/null || echo NO_BUILD_INFO",
    "tail -5 /var/log/nginx/error.log",
    "journalctl -u kiricut-inpaint -n 8 --no-pager",
    "dmesg -T 2>/dev/null | grep -iE 'oom|kill' | tail -3 || true",
]


def run(mode: str) -> int:
    if not PASSWORD:
        print("请设置 KIRICUT_VPS_PASSWORD", file=sys.stderr)
        return 1
    cmds = {"health": HEALTH_CMDS, "diagnose": DIAGNOSE_CMDS}.get(mode)
    if mode == "version":
        cmds = [
            "cd /home/kiricut && git log -1 --oneline 2>/dev/null || echo NO_GIT",
            "grep -E 'APP_VERSION|BUILD_SHA' /home/kiricut/src/lib/buildInfo.ts",
        ]
    if not cmds:
        print("用法: vps-ops.py [health|diagnose|version]", file=sys.stderr)
        return 1

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    for cmd in cmds:
        print(f"\n=== {cmd} ===")
        _, stdout, stderr = client.exec_command(cmd, timeout=45)
        print(stdout.read().decode("utf-8", errors="replace").strip() or stderr.read().decode().strip())
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1] if len(sys.argv) > 1 else "health"))
