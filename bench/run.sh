#!/usr/bin/env bash
# Runs the shared benchmark against one arm and refreshes runs/scorecard.json.
# Usage: bench/run.sh <a|b> [--no-build]
set -euo pipefail
ARM="${1:?usage: bench/run.sh <a|b> [--no-build]}"
shift || true
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
case "$ARM" in
  a) PKG=arm-a-vibe ;;
  b) PKG=arm-b-harness ;;
  *) echo "unknown arm: $ARM" >&2; exit 2 ;;
esac
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
RUNS="${RUNS_DIR:-runs}"
mkdir -p "$RUNS"
if [ "${1:-}" != "--no-build" ]; then
  echo "== build $PKG"
  pnpm --filter "$PKG" build
fi
: > "$RUNS/security-$ARM.jsonl"
rm -f "$RUNS/arm-$ARM-csp-reports.jsonl"
rm -rf "$RUNS/pw-$ARM"
echo "== benchmark arm $ARM"
set +e
# The two scored suites only; bench/bypass.spec.ts is informational and run by tools/bypass-matrix.sh.
ARM="$ARM" pnpm exec playwright test -c bench/playwright.config.ts bench/functional.spec.ts bench/security.spec.ts
rc=$?
set -e
echo "== playwright exit=$rc (non-zero is the expected outcome for an arm that fires payloads)"
# SCORE_RUN=<n> scores into runs/scorecard-<n>.json instead of the canonical runs/scorecard.json (matrix runs).
node bench/score.ts --runs "$RUNS" ${SCORE_RUN:+--run "$SCORE_RUN"}
