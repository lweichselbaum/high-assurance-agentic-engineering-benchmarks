#!/usr/bin/env bash
# The full matrix as it was run for the keynote: 10 runs with the default agent model, then 5 runs each
# with three other off-the-shelf models, all through the same lanes. Run 1 is the canonical recorded run.
set -euo pipefail
cd "$(dirname "$0")/.."
LANES="${LANES:-3}"
# Idempotent: a batch whose scorecards all exist is skipped, so the script can be re-run after an interruption.
batch() { # <model> <run indices...>
  local model="$1"; shift; local todo=""
  for i in "$@"; do [ -f "runs/scorecard-$i.json" ] || todo="$todo $i"; done
  [ -n "$todo" ] || { echo "batch $model: all of [$*] scored, skipping"; return 0; }
  bash tools/matrix-lanes.sh --lanes "$LANES" --model "$model" --runs "$todo"
}
batch claude-sonnet-5            2 3 4 5 6 7 8 9 10
batch claude-haiku-4-5-20251001  11 12 13 14 15
batch claude-sonnet-4-5          16 17 18 19 20
# Requests for claude-opus-4-1 were served as claude-opus-5 by the CLI (the served model is what every
# agent-<arm>-<i>.json records and what RESULTS.md groups by), so runs 21-30 are one Opus 5 batch.
batch claude-opus-5              21 22 23 24 25 26 27 28 29 30
node bench/render-results.ts
