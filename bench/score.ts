// Scorecard generator. Reads what the benchmark and the harness wrote under runs/ and emits
// runs/scorecard.json (or runs/scorecard-<n>.json with --run <n>). The same code scores both arms.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ARMS, ROOT, RUNS, type Arm } from './arms.ts';
import { PAYLOADS } from './payloads.ts';
import { scanArm, trustedSurface } from './static-scan.ts';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const runIdx = opt('--run');
const runsDir = opt('--runs') ?? RUNS;
const outPath = opt('--out') ?? path.join(runsDir, runIdx ? `scorecard-${runIdx}.json` : 'scorecard.json');

type Json = Record<string, any>;
const readJson = (f: string): Json | null => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const readJsonl = (f: string): Json[] =>
  fs.existsSync(f)
    ? fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
const sha256 = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function collectSpecs(suite: Json, acc: Json[] = []): Json[] {
  for (const s of suite.specs ?? []) acc.push({ title: s.title, file: s.file, ok: s.ok });
  for (const c of suite.suites ?? []) collectSpecs(c, acc);
  return acc;
}

function functionalResult(arm: Arm) {
  // Merge every Playwright JSON report for the arm (a combined run, or separate functional/security runs);
  // for a spec that appears in several reports the most recent report wins.
  const dir = path.join(runsDir, `pw-${arm.id}`);
  if (!fs.existsSync(dir)) return null;
  const reports = fs
    .readdirSync(dir)
    .filter((f) => /^results.*\.json$/.test(f))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs, rep: readJson(path.join(dir, f)) }))
    .filter((r) => r.rep)
    .sort((a, b) => a.mtime - b.mtime);
  if (!reports.length) return null;
  const byTitle = new Map<string, Json>();
  for (const r of reports) for (const s of collectSpecs({ suites: r.rep!.suites })) if (/functional\.spec\.ts$/.test(s.file)) byTitle.set(s.title, s);
  const specs = [...byTitle.values()];
  return {
    total: specs.length,
    passed: specs.filter((s) => s.ok).length,
    failed: specs.filter((s) => !s.ok).map((s) => s.title),
    pass: specs.length > 0 && specs.every((s) => s.ok),
  };
}

function iterationHistory() {
  const rows = readJsonl(path.join(runsDir, 'arm-b-iterations.jsonl'));
  const byIter = new Map<number, Json[]>();
  for (const r of rows) byIter.set(r.iter, [...(byIter.get(r.iter) ?? []), r]);
  const history = [...byIter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([iter, gates]) => {
      const failed = gates.find((g) => !g.pass && g.gate !== 'ALL');
      return {
        iter,
        green: gates.some((g) => g.gate === 'ALL' && g.pass),
        firstFailingGate: failed?.gate ?? null,
        firstError: failed?.firstError ?? null,
        seconds: gates.find((g) => g.gate === 'ALL')?.seconds ?? null,
      };
    });
  return { total: history.length, toGreen: history.find((h) => h.green)?.iter ?? null, history };
}

