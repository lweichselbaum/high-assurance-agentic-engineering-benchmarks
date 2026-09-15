#!/usr/bin/env bash
# Runs the reproducibility matrix in parallel lanes. Each lane is a git worktree of HEAD with its own
# node_modules (from the pnpm store), its own runs/ and its own ports, so lanes never touch each other.
# Run indices are dealt round-robin to the lanes; results are copied back into the main runs/ directory.
#
# Usage: tools/matrix-lanes.sh --runs "1 2 3 4 5 6" --lanes 3 [--model claude-sonnet-5]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNS_LIST=""; LANES=3; MODEL="${AGENT_MODEL:-claude-sonnet-5}"
while [ $# -gt 0 ]; do
  case "$1" in
    --runs) RUNS_LIST="$2"; shift 2 ;;
    --lanes) LANES="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[ -n "$RUNS_LIST" ] || { echo "--runs \"i j k\" is required" >&2; exit 2; }
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
mkdir -p runs/lanes runs/matrix

declare -a LANE_RUNS
k=0
for i in $RUNS_LIST; do
  LANE_RUNS[$((k % LANES))]="${LANE_RUNS[$((k % LANES))]:-} $i"
  k=$((k + 1))
done

# Trust every lane path up front (single writer) so the runners in parallel lanes never race on ~/.claude.json.
node -e '
const fs=require("fs"),path=require("path");const f=path.join(process.env.HOME,".claude.json");
const cfg=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{};cfg.projects??={};
for(let l=0;l<Number(process.argv[1]);l++)for(const d of ["",`/arm-a-vibe`,`/arm-b-harness`]){const p=`${process.cwd()}/runs/lanes/lane-${l}${d}`;cfg.projects[p]??={};cfg.projects[p].hasTrustDialogAccepted=true;}
fs.writeFileSync(f+".tmp",JSON.stringify(cfg,null,2));fs.renameSync(f+".tmp",f);' "$LANES"

pids=()
for ((l = 0; l < LANES; l++)); do
  runs="${LANE_RUNS[$l]:-}"
  [ -n "$runs" ] || continue
  dir="$ROOT/runs/lanes/lane-$l"
  if [ ! -d "$dir/.git" ] && [ ! -f "$dir/.git" ]; then
    git worktree add -f --detach "$dir" HEAD >/dev/null
  else
    # A lane's previous outputs (runs/, agent-written app files) are untracked there but tracked in the new HEAD;
    # drop everything except node_modules before moving the lane to the current commit.
    (cd "$dir" && git reset -q --hard && git clean -fdxq -e node_modules && git checkout -q --detach "$(git -C "$ROOT" rev-parse HEAD)")
  fi
  (cd "$dir" && pnpm install --frozen-lockfile --offline --silent)
  echo "lane $l → runs [$runs ] · ports $((4200 + l * 10))/$((4201 + l * 10))"
  (
    cd "$dir"
    PORT_BASE=$((4200 + l * 10)) AGENT_MODEL="$MODEL" ./run-matrix.sh --runs "$runs" --model "$MODEL" > "$ROOT/runs/lanes/lane-$l.log" 2>&1 || echo "lane $l: run-matrix exited non-zero"
    for i in $runs; do
      cp "runs/scorecard-$i.json" "$ROOT/runs/" 2>/dev/null || true
      cp runs/agent-a-"$i".json runs/agent-b-"$i".json runs/agent-a-"$i".stream.jsonl runs/agent-b-"$i".stream.jsonl "$ROOT/runs/" 2>/dev/null || true
      rm -rf "$ROOT/runs/matrix/run-$i"; cp -r "runs/matrix/run-$i" "$ROOT/runs/matrix/" 2>/dev/null || true
      cp runs/matrix/agent-*-"$i".log runs/matrix/bench-*-"$i".log "$ROOT/runs/matrix/" 2>/dev/null || true
    done
    echo "lane $l done"
  ) &
  pids+=($!)
  sleep 5
done
for p in "${pids[@]}"; do wait "$p" || true; done
node bench/render-results.ts
echo "all lanes done → RESULTS.md"
