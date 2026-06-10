#!/usr/bin/env bash
# VPS 上安装 Python LaMa 推理服务（Debian 12）
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/kiricut}"
PY_DIR="$APP_ROOT/python"
VENV="$PY_DIR/.venv"

echo "==> KiriCut inpaint service setup ($APP_ROOT)"

if ! command -v python3 >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y python3 python3-venv python3-pip
fi

mkdir -p "$APP_ROOT/public/models"
cd "$PY_DIR"

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi

"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r requirements.txt

# 预下载模型（走 hf-mirror）
if [ ! -f "$APP_ROOT/public/models/big-lama.onnx" ]; then
  cd "$APP_ROOT"
  npm run setup-models || true
fi

# systemd
cp "$PY_DIR/kiricut-inpaint.service" /etc/systemd/system/kiricut-inpaint.service
systemctl daemon-reload
systemctl enable kiricut-inpaint
systemctl restart kiricut-inpaint
systemctl --no-pager status kiricut-inpaint

# Next.js 环境变量
ENV_FILE="$APP_ROOT/.env.local"
if ! grep -q INPAINT_SERVICE_URL "$ENV_FILE" 2>/dev/null; then
  echo "INPAINT_SERVICE_URL=http://127.0.0.1:8765" >> "$ENV_FILE"
fi

echo "==> Done. Health: curl -s http://127.0.0.1:8765/health"
