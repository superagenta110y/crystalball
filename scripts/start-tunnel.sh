#!/bin/sh
set -eu
if pgrep -f "cloudflared tunnel --config /Users/al/.cloudflared/crystalball-config.yml run crystalball" >/dev/null 2>&1; then
  exit 0
fi
nohup /Users/al/.local/bin/cloudflared tunnel --config /Users/al/.cloudflared/crystalball-config.yml run crystalball >> /Users/al/.openclaw/workspace/crystalball/tunnel.log 2>> /Users/al/.openclaw/workspace/crystalball/tunnel.err.log &
