// Static scan of the agent-written app code for dangerous DOM sinks.
// Two categories are reported separately so the headline number is defensible:
//  - html-sink: string-to-HTML/script sinks (what Trusted Types + tsec ban). These are the XSS class.
//  - url-sink:  URL-valued sinks assigned from non-literals (dangerous only without scheme validation).
import fs from 'node:fs';
import path from 'node:path';
import type { Arm } from './arms.ts';

export type SinkCategory = 'html-sink' | 'url-sink';

export interface SinkFinding {
  file: string;
  line: number;
  kind: string;
  category: SinkCategory;
  snippet: string;
}

const HTML_SINKS: [string, RegExp][] = [
  ['innerHTML =', /\.innerHTML\s*\+?=(?!=)/],
  ['outerHTML =', /\.outerHTML\s*\+?=(?!=)/],
  ['insertAdjacentHTML()', /\.insertAdjacentHTML\s*\(/],
  ['document.write()', /\bdocument\.write(?:ln)?\s*\(/],
  ['eval() / new Function()', /\beval\s*\(|new\s+Function\s*\(/],
  ['srcdoc =', /\.srcdoc\s*=(?!=)/],
  ['setAttribute(on* | srcdoc)', /setAttribute\s*\(\s*['"](?:on\w+|srcdoc)['"]/i],
  ['string timer', /set(?:Timeout|Interval)\s*\(\s*['"`]/],
];

const URL_SINKS: [string, RegExp][] = [
  ['src = <non-literal>', /\.src\s*=(?!=)\s*(?!['"]|`[^`$]*`)/],
  ['href = <non-literal>', /\.href\s*=(?!=)\s*(?!['"]|`[^`$]*`)/],
  ['setAttribute(href | src | action)', /setAttribute\s*\(\s*['"](?:href|src|action|formaction|xlink:href)['"]/i],
  ['location.href / assign / replace', /\blocation\.(?:href\s*=(?!=)|assign\s*\(|replace\s*\()/],
];

const JS_URI = /javascript:/i;
// A `javascript:` literal on a line that is checking/rejecting it is a guard, not a sink.
const JS_URI_GUARD = /startsWith|includes|test\s*\(|match\s*\(|indexOf|!==?|===?|replace\s*\(|reject|block|deny|allow|unsafe|dangerous|protocol/i;

const EXT = new Set(['.ts', '.mts', '.js', '.mjs', '.html']);

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (EXT.has(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

/** Files the agent wrote: index.html and everything under src/. */
export function appFiles(arm: Arm): string[] {
  const files = walk(path.join(arm.dir, 'src'));
  const index = path.join(arm.dir, 'index.html');
  if (fs.existsSync(index)) files.unshift(index);
  return files;
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

export function scanFile(file: string, rel: string): SinkFinding[] {
  const out: SinkFinding[] = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    const push = (kind: string, category: SinkCategory) =>
      out.push({ file: rel, line: i + 1, kind, category, snippet: line.trim().slice(0, 120) });
    for (const [kind, re] of HTML_SINKS) if (re.test(line)) push(kind, 'html-sink');
    for (const [kind, re] of URL_SINKS) if (re.test(line)) push(kind, 'url-sink');
    if (JS_URI.test(line) && !JS_URI_GUARD.test(line)) push('javascript: literal', 'url-sink');
  });
  return out;
}

export interface ScanResult {
  filesScanned: string[];
  findings: SinkFinding[];
  dangerousSinkAssignments: number; // html-sink count (the headline)
  urlSinkAssignments: number;
  byKind: Record<string, number>;
}

export function scanArm(arm: Arm): ScanResult {
  const files = appFiles(arm);
  const findings = files.flatMap((f) => scanFile(f, path.relative(arm.dir, f)));
  const byKind: Record<string, number> = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  return {
    filesScanned: files.map((f) => path.relative(arm.dir, f)),
    findings,
    dangerousSinkAssignments: findings.filter((f) => f.category === 'html-sink').length,
    urlSinkAssignments: findings.filter((f) => f.category === 'url-sink').length,
    byKind,
  };
}

/**
 * The trusted surface: non-blank, non-comment lines in files that create a Trusted Types policy.
 * Small and reviewable is the point. null when the arm has no such file.
 */
export function trustedSurface(arm: Arm): { lines: number; files: string[] } | null {
  const candidates = [...walk(path.join(arm.dir, 'harness')), ...walk(path.join(arm.dir, 'src'))].filter((f) =>
    /\.(ts|mts|js|mjs)$/.test(f),
  );
  const files = candidates.filter((f) => /createPolicy\s*\(/.test(fs.readFileSync(f, 'utf8')));
  if (!files.length) return null;
  let lines = 0;
  for (const f of files) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (line.trim() === '' || isComment(line)) continue;
      lines += 1;
    }
  }
  return { lines, files: files.map((f) => path.relative(arm.dir, f)) };
}
