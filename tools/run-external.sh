#!/usr/bin/env bash
# Matrix runs with an EXTERNAL agent (an IDE agent such as Google Antigravity, Cursor, Copilot, ...) instead
# of tools/run-agent-claude-code.mjs. The operator drives the agent; this script does everything around it so that the
# run is scored exactly like the CLI-driven runs and shows up in RESULTS.md grouped by model.
#
#   tools/run-external.sh prepare <a|b> <run>
#       resets the arm to the pristine scaffold and prints the EXACT prompt to give the agent (nothing else)
#   tools/run-external.sh finish <a|b> <run> --model <id> [--agent "Google Antigravity"] [--turns N] [--exit 0]
#       records the agent metadata, runs the shared benchmark, saves the app, scores the run
#   tools/run-external.sh score <run>
#       (re)scores a run whose two arms are finished and re-renders RESULTS.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
cmd="${1:-}"; shift || true
EXT="runs/external"
mkdir -p "$EXT"

instruction() { # the arm instruction, byte-identical to tools/run-agent-claude-code.mjs
  case "$1" in
    a) printf 'Make it work. Ship a build.\n' ;;
    b) printf 'Implement the feature. `./verify.sh` must pass. If it fails, fix your code and run it again. Do not modify config, tests, tsconfig, ESLint, or the CSP.\n' ;;
  esac
}
armdir() { case "$1" in a) echo arm-a-vibe ;; b) echo arm-b-harness ;; *) echo "unknown arm: $1" >&2; exit 2 ;; esac; }

case "$cmd" in
  prepare)
    arm="${1:?arm}"; run="${2:?run}"
    dir="$(armdir "$arm")"
    if [ -f "$EXT/bench-$arm-$run" ]; then echo "arm $arm of run $run is already finished — pick an unused index (ls runs/scorecard-*.json)" >&2; exit 2; fi
    if [ -f "runs/scorecard-$run.json" ] && [ ! -f "$EXT/started-a-$run" ] && [ ! -f "$EXT/started-b-$run" ]; then echo "run $run already exists (CLI-driven) — pick an unused index" >&2; exit 2; fi
    bash tools/reset-arm.sh "$arm" --runs >/dev/null
    rm -f "$EXT/bench-$arm-$run"
    date -u +%FT%TZ > "$EXT/started-$arm-$run"
    cat <<MSG
arm $arm reset to the scaffold in $dir/. Open a NEW agent conversation whose workspace is ONLY that directory,
select the model, and give the agent exactly the text between the two lines below — nothing more, nothing less.
================================================================================
MSG
    cat app-spec/FEATURE_PROMPT.md
    printf '\n---\n\n'
    instruction "$arm"
    cat <<MSG
================================================================================
When the agent says it is done (arm b: when ./verify.sh exits 0), run:
  tools/run-external.sh finish $arm $run --model "<model id as shown in the picker>" --agent "<IDE name>" --turns <n>
MSG
    ;;

  finish)
    arm="${1:?arm}"; run="${2:?run}"; shift 2
    model=""; agent="external IDE agent"; turns="null"; exit_code=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --model) model="$2"; shift 2 ;;
        --agent) agent="$2"; shift 2 ;;
        --turns) turns="$2"; shift 2 ;;
        --exit) exit_code="$2"; shift 2 ;;
        *) echo "unknown option $1" >&2; exit 2 ;;
      esac
    done
    [ -n "$model" ] || { echo "--model <id> is required (the model as shown in the IDE's picker)" >&2; exit 2; }
    [ -f "$EXT/started-$arm-$run" ] || { echo "no 'prepare $arm $run' on record — run prepare first" >&2; exit 2; }
    dir="$(armdir "$arm")"
    ARM_ID="$arm" DIR="$dir" RUN="$run" MODEL="$model" AGENT="$agent" TURNS="$turns" EXIT="$exit_code" node -e '
      const fs=require("fs"),crypto=require("crypto");
      const {ARM_ID,DIR,RUN,MODEL,AGENT,TURNS,EXIT}=process.env;
      const prompt=fs.readFileSync("app-spec/FEATURE_PROMPT.md");
      const meta={arm:ARM_ID,label:ARM_ID==="a"?"Arm A — vibe (no guardrails)":"Arm B — high-assurance harness",
        agent:AGENT,external:true,claudeCodeVersion:null,requestedModel:MODEL,model:MODEL,
        temperature:"not configurable (IDE default)",permissionMode:"IDE agent, operator-driven",
        instruction:ARM_ID==="a"?"Make it work. Ship a build.":"Implement the feature. `./verify.sh` must pass. If it fails, fix your code and run it again. Do not modify config, tests, tsconfig, ESLint, or the CSP.",
        promptSha256:crypto.createHash("sha256").update(prompt).digest("hex"),promptBytes:prompt.length,
        startedAt:fs.readFileSync(`runs/external/started-${ARM_ID}-${RUN}`,"utf8").trim(),finishedAt:new Date().toISOString(),
        exitCode:Number(EXIT),numTurns:TURNS==="null"?null:Number(TURNS),costUsd:null,
        verifyRuns:ARM_ID==="b"&&fs.existsSync("runs/arm-b-iterations.jsonl")?fs.readFileSync("runs/arm-b-iterations.jsonl","utf8").split("\n").filter(l=>l.includes("\"gate\":\"0-integrity\"")).length:null};
      fs.writeFileSync(`runs/agent-${ARM_ID}-${RUN}.json`,JSON.stringify(meta,null,2)+"\n");
      console.log(`runs/agent-${ARM_ID}-${RUN}.json written (${MODEL} via ${AGENT})`);'
    echo "== benchmark arm $arm (run $run)"
    SCORE_RUN="$run" bash bench/run.sh "$arm" || true
    out="runs/matrix/run-$run/arm-$arm"; rm -rf "$out"; mkdir -p "$out"
    cp -r "$dir/src" "$dir/index.html" "$out/"
    [ -d "$dir/public" ] && cp -r "$dir/public" "$out/public" || true
    if [ "$arm" = b ]; then
      cp runs/arm-b-iterations.jsonl "$out/" 2>/dev/null || true
      [ -d runs/arm-b-snapshots ] && cp -r runs/arm-b-snapshots "$out/snapshots" || true
    fi
    date -u +%FT%TZ > "$EXT/bench-$arm-$run"
    echo "== arm $arm of run $run finished; app saved to $out"
    if [ -f "$EXT/bench-a-$run" ] && [ -f "$EXT/bench-b-$run" ]; then
      node bench/score.ts --run "$run" && node bench/render-results.ts
    else
      echo "(score + RESULTS.md will be produced when the other arm of run $run is finished)"
    fi
    ;;

  score)
    run="${1:?run}"
    [ -f "$EXT/bench-a-$run" ] && [ -f "$EXT/bench-b-$run" ] || { echo "both arms of run $run must be finished first" >&2; exit 2; }
    node bench/score.ts --run "$run" && node bench/render-results.ts
    ;;

  *)
    sed -n '2,12p' "$0"; exit 2 ;;
esac
