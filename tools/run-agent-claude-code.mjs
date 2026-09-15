#!/usr/bin/env node
/**
 * Runs one arm with the Claude Code CLI (`claude -p`) as the agent under test. This is the runner the Claude
 * runs used; any other agent or IDE goes through tools/run-external.sh (Google Antigravity's runs did).
 *
 *  - byte-identical feature prompt for both arms (app-spec/FEATURE_PROMPT.md) + the arm's one-line instruction
 *  - scrubbed environment: the agent sees only PATH/HOME/TERM and the browser path, nothing from this session
 *  - permissions come from <arm>/.claude/settings.json (arm B: harness files are deny-listed)
 *  - stream-json output is rendered as a keynote-legible transcript (record it with asciinema)
 *  - raw stream → runs/agent-<arm>[-run].stream.jsonl, summary → runs/agent-<arm>[-run].json
 *
 * Usage: node tools/run-agent-claude-code.mjs --arm a|b [--model claude-sonnet-5] [--run N] [--max-turns 200] [--prompt-file f]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const armId = opt('--arm');
if (armId !== 'a' && armId !== 'b') {
  console.error('usage: node tools/run-agent.mjs --arm a|b [--model m] [--run N] [--max-turns N]');
  process.exit(2);
}
const model = opt('--model', process.env.AGENT_MODEL ?? 'claude-sonnet-5');
const runIdx = opt('--run');
const maxTurns = Number(opt('--max-turns', process.env.AGENT_MAX_TURNS ?? '200'));
const runsDir = process.env.RUNS_DIR ?? path.join(ROOT, 'runs');
const promptFile = opt('--prompt-file');
const quiet = argv.includes('--quiet');

const ARMS = {
  a: {
    dir: path.join(ROOT, 'arm-a-vibe'),
    label: 'Arm A — vibe (no guardrails)',
    instruction: 'Make it work. Ship a build.',
  },
  b: {
    dir: path.join(ROOT, 'arm-b-harness'),
    label: 'Arm B — high-assurance harness',
    instruction:
      'Implement the feature. `./verify.sh` must pass. If it fails, fix your code and run it again. ' +
      'Do not modify config, tests, tsconfig, ESLint, or the CSP.',
  },
};
const arm = ARMS[armId];
const suffix = runIdx ? `-${runIdx}` : '';

// Same feature prompt, byte for byte, in both arms. Only the one-line instruction differs.
const featurePrompt = fs.readFileSync(path.join(ROOT, 'app-spec', 'FEATURE_PROMPT.md'), 'utf8');
const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8') : `${featurePrompt.trimEnd()}\n\n---\n\n${arm.instruction}\n`;
const promptSha256 = crypto.createHash('sha256').update(featurePrompt).digest('hex');
fs.copyFileSync(path.join(ROOT, 'app-spec', 'fixtures.json'), path.join(arm.dir, 'fixtures.json'));
fs.mkdirSync(runsDir, { recursive: true });

// ---------- terminal rendering ----------
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[97m',
};
const cols = Math.max(60, process.stdout.columns || 120);
const out = (s = '') => process.stdout.write(s + '\n');
const wrap = (text, indent = '') => {
  const width = cols - indent.length - 1;
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > width && line) {
        lines.push(indent + line);
        line = word;
      } else line = (line ? line + ' ' : '') + word;
    }
    lines.push(indent + line);
  }
  return lines.join('\n');
};
const rule = (title) => out(`${C.dim}${'─'.repeat(3)} ${title} ${'─'.repeat(Math.max(0, cols - title.length - 6))}${C.reset}`);
const rel = (p) => (typeof p === 'string' ? path.relative(arm.dir, path.isAbsolute(p) ? p : path.join(arm.dir, p)) || p : String(p));
const excerpt = (s, n) => {
  const lines = String(s ?? '').split('\n');
  const shown = lines.slice(0, n);
  return shown.map((l) => C.dim + '  │ ' + l.slice(0, cols - 6) + C.reset).join('\n') + (lines.length > n ? `\n${C.dim}  │ … (${lines.length - n} more lines)${C.reset}` : '');
};

const stats = { toolCalls: {}, verifyRuns: 0, filesWritten: new Set(), turns: 0 };
const toolNames = new Map(); // tool_use id → {name, input}

function renderToolUse(block) {
  const { name, input = {} } = block;
  toolNames.set(block.id, { name, input });
  stats.toolCalls[name] = (stats.toolCalls[name] ?? 0) + 1;
  let summary = '';
  switch (name) {
    case 'Write':
      summary = `${rel(input.file_path)} ${C.dim}(${String(input.content ?? '').split('\n').length} lines)${C.reset}`;
      stats.filesWritten.add(rel(input.file_path));
      break;
    case 'Edit':
    case 'MultiEdit':
      summary = rel(input.file_path);
      stats.filesWritten.add(rel(input.file_path));
      break;
    case 'Bash':
      summary = `${C.white}${input.command ?? ''}${C.reset}`;
      if (/verify\.sh/.test(input.command ?? '')) stats.verifyRuns += 1;
      break;
    case 'Read':
      summary = rel(input.file_path);
      break;
    case 'Glob':
    case 'Grep':
      summary = `${input.pattern ?? ''} ${input.path ? rel(input.path) : ''}`;
      break;
    default:
      summary = JSON.stringify(input).slice(0, 160);
  }
  out(`${C.magenta}▶ ${name}${C.reset} ${summary}`);
  if ((name === 'Edit') && input.old_string !== undefined) {
    out(excerpt(`- ${String(input.old_string).split('\n')[0]}`, 1));
    out(excerpt(`+ ${String(input.new_string).split('\n')[0]}`, 1));
  }
}

function renderToolResult(block) {
  const meta = toolNames.get(block.tool_use_id);
  const name = meta?.name ?? 'tool';
  const content = Array.isArray(block.content) ? block.content.map((c) => c.text ?? '').join('\n') : String(block.content ?? '');
  if (block.is_error) {
    out(`${C.red}  ✘ ${name} error${C.reset}`);
    out(excerpt(content, 12));
    return;
  }
  if (name === 'Bash') {
    const isVerify = /verify\.sh/.test(meta?.input?.command ?? '');
    out(excerpt(content, isVerify ? 80 : 25));
  } else if (name === 'Read' || name === 'Glob' || name === 'Grep') {
    out(`${C.dim}  │ (${content.split('\n').length} lines)${C.reset}`);
  } else {
    out(excerpt(content, 3));
  }
}

// ---------- run ----------
const startedAt = new Date();
const streamPath = path.join(runsDir, `agent-${armId}${suffix}.stream.jsonl`);
const summaryPath = path.join(runsDir, `agent-${armId}${suffix}.json`);
fs.writeFileSync(streamPath, '');

out(`${C.bold}${C.cyan}${arm.label}${C.reset}`);
out(`${C.dim}agent: claude -p --model ${model} · cwd ${path.relative(ROOT, arm.dir)}/ · prompt sha256 ${promptSha256.slice(0, 16)}… · ${startedAt.toISOString()}${C.reset}`);
rule('prompt');
out(wrap(prompt.trim(), '  '));
rule('agent session');

// Claude Code ignores permissions.allow from project settings in a workspace that has not been trusted
// (it keys trust by the git root). Mark the repo and the arm directory trusted so the arm's
// .claude/settings.json applies in full; --settings is passed explicitly as well.
try {
  const cfgPath = path.join(process.env.HOME ?? '', '.claude.json');
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
  cfg.projects ??= {};
  let changed = false;
  for (const p of [ROOT, arm.dir]) {
    cfg.projects[p] ??= {};
    if (!cfg.projects[p].hasTrustDialogAccepted) {
      cfg.projects[p].hasTrustDialogAccepted = true;
      changed = true;
    }
  }
  if (changed) {
    const tmp = `${cfgPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    fs.renameSync(tmp, cfgPath); // atomic: parallel lanes never leave a half-written file behind
  }
} catch (e) {
  console.error(`${C.dim}(could not mark the workspace trusted: ${e.message})${C.reset}`);
}

// Claude Code keeps per-project "auto-memory" notes under ~/.claude/projects/<project-key>/memory and loads
// them at session start. Between benchmark runs that is shared state, so the benchmark's own memory is removed
// before every session (only keys derived from this checkout are touched).
try {
  const projectsDir = path.join(process.env.HOME ?? '', '.claude', 'projects');
  const keyOf = (dir) => dir.replace(/[^A-Za-z0-9]/g, '-');
  for (const key of [keyOf(ROOT), keyOf(arm.dir)]) {
    const mem = path.join(projectsDir, key, 'memory');
    if (fs.existsSync(mem)) {
      fs.rmSync(mem, { recursive: true, force: true });
      console.error(`${C.dim}(removed agent auto-memory ${path.relative(process.env.HOME ?? '', mem)} so this run starts from nothing)${C.reset}`);
    }
  }
} catch (e) {
  console.error(`${C.dim}(could not clear agent auto-memory: ${e.message})${C.reset}`);
}

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TERM: 'xterm-256color',
  LANG: process.env.LANG ?? 'C.UTF-8',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers',
  // Pass-through for matrix lanes: where verify.sh logs, and which ports the benchmark binds.
  ...(process.env.RUNS_DIR ? { RUNS_DIR: process.env.RUNS_DIR } : {}),
  ...(process.env.PORT_BASE ? { PORT_BASE: process.env.PORT_BASE } : {}),
};
const args = [
  '-p',
  '--model', model,
  '--output-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'acceptEdits',
  '--settings', path.join(arm.dir, '.claude', 'settings.json'),
  '--no-session-persistence',
  '--max-turns', String(maxTurns),
];
const child = spawn('claude', args, { cwd: arm.dir, env, stdio: ['pipe', 'pipe', 'pipe'] });
child.stdin.end(prompt);
child.stderr.on('data', (d) => process.stderr.write(C.dim + String(d) + C.reset));

let init = null;
let result = null;
const rl = readline.createInterface({ input: child.stdout });
rl.on('line', (line) => {
  if (!line.trim()) return;
  fs.appendFileSync(streamPath, line + '\n');
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  if (ev.type === 'system' && ev.subtype === 'init') {
    init = ev;
    out(`${C.dim}model ${ev.model ?? model} · claude code ${ev.claude_code_version ?? ''} · permission mode ${ev.permissionMode ?? ''}${C.reset}`);
  } else if (ev.type === 'assistant') {
    stats.turns += 1;
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'text' && block.text?.trim()) out(`${C.white}${wrap(block.text.trim())}${C.reset}`);
      else if (block.type === 'tool_use') renderToolUse(block);
    }
  } else if (ev.type === 'user') {
    const content = ev.message?.content;
    if (Array.isArray(content)) for (const block of content) if (block.type === 'tool_result') renderToolResult(block);
  } else if (ev.type === 'result') {
    result = ev;
  }
});

child.on('close', (code) => {
  const finishedAt = new Date();
  rule('done');
  const ok = code === 0 && result && !result.is_error;
  out(`${ok ? C.green : C.red}${C.bold}agent exited ${code}${C.reset} ${C.dim}· ${result?.num_turns ?? stats.turns} turns · ${((finishedAt - startedAt) / 1000).toFixed(0)}s · $${(result?.total_cost_usd ?? 0).toFixed(2)} · verify.sh runs: ${stats.verifyRuns}${C.reset}`);
  if (result?.result && !quiet) out(wrap(String(result.result).trim(), '  '));
  const summary = {
    arm: armId,
    label: arm.label,
    agent: 'Claude Code CLI (claude -p)',
    claudeCodeVersion: init?.claude_code_version ?? null,
    requestedModel: model,
    model: init?.model ?? model,
    temperature: 'not configurable in the Claude Code CLI (provider default)',
    permissionMode: init?.permissionMode ?? 'acceptEdits',
    instruction: arm.instruction,
    promptSha256,
    promptBytes: Buffer.byteLength(prompt),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    exitCode: code,
    numTurns: result?.num_turns ?? stats.turns,
    costUsd: result?.total_cost_usd ?? null,
    usage: result?.usage ?? null,
    modelUsage: result?.modelUsage ?? null,
    toolCalls: stats.toolCalls,
    verifyRuns: stats.verifyRuns,
    filesWritten: [...stats.filesWritten].sort(),
    finalMessage: result?.result ?? null,
    isError: result?.is_error ?? code !== 0,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  out(`${C.dim}summary → ${path.relative(ROOT, summaryPath)} · stream → ${path.relative(ROOT, streamPath)}${C.reset}`);
  process.exit(ok ? 0 : code || 1);
});
