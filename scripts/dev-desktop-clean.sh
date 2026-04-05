#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORT_PIDS="$(lsof -tiTCP:3001 -sTCP:LISTEN || true)"
if [[ -n "${PORT_PIDS}" ]]; then
  echo "[brifo] Releasing port 3001: ${PORT_PIDS}"
  kill -TERM ${PORT_PIDS} || true
  sleep 1
  PORT_PIDS="$(lsof -tiTCP:3001 -sTCP:LISTEN || true)"
  if [[ -n "${PORT_PIDS}" ]]; then
    kill -KILL ${PORT_PIDS} || true
  fi
fi

pkill -f "${ROOT_DIR}/node_modules/.bin/ts-node-dev --respawn --transpile-only src/main.ts" || true

exec npm run dev:desktop
