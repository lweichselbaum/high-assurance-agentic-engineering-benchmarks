#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/bin:$HOME/.local/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

run_idx="${1:?usage: tools/matrix-antigravity.sh <run_idx> <model_id>}"
model="${2:?usage: tools/matrix-antigravity.sh <run_idx> <model_id>}"

# Ensure ports are free
fuser -k 4173/tcp 4174/tcp 2>/dev/null || true

run_arm() {
  local arm="$1"
  local run="$2"
  local mod="$3"
  local dir
  case "$arm" in
    a) dir="arm-a-vibe" ;;
    b) dir="arm-b-harness" ;;
    *) echo "unknown arm $arm" >&2; exit 2 ;;
  esac

  echo "================================================================================"
  echo "== [Run $run] [$mod] Preparing Arm $arm..."
  echo "================================================================================"
  bash tools/run-external.sh prepare "$arm" "$run"

  local prompt
  prompt="$(cat app-spec/FEATURE_PROMPT.md)"$'\n\n---\n\n'"$(case "$arm" in a) printf 'Make it work. Ship a build.\n' ;; b) printf 'Implement the feature. `./verify.sh` must pass. If it fails, fix your code and run it again. Do not modify config, tests, tsconfig, ESLint, or the CSP.\n' ;; esac)"

  local log_file="runs/external/agent-${arm}-${run}.log"
  echo "== [Run $run] [$mod] Running builder in $dir/..."

  (
    cd "$dir"
    fuser -k 4173/tcp 4174/tcp 2>/dev/null || true
    local agent_cli="${AGENT_CLI:-agent}"
    "$agent_cli" -p "$prompt" \
      --model "$mod" \
      --dangerously-skip-permissions \
      --print-timeout 30m \
      --output-format stream-json > "../$log_file" 2>&1
  ) || true

  fuser -k 4173/tcp 4174/tcp 2>/dev/null || true
  sleep 1

  local turns=1
  local exit_code=0
  if grep -q '"event":"result"' "$log_file"; then
    turns=$(node -e '
      const fs=require("fs");
      const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n");
      const res=JSON.parse(lines.reverse().find(l=>l.includes("\"event\":\"result\""))||"{}");
      console.log(res.result?.num_turns || 1);
    ' "$log_file")
    local status
    status=$(node -e '
      const fs=require("fs");
      const lines=fs.readFileSync(process.argv[1],"utf8").trim().split("\n");
      const res=JSON.parse(lines.reverse().find(l=>l.includes("\"event\":\"result\""))||"{}");
      console.log(res.result?.status || "ERROR");
    ' "$log_file")
    if [ "$status" != "SUCCESS" ]; then
      exit_code=1
    fi
  else
    exit_code=1
  fi

  local started_file="runs/external/started-${arm}-${run}"
  if [ ! -f "$started_file" ]; then
    date -u +%FT%TZ > "$started_file"
  fi

  echo "== [Run $run] [$mod] Finishing Arm $arm (turns: $turns, exit: $exit_code)..."
  bash tools/run-external.sh finish "$arm" "$run" --model "$mod" --agent "Google Antigravity" --turns "$turns" --exit "$exit_code"
}

run_arm a "$run_idx" "$model"
run_arm b "$run_idx" "$model"

git add runs RESULTS.md
git diff --cached --quiet || git commit -m "Matrix run $run_idx ($model via Antigravity)"
echo "== [Run $run_idx] [$model] Run finished."
