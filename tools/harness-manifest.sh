#!/usr/bin/env bash
# Regenerates bench/harness-manifest.sha256 — the reviewed state of arm B's harness.
# verify.sh gate 0 and CI check the harness against it. Run this only when the harness is deliberately changed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/arm-b-harness"
{
  sha256sum verify.sh CLAUDE.md AGENTS.md package.json tsconfig.json tsconfig.tsec.json tsec-exemptions.json eslint.config.js .claude/settings.json
  find harness -type f | sort | xargs sha256sum
} > "$ROOT/bench/harness-manifest.sha256"
echo "wrote bench/harness-manifest.sha256 ($(wc -l < "$ROOT/bench/harness-manifest.sha256") files)"
