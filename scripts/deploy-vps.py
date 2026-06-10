#!/usr/bin/env python3
"""
KiriCut 统一部署脚本（唯一入口）

用法:
  set KIRICUT_VPS_PASSWORD=***
  python scripts/deploy-vps.py              # git pull + build + systemd 重启
  python scripts/deploy-vps.py --sync-tar   # 无 git 时用 tar 全量同步源码

环境变量:
  KIRICUT_VPS_HOST  默认 149.30.239.121
  KIRICUT_VPS_USER  默认 root
  KIRICUT_VPS_PASSWORD  必填
  KIRICUT_GIT_BRANCH  默认 master
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("KIRICUT_VPS_HOST", "149.30.239.121")
USER = os.environ.get("KIRICUT_VPS_USER", "root")
PASSWORD = os.environ.get("KIRICUT_VPS_PASSWORD", "")
BRANCH = os.environ.get("KIRICUT_GIT_BRANCH", "master")
GIT_REMOTE = os.environ.get(
    "KIRICUT_GIT_REMOTE",
    "https://github.com/gushenzheng1983-cmyk/kiricut.git",
)
ROOT = Path(__file__).resolve().parent.parent
REMOTE_ROOT = "/home/kiricut"

# tar 同步时排除的大目录
TAR_EXCLUDE = {
    "node_modules",
    ".next",
    ".git",
    "python/.venv",
    "__pycache__",
    ".cursor",
}

REMOTE_SETUP = r"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "=== cleanup legacy ==="
rm -rf /home/kiricut/public/ort
rm -f /home/kiricut/.deploy-src.tar.gz
rm -f /etc/nginx/conf.d/default.conf.bak

echo "=== nginx ==="
rm -f /etc/nginx/conf.d/*.conf
cp /home/kiricut/scripts/nginx-kiricut.conf /etc/nginx/sites-available/kiricut
ln -sf /etc/nginx/sites-available/kiricut /etc/nginx/sites-enabled/kiricut
rm -f /etc/nginx/sites-enabled/default
grep -q 'client_max_body_size' /etc/nginx/nginx.conf || \
  sed -i '/http {/a \    client_max_body_size 20m;' /etc/nginx/nginx.conf
nginx -t
systemctl reload nginx

echo "=== systemd units ==="
cp /home/kiricut/python/kiricut-inpaint.service /etc/systemd/system/
cp /home/kiricut/scripts/kiricut-next.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable kiricut-inpaint kiricut-next

echo "=== swap (2G) ==="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "=== python deps ==="
cd /home/kiricut/python
test -d .venv || python3 -m venv .venv
.venv/bin/pip install -q -U pip
.venv/bin/pip install -q -r requirements.txt

echo "=== node build ==="
cd /home/kiricut
npm install
npm run build > /var/log/kiricut-build.log 2>&1
echo BUILD_EXIT:$?

echo "=== restart services ==="
pkill -f 'next-server' 2>/dev/null || true
pkill -f 'next start' 2>/dev/null || true
sleep 2
systemctl restart kiricut-inpaint
systemctl restart kiricut-next
sleep 6

echo "=== health ==="
systemctl is-active nginx kiricut-inpaint kiricut-next
curl -s http://127.0.0.1:8765/health
curl -s http://127.0.0.1:3000/api/inpaint/health
curl -s -o /dev/null -w 'HOME:%{http_code}\n' http://127.0.0.1/
node -e "const p=require('./package.json');const b=require('fs').readFileSync('src/lib/buildInfo.ts','utf8');console.log('PKG',p.version);console.log(b.match(/BUILD_SHA.*/)?.[0]||'no-sha')"
"""


def local_git_sha() -> str:
    try:
        return (
            subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=ROOT,
                stderr=subprocess.DEVNULL,
            )
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def make_source_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(ROOT)
            parts = set(rel.parts)
            if parts & TAR_EXCLUDE:
                continue
            if any(p in TAR_EXCLUDE for p in rel.parts):
                continue
            tar.add(path, arcname=str(rel).replace("\\", "/"))
    buf.seek(0)
    return buf.read()


def ssh_connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    return client


def run_remote(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> str:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
    if err:
        print(err, file=sys.stderr)
    return out


def bootstrap_git(client: paramiko.SSHClient) -> None:
    print(f"[git] 初始化 VPS 仓库并对齐 origin/{BRANCH}...")
    cmd = f"""
set -e
cd {REMOTE_ROOT}
if [ ! -d .git ]; then
  git init
  git remote add origin {GIT_REMOTE} 2>/dev/null || git remote set-url origin {GIT_REMOTE}
fi
git fetch origin
git checkout -B {BRANCH} origin/{BRANCH}
git reset --hard origin/{BRANCH}
git clean -fd
git rev-parse --short HEAD
"""
    run_remote(client, cmd, timeout=180)


def deploy_git(client: paramiko.SSHClient) -> None:
    print(f"[1/3] git pull on VPS (branch {BRANCH})...")
    cmd = f"""
set -e
cd {REMOTE_ROOT}
if [ ! -d .git ]; then
  echo "NO_GIT_REPO"
  exit 2
fi
git fetch origin
git checkout {BRANCH}
git pull --ff-only origin {BRANCH}
git rev-parse --short HEAD
"""
    out = run_remote(client, cmd, timeout=120)
    if "NO_GIT_REPO" in out:
        bootstrap_git(client)


def deploy_tar(client: paramiko.SSHClient) -> None:
    print("[1/3] tar sync source to VPS...")
    data = make_source_tarball()
    print(f"  tarball {len(data) / 1024 / 1024:.1f} MB")
    sftp = client.open_sftp()
    remote_tar = f"{REMOTE_ROOT}/.deploy-src.tar.gz"
    with sftp.file(remote_tar, "wb") as f:
        f.write(data)
    sftp.close()
    run_remote(
        client,
        f"cd {REMOTE_ROOT} && tar -xzf .deploy-src.tar.gz && rm -f .deploy-src.tar.gz",
        timeout=180,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy KiriCut to VPS")
    parser.add_argument(
        "--sync-tar",
        action="store_true",
        help="紧急：tar 全量同步（跳过 git）",
    )
    parser.add_argument(
        "--bootstrap-git",
        action="store_true",
        help="强制 VPS 与 GitHub origin 硬对齐（会丢弃 VPS 本地改动）",
    )
    args = parser.parse_args()

    if not PASSWORD:
        print("请设置环境变量 KIRICUT_VPS_PASSWORD", file=sys.stderr)
        return 1

    print(f"KiriCut deploy → {HOST}")
    print(f"本地版本: {local_git_sha()}")

    subprocess.run(
        ["node", "scripts/write-build-info.mjs"],
        cwd=ROOT,
        check=True,
    )

    client = ssh_connect()
    try:
        if args.bootstrap_git:
            bootstrap_git(client)
        elif args.sync_tar:
            deploy_tar(client)
        else:
            deploy_git(client)

        print("[2/3] install + build + restart...")
        run_remote(client, REMOTE_SETUP, timeout=900)

        print("[3/3] done.")
    finally:
        client.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
