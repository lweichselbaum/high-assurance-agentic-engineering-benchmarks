#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

start_idx="${1:?usage: tools/batch-matrix.sh <start_idx> <end_idx> <model>}"
end_idx="${2:?usage: tools/batch-matrix.sh <start_idx> <end_idx> <model>}"
model="${3:?usage: tools/batch-matrix.sh <start_idx> <end_idx> <model>}"

for ((i=start_idx; i<=end_idx; i++)); do
  echo "################################################################################"
  echo "## [$(date -u +%FT%TZ)] Starting Run $i with $model"
  echo "################################################################################"
  bash tools/matrix-antigravity.sh "$i" "$model"
  echo "## [$(date -u +%FT%TZ)] Completed Run $i with $model"
done
