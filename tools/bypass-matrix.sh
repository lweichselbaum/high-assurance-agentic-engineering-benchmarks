#!/usr/bin/env bash
# Runs the bypass probe (bench/bypass.spec.ts) against every saved matrix run's app, both arms.
# Restores each arm's app from runs/matrix/run-<i>/, builds it, runs the probe, writes runs/bypass-results.json.
# The canonical app is put back at the end. Informational: this is beyond the fixed corpus.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
fuser -k 4173/tcp 4174/tcp 2>/dev/null || true
OUT="runs/bypass-results.json"
# --append keeps existing entries and skips (run, arm) pairs already probed, so the probe can run incrementally.
if [ "${1:-}" = "--append" ] && [ -f "$OUT" ]; then :; else echo "[]" > "$OUT"; fi
for dir in $(ls -d runs/matrix/run-* | sort -t- -k2 -n); do
  i="${dir##*-}"
  for arm in a b; do
    src="$dir/arm-$arm"
    [ -d "$src/src" ] || continue
    if node -e "process.exit(require('./$OUT').some(e=>e.run==='$i'&&e.arm==='$arm')?0:1)" 2>/dev/null; then continue; fi
    case "$arm" in a) ARMDIR=arm-a-vibe; PKG=arm-a-vibe ;; b) ARMDIR=arm-b-harness; PKG=arm-b-harness ;; esac
    rm -rf "$ARMDIR/src" "$ARMDIR/public" && cp -r "$src/src" "$ARMDIR/src" && cp "$src/index.html" "$ARMDIR/index.html"
    [ -d "$src/public" ] && cp -r "$src/public" "$ARMDIR/public" || true
    # An app that loads its seed data from public/ cannot be probed when that directory was not saved with the run.
    if grep -qE "fetch\(['\"]/fixtures" "$src"/src/*.ts 2>/dev/null && [ ! -d "$src/public" ]; then echo "run $i arm $arm: saved app fetches /fixtures.json but public/ was not saved — skipping"; continue; fi
    if ! pnpm --filter "$PKG" build > /dev/null 2>&1; then echo "run $i arm $arm: build failed, skipping"; continue; fi
    fuser -k 4173/tcp 4174/tcp 2>/dev/null || true
    : > "runs/bypass-$arm.jsonl"
    ARM="$arm" pnpm exec playwright test -c bench/playwright.config.ts bench/bypass.spec.ts --reporter=dot > /dev/null 2>&1 || true
    fuser -k 4173/tcp 4174/tcp 2>/dev/null || true
    model=$(node -e "try{console.log(require('./runs/scorecard-$i.json').arm${arm^^}.agent.model)}catch{console.log('?')}")
    node -e "
      const fs=require('fs');const rows=fs.readFileSync('runs/bypass-$arm.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);
      const all=JSON.parse(fs.readFileSync('$OUT','utf8'));
      all.push({run:'$i',arm:'$arm',model:'$model',total:rows.length,fired:rows.filter(r=>r.fired).map(r=>r.id)});
      fs.writeFileSync('$OUT',JSON.stringify(all,null,2)+'\n');
      console.log('run $i arm $arm ($model): '+rows.filter(r=>r.fired).length+'/'+rows.length+' bypass variants executed'+(rows.some(r=>r.fired)?' → '+rows.filter(r=>r.fired).map(r=>r.id).join(', '):''));"
  done
done
echo "== restoring canonical apps"
rm -rf arm-a-vibe/src arm-a-vibe/public && cp -r runs/canonical/arm-a/src arm-a-vibe/src && cp runs/canonical/arm-a/index.html arm-a-vibe/index.html
rm -rf arm-b-harness/src arm-b-harness/public && cp -r runs/canonical/arm-b/src arm-b-harness/src && cp runs/canonical/arm-b/index.html arm-b-harness/index.html
echo "→ $OUT"
