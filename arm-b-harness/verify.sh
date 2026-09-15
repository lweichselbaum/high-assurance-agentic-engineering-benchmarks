#!/usr/bin/env bash
# ┌────────────────────────────────────────────────────────────────────────────┐
# │ verify.sh — the harness. Exit 0 means the change is acceptable.             │
# │ Any other exit: read the FIRST error, fix the code under src/, run again.   │
# │ The gates are not yours to change; gate 0 checks that they were not.        │
# └────────────────────────────────────────────────────────────────────────────┘
set -uo pipefail
cd "$(dirname "$0")"

RUNS="${RUNS_DIR:-$(pwd)/../runs}"
mkdir -p "$RUNS"
LOG="$RUNS/arm-b-iterations.jsonl"
export ARM=b
export SAFETY_WEB_LOG_PATH=NONE
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
export CSP_REPORT_LOG="$RUNS/arm-b-csp-reports.jsonl"
export FORCE_COLOR=0

if [ -f "$LOG" ]; then ITER=$(( $(grep -c '"gate":"0-integrity"' "$LOG") + 1 )); else ITER=1; fi
SNAP="$RUNS/arm-b-snapshots/iter-$ITER"
rm -rf "$SNAP" && mkdir -p "$SNAP" && cp -r src index.html "$SNAP/" 2>/dev/null || true
START=$(date +%s)

BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GREEN=$'\e[32m'; CYAN=$'\e[36m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
json_str() { node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }
log() { printf '{"iter":%d,"gate":"%s","pass":%s,"firstError":%s,"seconds":%d}\n' "$ITER" "$1" "$2" "$(json_str "$3")" "$4" >> "$LOG"; }

gate() {
  local name="$1"; shift
  local t0; t0=$(date +%s)
  printf '\n%s%s── gate %s%s %s%s%s\n' "$BOLD" "$CYAN" "$name" "$RESET" "$DIM" "$*" "$RESET"
  local out rc
  out=$("$@" 2>&1); rc=$?
  local secs=$(( $(date +%s) - t0 ))
  if [ "$rc" -eq 0 ]; then
    printf '%s✔ %s passed%s %s(%ss)%s\n' "$GREEN" "$name" "$RESET" "$DIM" "$secs" "$RESET"
    log "$name" true "" "$secs"
    return 0
  fi
  local first
  first=$(printf '%s\n' "$out" | grep -m1 -iE 'error|✘|failed|violation|FAILED' || printf '%s\n' "$out" | head -n1)
  printf '%s\n' "$out" | head -n "${VERIFY_MAX_LINES:-60}"
  printf '\n%s✘ gate %s FAILED%s — first error:\n  %s%s%s\n' "$RED" "$name" "$RESET" "$BOLD" "$first" "$RESET"
  printf '%sFix the code under src/ and run ./verify.sh again. The gates do not move.%s\n' "$YELLOW" "$RESET"
  log "$name" false "$first" "$secs"
  log ALL false "$name" $(( $(date +%s) - START ))
  exit "$rc"
}

printf '%s%sverify.sh — iteration %d%s %s(7 gates: integrity → tsc → tsec → eslint → build → functional → security)%s\n' "$BOLD" "$CYAN" "$ITER" "$RESET" "$DIM" "$RESET"
gate 0-integrity  sha256sum --quiet -c ../bench/harness-manifest.sha256
gate 1-tsc        pnpm exec tsc --noEmit -p tsconfig.json
gate 2-tsec       pnpm exec tsec -p tsconfig.tsec.json
gate 3-eslint     pnpm exec eslint . --max-warnings 0
gate 4-build      pnpm run build
gate 5-functional pnpm -w exec playwright test -c bench/playwright.config.ts bench/functional.spec.ts
gate 6-security   pnpm -w exec playwright test -c bench/playwright.config.ts bench/security.spec.ts
log ALL true "" $(( $(date +%s) - START ))
printf '\n%s%s✔ all gates passed — verify.sh exit 0 (iteration %d, %ss)%s\n' "$BOLD" "$GREEN" "$ITER" "$(( $(date +%s) - START ))" "$RESET"
