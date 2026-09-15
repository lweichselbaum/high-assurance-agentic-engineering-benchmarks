#!/usr/bin/env bash
# Reproducibility matrix: N independent runs of both arms from a clean scaffold, one scorecard per run,
# aggregated into RESULTS.md. Stochasticity is real; report the distribution, not one lucky run.
#
# Usage: ./run-matrix.sh [N=10] [--model claude-sonnet-5] [--from K] [--keep-canonical]
#   AGENT_MODEL env also selects the model. Each run i writes runs/scorecard-i.json, runs/agent-{a,b}-i.json,
#   runs/agent-{a,b}-i.stream.jsonl and runs/matrix/run-i/ (the app code both agents produced).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
N=10
FROM=1
RUNS_LIST=""
MODEL="${AGENT_MODEL:-claude-sonnet-5}"
while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="$2"; shift 2 ;;
    --from) FROM="$2"; shift 2 ;;
    --runs) RUNS_LIST="$2"; shift 2 ;;   # explicit space-separated run indices (used by tools/matrix-lanes.sh)
    [0-9]*) N="$1"; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[ -n "$RUNS_LIST" ] || RUNS_LIST="$(seq "$FROM" "$N" | tr '\n' ' ')"
export AGENT_MODEL="$MODEL"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
mkdir -p runs/matrix

run_arm() { # <a|b> <i>
  local arm="$1" i="$2"
  bash tools/reset-arm.sh "$arm" --runs >/dev/null
  echo "== run $i · arm $arm · agent"
  node tools/run-agent-claude-code.mjs --arm "$arm" --run "$i" --quiet > "runs/matrix/agent-$arm-$i.log" 2>&1 || echo "   (agent exited non-zero; scoring anyway)"
  echo "== run $i · arm $arm · benchmark"
  bash bench/run.sh "$arm" > "runs/matrix/bench-$arm-$i.log" 2>&1 || true
  local dir="runs/matrix/run-$i/arm-$arm"
  rm -rf "$dir"; mkdir -p "$dir"
  if [ "$arm" = a ]; then
    cp -r arm-a-vibe/src arm-a-vibe/index.html "$dir/"
    [ -d arm-a-vibe/public ] && cp -r arm-a-vibe/public "$dir/public" || true
  else
    cp -r arm-b-harness/src arm-b-harness/index.html "$dir/"
    [ -d arm-b-harness/public ] && cp -r arm-b-harness/public "$dir/public" || true
    cp runs/arm-b-iterations.jsonl "$dir/" 2>/dev/null || true
    # Every verify.sh iteration's app state — the agent's real attempts, including the refused ones.
    [ -d runs/arm-b-snapshots ] && cp -r runs/arm-b-snapshots "$dir/snapshots" || true
  fi
}

for i in $RUNS_LIST; do
  echo "=================== matrix run $i · model $MODEL ==================="
  # The two arms are independent (separate directories and ports): run them side by side.
  run_arm a "$i" &
  PA=$!
  run_arm b "$i" &
  PB=$!
  wait "$PA" || true
  wait "$PB" || true
  node bench/score.ts --run "$i"
  node bench/render-results.ts
done
echo "matrix done: runs [$RUNS_LIST] → RESULTS.md"
