#!/bin/sh
set -eu
cd /Users/al/.openclaw/workspace/crystalball/backend
if lsof -iTCP:8000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  exit 0
fi
nohup /Users/al/.openclaw/workspace/crystalball/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 >> /Users/al/.openclaw/workspace/crystalball/backend/backend.log 2>> /Users/al/.openclaw/workspace/crystalball/backend/backend.err.log &