function gateCounts(arm: Arm): { lintErrors: number | null; tsecErrors: number | null } {
  if (arm.id !== 'b') return { lintErrors: null, tsecErrors: null };
  const env = { ...process.env, SAFETY_WEB_LOG_PATH: 'NONE', FORCE_COLOR: '0' };
  const es = spawnSync('pnpm', ['exec', 'eslint', '.', '-f', 'json'], { cwd: arm.dir, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  let lintErrors: number | null = null;
  try {
    const start = es.stdout.indexOf('[');
    lintErrors = (JSON.parse(es.stdout.slice(start)) as Json[]).reduce((n, f) => n + (f.errorCount ?? 0), 0);
  } catch {
    lintErrors = es.status === 0 ? 0 : null;
  }
  const ts = spawnSync('pnpm', ['exec', 'tsec', '-p', 'tsconfig.tsec.json'], { cwd: arm.dir, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const tsecErrors = ts.status === 0 ? 0 : (ts.stdout + ts.stderr).match(/error TS\d+/g)?.length ?? null;
  return { lintErrors, tsecErrors };
}

function scoreArm(arm: Arm) {
  const sec = readJsonl(path.join(runsDir, `security-${arm.id}.jsonl`));
  if (!sec.length) return null;
  const payloadRows = sec.filter((r) => r.type === 'payload');
  const byId = new Map(payloadRows.map((r) => [r.id, r]));
  const payloads = PAYLOADS.map((p) => {
    const r = byId.get(p.id);
    return { id: p.id, field: p.field, fired: r ? !!r.fired : null, how: r?.how ?? null, csp: r?.csp ?? [], pageErrors: r?.pageErrors ?? [] };
  });
  const headers = sec.find((r) => r.type === 'headers') ?? null;
  const tt = sec.find((r) => r.type === 'tt-runtime') ?? null;
  const scan = scanArm(arm);
  const surface = trustedSurface(arm);
  const iterations = arm.id === 'b' ? iterationHistory() : null;
  const gates = gateCounts(arm);
  const functional = functionalResult(arm);
  const agent = readJson(path.join(runsDir, runIdx ? `agent-${arm.id}-${runIdx}.json` : `agent-${arm.id}.json`));
  return {
    label: arm.label,
    xssFired: payloads.filter((p) => p.fired === true).length,
    xssTotal: payloads.length,
    xssUntested: payloads.filter((p) => p.fired === null).length,
    firedIds: payloads.filter((p) => p.fired === true).map((p) => p.id),
    payloads,
    cspPresent: headers?.cspPresent ?? false,
    cspStrict: headers?.cspStrict ?? false,
    trustedTypes: headers?.trustedTypes ?? false,
    csp: headers?.csp ?? '',
    cspEvaluator: headers?.evaluator ?? null,
    securityHeaders: headers?.otherHeaders ?? {},
    ttEnforcedAtRuntime: tt?.enforced ?? false,
    cspViolationsObserved: payloads.reduce((n, p) => n + p.csp.length, 0),
    dangerousSinkAssignments: scan.dangerousSinkAssignments,
    urlSinkAssignments: scan.urlSinkAssignments,
    sinkFindings: scan.findings,
    sinksByKind: scan.byKind,
    filesScanned: scan.filesScanned,
    lintErrors: gates.lintErrors,
    tsecErrors: gates.tsecErrors,
    iterationsToGreen: iterations?.toGreen ?? null,
    iterations: iterations,
    trustedSurfaceLines: surface?.lines ?? null,
    trustedSurfaceFiles: surface?.files ?? [],
    functionalPass: functional?.pass ?? false,
    functional,
    agent,
  };
}

function version(pkgDir: string, dep: string): string | null {
  const pj = readJson(path.join(pkgDir, 'node_modules', dep, 'package.json'));
  return pj?.version ?? null;
}

const card = {
  generatedAt: new Date().toISOString(),
  run: runIdx ?? null,
  promptSha256: sha256(path.join(ROOT, 'app-spec', 'FEATURE_PROMPT.md')),
  fixturesSha256: sha256(path.join(ROOT, 'app-spec', 'fixtures.json')),
  armA: scoreArm(ARMS.a),
  armB: scoreArm(ARMS.b),
  toolchain: {
    node: process.version,
    vite: version(ARMS.b.dir, 'vite'),
    typescript: version(ARMS.b.dir, 'typescript'),
    tsec: version(ARMS.b.dir, 'tsec'),
    safetyWeb: version(ARMS.b.dir, '@safety-web/eslint-plugin'),
    eslint: version(ARMS.b.dir, 'eslint'),
    safevalues: version(ARMS.b.dir, 'safevalues'),
    dompurify: version(ARMS.b.dir, 'dompurify'),
    playwright: version(ROOT, '@playwright/test'),
    cspEvaluator: version(ROOT, 'csp_evaluator'),
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(card, null, 2) + '\n');

const fmt = (a: Json | null, k: string) => (a == null ? '—' : a[k] === null || a[k] === undefined ? 'n/a' : String(a[k]));
const rows: [string, string][] = [
  ['xssFired', 'xssFired'],
  ['cspStrict', 'cspStrict'],
  ['trustedTypes', 'trustedTypes'],
  ['ttEnforcedAtRuntime', 'ttEnforcedAtRuntime'],
  ['dangerousSinkAssignments', 'dangerousSinkAssignments'],
  ['urlSinkAssignments', 'urlSinkAssignments'],
  ['lintErrors', 'lintErrors'],
  ['tsecErrors', 'tsecErrors'],
  ['iterationsToGreen', 'iterationsToGreen'],
  ['trustedSurfaceLines', 'trustedSurfaceLines'],
  ['functionalPass', 'functionalPass'],
];
console.log(`scorecard → ${path.relative(ROOT, outPath)}`);
console.log(`${'metric'.padEnd(26)} ${'arm A'.padEnd(10)} arm B`);
for (const [label, k] of rows) console.log(`${label.padEnd(26)} ${fmt(card.armA, k).padEnd(10)} ${fmt(card.armB, k)}`);
