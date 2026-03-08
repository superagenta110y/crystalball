#!/bin/sh
set -eu
cd /Users/al/.openclaw/workspace/crystalball/frontend
if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  exit 0
fi
export BACKEND_API_URL=http://127.0.0.1:8000
nohup /opt/homebrew/bin/npm run dev -- -p 3000 -H 127.0.0.1 >> /Users/al/.openclaw/workspace/crystalball/frontend/frontend.log 2>> /Users/al/.openclaw/workspace/crystalball/frontend/frontend.err.log &
