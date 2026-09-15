#!/usr/bin/env node
/**
 * Removes session-identifying data from the run artifacts before publishing:
 *  - stream logs (runs/**\/*.stream.jsonl): session ids, event uuids, API key source, and the agent product's
 *    environment inventory (MCP servers, slash commands, agents, skills, plugins, output style) in the init event
 *  - every text artifact under runs/: the machine-specific checkout path becomes /workspace/benchmark
 * Scores, prompts, tool calls, tool results, model ids, turns, cost and timings are untouched.
 * Idempotent; run from the repo root. Usage: node tools/strip-session-data.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNS = path.join(ROOT, 'runs');
const dry = process.argv.includes('--dry-run');
const HOME_PATH = /\/home\/[a-z0-9_-]+\/high-assurance-agentic-engineering-benchmarks/g;
const NEUTRAL = '/workspace/benchmark';
const DROP_KEYS = [
  'session_id', 'uuid', 'apiKeySource', 'mcp_servers', 'slash_commands', 'terminal_slash_commands', 'agents', 'skills', 'plugins',
  'output_style', 'capabilities', 'memory_paths', 'messaging_socket_path', 'analytics_disabled', 'product_feedback_disabled',
  'fast_mode_state', 'fast_mode_disabled_reason',
];
const TEXT_EXT = new Set(['.jsonl', '.json', '.cast', '.txt', '.md', '.log']);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['tmp', 'lanes', 'node_modules'].includes(e.name) || e.name.startsWith('pw-')) continue;
      walk(p, acc);
    } else if (TEXT_EXT.has(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

let files = 0, streams = 0, keysDropped = 0, pathsRewritten = 0;
for (const file of walk(RUNS)) {
  let text = fs.readFileSync(file, 'utf8');
  let out = text;
  if (file.endsWith('.stream.jsonl')) {
    out = text
      .split('\n')
      .map((line) => {
        if (!line.trim()) return line;
        let e;
        try {
          e = JSON.parse(line);
        } catch {
          return line;
        }
        for (const k of DROP_KEYS) if (k in e) { delete e[k]; keysDropped += 1; }
        return JSON.stringify(e);
      })
      .join('\n');
    streams += 1;
  }
  // Machine-specific paths: the checkout (also when truncated), the agent product's per-project memory key,
  // and the operator's home config directory.
  const extra = [
    // Prefix match: a terminal transcript may cut the path mid-word (`.../high-assurance-agentic-engineeri`).
    [/\/home\/[a-z0-9_-]+\/high-assurance-agentic-engineeri[a-z-]*/g, NEUTRAL],
    [/-home-[a-z0-9_-]+-high-assurance-agentic-engineering-benchmarks/g, '-workspace-benchmark'],
    [/\/root\/\.claude/g, '~/.claude'],
    [/\/tmp\/cc-socks\/[0-9]+\.sock/g, '<socket>'],
  ];
  for (const [re, to] of [[HOME_PATH, NEUTRAL], ...extra]) {
    const n = (out.match(re) ?? []).length;
    if (n) { pathsRewritten += n; out = out.replace(re, to); }
  }
  if (out !== text) {
    files += 1;
    if (!dry) fs.writeFileSync(file, out);
  }
}
console.log(`${dry ? '[dry-run] ' : ''}${files} file(s) changed · ${streams} stream log(s) processed · ${keysDropped} session fields dropped · ${pathsRewritten} path(s) neutralised`);
