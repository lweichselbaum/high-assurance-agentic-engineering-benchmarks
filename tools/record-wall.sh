#!/usr/bin/env bash
# Records the isolated generate → refuse → refactor → pass sequence to runs/arm-b-wall.cast.
# Usage: tools/record-wall.sh [wall.mjs options, e.g. --iter 1 | --synthetic]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
asciinema rec --overwrite --cols "${CAST_COLS:-140}" --rows "${CAST_ROWS:-42}" --title "arm B — the wall" \
  -c "node tools/wall.mjs $*" runs/arm-b-wall.cast
echo "→ runs/arm-b-wall.cast"
