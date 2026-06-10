#!/usr/bin/env python3
"""Check VPS network traffic stats."""
import os
import sys

import paramiko

HOST = os.environ.get("KIRICUT_VPS_HOST", "149.30.239.121")
PASSWORD = os.environ.get("KIRICUT_VPS_PASSWORD", "")

cmds = [
    "date",
    "cat /proc/net/dev | head -5",
    "which vnstat 2>/dev/null && vnstat --summary 2>/dev/null || echo NO_VNSTAT",
    "which nethogs 2>/dev/null || echo NO_NETHOGS",
    "journalctl -u kiricut-inpaint --since today --no-pager | grep -iE 'start|stop|restart|kill|error' | tail -15",
    "journalctl -u kiricut-next --since today --no-pager | grep -iE 'start|stop|restart|kill|error' | tail -15",
    "grep -c 'body too large\\|timed out\\|Connection refused' /var/log/nginx/error.log 2>/dev/null || echo 0",
    "wc -l /var/log/nginx/access.log 2>/dev/null || echo NO_ACCESS_LOG",
    "tail -5 /var/log/nginx/access.log 2>/dev/null",
]

if not PASSWORD:
    print("NO_PASSWORD", file=sys.stderr)
    sys.exit(1)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=30)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
for cmd in cmds:
    print(f"\n=== {cmd} ===")
    _, o, e = c.exec_command(cmd, timeout=30)
    print(o.read().decode("utf-8", errors="replace").strip() or e.read().decode().strip())
c.close()
