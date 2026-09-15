// Strict-CSP check. isStrict() is the benchmark's own stand-in for CSP Evaluator;
// evaluateCsp() runs Google's actual csp_evaluator library on the same header.
import { CspParser } from 'csp_evaluator/dist/parser.js';
import { CspEvaluator } from 'csp_evaluator/dist/evaluator.js';
import { Severity } from 'csp_evaluator/dist/finding.js';

export function isStrict(csp: string): boolean {
  const hasNonceOrHash = /'nonce-[^']+'|'sha256-[^']+'/.test(csp);
  const strictDynamic = /'strict-dynamic'/.test(csp);
  const objectNone = /object-src\s+'none'/.test(csp);
  const baseNone = /base-uri\s+'none'/.test(csp);
  return hasNonceOrHash && strictDynamic && objectNone && baseNone;
}

export function hasTrustedTypes(csp: string): boolean {
  return /require-trusted-types-for\s+'script'/.test(csp);
}

export interface CspEvaluation {
  high: number;
  medium: number;
  findings: { severity: string; directive: string; description: string }[];
}

export function evaluateCsp(csp: string): CspEvaluation {
  if (!csp) return { high: 0, medium: 0, findings: [] };
  const parsed = new CspParser(csp).csp;
  const findings = new CspEvaluator(parsed).evaluate();
  const name = (s: number) => Severity[s] ?? String(s);
  return {
    high: findings.filter((f) => f.severity === Severity.HIGH || f.severity === Severity.SYNTAX).length,
    medium: findings.filter((f) => f.severity === Severity.MEDIUM).length,
    findings: findings.map((f) => ({ severity: name(f.severity), directive: f.directive, description: f.description })),
  };
}
