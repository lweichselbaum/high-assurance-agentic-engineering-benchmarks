#!/usr/bin/env bash
# Resets an arm to its pristine scaffold (the state the agent starts from). Keeps node_modules and the harness.
# Usage: tools/reset-arm.sh <a|b> [--runs]   (--runs also clears arm B's iteration log and snapshots)
set -euo pipefail
ARM="${1:?usage: tools/reset-arm.sh <a|b> [--runs]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$ARM" in
  a) DIR="$ROOT/arm-a-vibe";    KEEP='node_modules .scaffold .claude CLAUDE.md AGENTS.md package.json tsconfig.json server.mjs smoke.mjs' ;;
  b) DIR="$ROOT/arm-b-harness"; KEEP='node_modules .scaffold .claude CLAUDE.md AGENTS.md package.json tsconfig.json tsconfig.tsec.json tsec-exemptions.json eslint.config.js verify.sh harness' ;;
  *) echo "unknown arm: $ARM" >&2; exit 2 ;;
esac
cd "$DIR"
for entry in * .[!.]*; do
  [ -e "$entry" ] || continue
  keep=0
  for k in $KEEP; do [ "$entry" = "$k" ] && keep=1; done
  [ $keep -eq 1 ] || rm -rf -- "$entry"
done
cp -r .scaffold/src src
cp .scaffold/index.html index.html
cp "$ROOT/app-spec/fixtures.json" fixtures.json
if [ "${2:-}" = "--runs" ]; then
  RUNS="${RUNS_DIR:-$ROOT/runs}"
  [ "$ARM" = b ] && rm -rf "$RUNS/arm-b-iterations.jsonl" "$RUNS/arm-b-snapshots" "$RUNS/arm-b-csp-reports.jsonl"
  rm -rf "$RUNS/security-$ARM.jsonl" "$RUNS/pw-$ARM" "$RUNS/arm-$ARM-csp-reports.jsonl"
fi
echo "arm $ARM reset to scaffold"
