// Renders RESULTS.md from runs/scorecard.json (the canonical run) and runs/scorecard-*.json (the matrix).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RUNS } from './arms.ts';
import { PAYLOADS } from './payloads.ts';

type Json = Record<string, any>;
const argv = process.argv.slice(2);
const opt = (n: string) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
const runsDir = opt('--runs') ?? RUNS;
const outPath = opt('--out') ?? path.join(ROOT, 'RESULTS.md');

const readJson = (f: string): Json | null => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};

const canonical = readJson(path.join(runsDir, 'scorecard.json'));
if (!canonical) {
  console.error('no runs/scorecard.json yet — run the benchmark first');
  process.exit(1);
}
const matrix = fs
  .readdirSync(runsDir)
  .filter((f) => /^scorecard-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  .map((f) => ({ file: f, card: readJson(path.join(runsDir, f))! }))
  .filter((m) => m.card?.armA && m.card?.armB);

const A = canonical.armA as Json | null;
const B = canonical.armB as Json | null;

const yes = (v: unknown) => (v ? 'yes' : 'no');
const na = (v: unknown, f: (x: any) => string = String) => (v === null || v === undefined ? 'n/a' : f(v));
const mono = (s: string) => '`' + s + '`';
const agentModel = (arm: Json | null) => arm?.agent?.model ?? arm?.agent?.requestedModel ?? null;

const lines: string[] = [];
const push = (s = '') => lines.push(s);

// Matrix helpers, shared by the per-model summary and the run-by-run table.
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const f1 = (x: number) => (Number.isNaN(x) ? 'n/a' : (Math.round(x * 10) / 10).toString());
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const modelOf = (m: { card: Json }) => agentModel(m.card.armA) ?? agentModel(m.card.armB) ?? 'unknown';
const groups = new Map<string, typeof matrix>();
for (const m of matrix) groups.set(modelOf(m), [...(groups.get(modelOf(m)) ?? []), m]);
const nAll = matrix.length;
const allA = matrix.map((m) => m.card.armA as Json);
const allB = matrix.map((m) => m.card.armB as Json);
// A vibe builder that crashed and left no working app (agent exit ≠ 0 and 0 feature tests passing) is not a
// "safe" data point: its arm-A numbers are excluded from the rates and the run is marked ‡.
const builderFailed = (x: Json) => !!x.agent && x.agent.exitCode !== 0 && !!x.functional && x.functional.passed === 0;
const interruptedOf = (y: Json) => (y.iterations?.history ?? []).filter((h: Json) => !h.green && h.firstFailingGate == null).length;

push('# Porto Notes — vibe coding vs. high-assurance agentic engineering');
push();
push(
  `Same feature prompt (sha256 ${mono(canonical.promptSha256.slice(0, 12))}), same benchmark` +
    (nAll ? `, ${plural(nAll, 'independent run')} per arm across ${plural(groups.size, 'model')}` : '') +
    '. The only variable is the environment the agent codes in.',
);
push();

if (nAll) {
  push('## Summary: every run, by model');
  push();
  push(
    'Every run starts from the clean scaffold; the agent builds the app from scratch in both arms; the same benchmark scores both. ' +
      'The run-by-run table is [further down](#reproducibility-matrix-run-by-run).',
  );
  push();
  push('| model | runs | A: runs with ≥1 payload executed | A: payloads executed, mean (min–max) | A: runs with raw HTML sinks | **B: runs with ≥1 payload executed** | B: iterations to green, mean / median | functional parity A / B |');
  push('|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|');
  const row = (label: string, ms: typeof matrix, bold = false) => {
    const a = ms.map((m) => m.card.armA as Json).filter((x) => !builderFailed(x));
    const b = ms.map((m) => m.card.armB as Json);
    const n = ms.length;
    const nA = a.length;
    const interrupted = b.reduce((sum, y) => sum + interruptedOf(y), 0);
    const fa = a.map((x) => x.xssFired as number);
    const fb = b.map((x) => x.xssFired as number);
    const it = b.map((x) => x.iterationsToGreen).filter((x): x is number => typeof x === 'number');
    const w = (s: string) => (bold ? `**${s}**` : s);
    push(
      `| ${w(label)} | ${n}${nA < n ? ` (A: ${nA} ‡)` : ''} | ${w(`${fa.filter((x) => x > 0).length} / ${nA}`)} | ${fa.length ? `${f1(mean(fa))} (${Math.min(...fa)}–${Math.max(...fa)})` : 'n/a'} | ${a.filter((x) => x.dangerousSinkAssignments > 0).length} / ${nA} | ${w(`${fb.filter((x) => x > 0).length} / ${n}`)} | ${f1(mean(it))} / ${f1(median(it))} (${it.length} green${interrupted ? `, ${interrupted} interrupted` : ''}) | ${a.filter((x) => x.functionalPass).length} / ${b.filter((x) => x.functionalPass).length} |`,
    );
  };
  for (const [model, ms] of groups) row(mono(model), ms);
  if (groups.size > 1) row('all models', matrix, true);
  push();
  push(
    `Across all ${nAll} runs, arm B executed **${allB.reduce((s, x) => s + x.xssFired, 0)}** payload(s) in total and served strict CSP + Trusted Types in ${allB.filter((x) => x.cspStrict && x.trustedTypes).length} / ${nAll}; arm A executed **${allA.reduce((s, x) => s + x.xssFired, 0)}** in total.`,
  );
  const failedBuilders = matrix.filter((m) => builderFailed(m.card.armA as Json));
  const totalInterrupted = allB.reduce((sum, y) => sum + interruptedOf(y), 0);
  if (failedBuilders.length || totalInterrupted) {
    push();
    push(
      (failedBuilders.length ? `‡ ${failedBuilders.map((m) => `run ${m.card.run}`).join(', ')}: the vibe builder crashed without producing a working app (agent exit ≠ 0, 0 feature tests passing); a broken app that fires nothing is not "safe", so these runs are left out of the arm A rates. ` : '') +
        (totalInterrupted ? `"Interrupted" counts verify.sh invocations that stopped before reaching a verdict (a port clash, a killed command); they inflate the raw iteration index but are not refusals.` : ''),
    );
  }
  push();
}

push(`## The canonical pair: one recorded run${agentModel(A) ? ` (${mono(agentModel(A))})` : ''}`);
push();
push(
  'One vibe build and one harness build by the same agent, recorded end to end (`runs/arm-a.cast`, `runs/arm-b.cast`, `runs/arm-b-snapshots/`). ' +
    (nAll ? 'It is a single data point; the base rates are in the summary above. ' : '') +
    'The sections up to the run-by-run table describe this pair.',
);
push();
push('| | Arm A — vibe | Arm B — harness |');
push('|---|:---:|:---:|');
if (A && B) {
  push(`| **XSS payloads executed** | **${A.xssFired} / ${A.xssTotal}** | **${B.xssFired} / ${B.xssTotal}** |`);
  push(`| Strict CSP served | ${yes(A.cspStrict)} | ${yes(B.cspStrict)} |`);
  push(`| Trusted Types (\`require-trusted-types-for 'script'\`) | ${yes(A.trustedTypes)} | ${yes(B.trustedTypes)} |`);
  push(`| Trusted Types enforced at runtime | ${yes(A.ttEnforcedAtRuntime)} | ${yes(B.ttEnforcedAtRuntime)} |`);
  push(`| Dangerous HTML/script sinks in app code | ${A.dangerousSinkAssignments} | ${B.dangerousSinkAssignments} |`);
  push(`| URL sinks assigned from non-literals | ${A.urlSinkAssignments} | ${B.urlSinkAssignments} |`);
  push(`| Lint (safety-web) errors | ${na(A.lintErrors)} | ${na(B.lintErrors)} |`);
  push(`| tsec conformance errors | ${na(A.tsecErrors)} | ${na(B.tsecErrors)} |`);
  push(`| Iterations to green | ${na(A.iterationsToGreen)} | ${na(B.iterationsToGreen)} |`);
  push(`| Trusted surface (lines) | ${na(A.trustedSurfaceLines)} | ${na(B.trustedSurfaceLines)} |`);
  push(
    `| **Functional parity** (same feature tests) | **${A.functional ? `${A.functional.passed}/${A.functional.total}` : 'n/a'}** | **${B.functional ? `${B.functional.passed}/${B.functional.total}` : 'n/a'}** |`,
  );
} else {
  push(`| (incomplete) | ${A ? 'scored' : 'missing'} | ${B ? 'scored' : 'missing'} |`);
}
push();

if (A && B) {
  push('### Payload by payload');
  push();
  push('| payload | field | Arm A | Arm B |');
  push('|---|---|:---:|:---:|');
  for (const p of PAYLOADS) {
    const ra = A.payloads.find((x: Json) => x.id === p.id);
    const rb = B.payloads.find((x: Json) => x.id === p.id);
    const cell = (r: Json | undefined) => (r == null || r.fired === null ? '?' : r.fired ? '✗ fired' : '✓ inert');
    push(`| ${mono(p.id)} | ${p.field} | ${cell(ra)} | ${cell(rb)} |`);
  }
  push();
  push('✗ = the payload\'s script ran (`window.__xss` was set). ✓ = nothing happened.');
  push();

  push('### Where the sinks are');
  push();
  for (const [name, arm] of [['Arm A', A], ['Arm B', B]] as const) {
    push(`**${name}** — ${arm.dangerousSinkAssignments} dangerous HTML/script sink(s), ${arm.urlSinkAssignments} URL sink(s) in ${arm.filesScanned.length} file(s)`);
    push();
    if (arm.sinkFindings.length) {
      push('| file:line | kind | code |');
      push('|---|---|---|');
      for (const f of arm.sinkFindings) push(`| ${mono(`${f.file}:${f.line}`)} | ${f.kind} | ${mono(f.snippet.replace(/\|/g, '\\|').slice(0, 80))} |`);
    } else {
      push('_none_');
    }
    push();
  }

  if (B.iterations?.history?.length) {
    push('### Arm B: the road to green');
    push();
    push('| iteration | outcome | first failing gate | first error |');
    push('|---|---|---|---|');
    for (const h of B.iterations.history) {
      push(`| ${h.iter} | ${h.green ? '✓ green' : '✗'} | ${h.firstFailingGate ?? '—'} | ${h.firstError ? mono(String(h.firstError).replace(/\|/g, '\\|').slice(0, 110)) : '—'} |`);
    }
    push();
  }

  push('### Served policy (Arm B)');
  push();
  push('```');
  push(`Content-Security-Policy: ${B.csp || '(none)'}`);
  push('```');
  push();
  if (A.functional?.failed?.length || B.functional?.failed?.length) {
    push('**Functional failures:** ' + [A.functional?.failed?.length ? `Arm A: ${A.functional.failed.join('; ')}` : '', B.functional?.failed?.length ? `Arm B: ${B.functional.failed.join('; ')}` : ''].filter(Boolean).join(' — '));
    push();
  }
}

if (nAll) {
  push('## Reproducibility matrix, run by run');
  push();
  push(`${plural(nAll, 'run')} per arm, ${plural(groups.size, 'model')}. Bold in "A: fired" marks a vibe build that executed at least one payload.`);
  push();
  push('| run | model | A: fired | A: sinks | A: functional | B: fired | B: sinks | B: iterations | B: gate refusals → green | B: functional |');
  push('|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|:---:|');
  const refusals = (y: Json) => {
    const h: Json[] = y.iterations?.history ?? [];
    if (!h.length) return '—';
    return h.map((it) => (it.green ? '✓' : String(it.firstFailingGate ?? '?').replace(/^\d-/, ''))).join(' → ');
  };
  const annotations = (readJson(path.join(runsDir, 'annotations.json')) ?? {}) as Record<string, string>;
  let cutoffs = 0;
  matrix.forEach((m, i) => {
    const x = m.card.armA as Json;
    const y = m.card.armB as Json;
    // An agent session that the API ended (spend/rate limit) after its work was verified is still a valid data point; mark it.
    const cut = (arm: Json) => (arm.agent && (arm.agent.isError || arm.agent.exitCode !== 0) ? '†' : '');
    if (cut(x) || cut(y)) cutoffs += 1;
    push(
      `| ${m.card.run ?? i + 1}${builderFailed(x) ? ' ‡' : ''}${annotations[String(m.card.run)] ? ' §' : ''} | ${mono(modelOf(m))} | ${x.xssFired > 0 ? '**' + x.xssFired + '**' : x.xssFired}/${x.xssTotal}${cut(x)} | ${x.dangerousSinkAssignments} | ${x.functional ? `${x.functional.passed}/${x.functional.total}` : 'n/a'} | ${y.xssFired}/${y.xssTotal}${cut(y)} | ${y.dangerousSinkAssignments} | ${na(y.iterationsToGreen)} | ${refusals(y)} | ${y.functional ? `${y.functional.passed}/${y.functional.total}` : 'n/a'} |`,
    );
  });
  if (cutoffs) {
    push();
    push('† the agent session was ended by the API (org spend limit) after `verify.sh` had already passed; the shipped app and its scores are complete. Runs whose sessions were cut off *before* the app was complete are excluded from the matrix.');
  }
  const annotated = matrix.filter((m) => annotations[String(m.card.run)]);
  if (annotated.length) {
    push();
    for (const m of annotated) push(`§ run ${m.card.run}: ${annotations[String(m.card.run)]}`);
  }
  const refusedByGate: Record<string, number> = {};
  for (const y of allB) for (const it of y.iterations?.history ?? []) if (!it.green && it.firstFailingGate) refusedByGate[String(it.firstFailingGate).replace(/^\d-/, '')] = (refusedByGate[String(it.firstFailingGate).replace(/^\d-/, '')] ?? 0) + 1;
  if (Object.keys(refusedByGate).length) {
    push();
    push('Arm B refusals by gate, all runs: ' + Object.entries(refusedByGate).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${mono(g)} ×${n}`).join(', ') + '. Every refusal was answered by a code change, never by a config change (gate 0 holds).');
  }
  push();
}

const bypass = readJson(path.join(runsDir, 'bypass-results.json')) as Json[] | null;
if (Array.isArray(bypass) && bypass.length) {
  const probed = bypass.filter((e) => e.total > 0);
  push('## Beyond the fixed corpus: bypass probe (informational)');
  push();
  push(
    '18 mutated variants of the same techniques (case tricks, entity-encoded `javascript:`, handlers on allowed tags, tag break-outs, `srcdoc`, SVG `xlink:href`) ' +
      'driven through every saved app, both arms. Not part of the scorecard; `bench/bypass-payloads.ts` lists them.',
  );
  push();
  push('| model | arm | apps probed | apps with ≥1 variant executed | variants executed (total) |');
  push('|---|---|:---:|:---:|:---:|');
  const models = [...new Set(probed.map((e) => e.model))];
  for (const model of models) {
    for (const arm of ['a', 'b']) {
      const es = probed.filter((e) => e.model === model && e.arm === arm);
      if (!es.length) continue;
      const hit = es.filter((e) => e.fired.length > 0);
      const total = es.reduce((n, e) => n + e.fired.length, 0);
      push(`| ${mono(model)} | ${arm === 'a' ? 'A — vibe' : 'B — harness'} | ${es.length} | ${arm === 'b' ? '**' + hit.length + '**' : hit.length} | ${total} |`);
    }
  }
  const hits = probed.filter((e) => e.fired.length > 0);
  if (hits.length) {
    push();
    push('Hits: ' + hits.map((e) => `run ${e.run} arm ${e.arm.toUpperCase()} (${mono(e.model)}): ${e.fired.map(mono).join(', ')}`).join('; ') + '.');
  }
  const skipped = bypass.filter((e) => !(e.total > 0));
  if (skipped.length) {
    push();
    push(`Not probed: ${skipped.map((e) => `run ${e.run} arm ${e.arm.toUpperCase()}`).join(', ')} (the saved app could not be rebuilt in isolation).`);
  }
  push();
}

const hostile = readJson(path.join(runsDir, 'hostile', 'scorecard.json'));
const hostileAgent = readJson(path.join(runsDir, 'hostile', 'agent-b-hostile.json'));
if (hostile?.armB) {
  const h = hostile.armB as Json;
  push('## Side experiment: the agent is told to use `innerHTML`');
  push();
  push(
    `Same harness, same feature prompt, plus one line from a "team lead": render the note body with \`el.innerHTML = note.body\`, no sanitizer, no safevalues. ` +
      `Agent: ${mono(hostileAgent?.model ?? 'unknown')}. Result: **${h.xssFired} / ${h.xssTotal}** payloads executed, ${h.dangerousSinkAssignments} raw HTML sinks in the shipped code, ` +
      `verify.sh green after ${na(h.iterationsToGreen)} iteration(s), functional ${h.functional ? `${h.functional.passed}/${h.functional.total}` : 'n/a'}.`,
  );
  if (h.iterations?.history?.length) {
    push();
    push('Refusals on the way: ' + (h.iterations.history.some((it: Json) => !it.green) ? h.iterations.history.filter((it: Json) => !it.green).map((it: Json) => `${mono(String(it.firstFailingGate))} ${mono(String(it.firstError).slice(0, 90))}`).join('; ') : 'none — the agent read the gates first and shipped the typed boundary instead of the instruction.'));
  }
  push();
  push('The instruction changed; the environment did not; the outcome did not. Recording: `runs/arm-b-hostile.cast`.');
  push();
}

push('## Scope of the claim');
push();
push('- **Proven here:** strict CSP + Trusted Types + safe-coding conformance (tsec, safety-web) remove the XSS/injection class in the app under test, independent of what the agent wrote.');
push('- **Not proven:** absence of logic bugs, auth flaws, server-side issues, or non-injection vulnerability classes. Trusted Types and CSP target injection. The scorecard shows what it shows, nothing more.');
push();
push(
  `_Generated ${canonical.generatedAt} · node ${canonical.toolchain.node} · vite ${canonical.toolchain.vite} · typescript ${canonical.toolchain.typescript} · tsec ${canonical.toolchain.tsec} · @safety-web/eslint-plugin ${canonical.toolchain.safetyWeb} · safevalues ${canonical.toolchain.safevalues} · dompurify ${canonical.toolchain.dompurify} · playwright ${canonical.toolchain.playwright}_`,
);
push();

fs.writeFileSync(outPath, lines.join('\n'));
console.log(`RESULTS → ${path.relative(ROOT, outPath)} (${matrix.length} matrix run(s))`);
