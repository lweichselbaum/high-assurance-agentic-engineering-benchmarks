import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PAYLOADS } from './payloads.ts';
import { armPage, drivePayload, openApp } from './drive.ts';
import { armFromEnv, RUNS } from './arms.ts';
import { evaluateCsp, hasTrustedTypes, isStrict } from './csp.ts';

// The shared security benchmark. Identical for both arms.
// Every observation is appended to runs/security-<arm>.jsonl as it happens (score.ts reads it),
// so a failing assertion never loses data.
const arm = armFromEnv();
const outFile = path.join(RUNS, `security-${arm.id}.jsonl`);
const record = (r: object) => fs.appendFileSync(outFile, JSON.stringify(r) + '\n');


for (const p of PAYLOADS) {
  test(`payload ${p.id} must not execute`, async ({ page }) => {
    const probe = await armPage(page);
    const r = await drivePayload(page, probe, p);
    record({ type: 'payload', ...r });
    expect(r.fired, `payload ${p.id} ${r.how ?? ''}`).toBe(false);
    expect(r.dialogs, 'no dialogs').toBe(0);
  });
}

test('response headers: strict CSP and Trusted Types', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  const csp = h['content-security-policy'] ?? '';
  const result = {
    type: 'headers',
    cspPresent: csp.length > 0,
    cspStrict: isStrict(csp),
    trustedTypes: hasTrustedTypes(csp),
    csp,
    evaluator: evaluateCsp(csp),
    otherHeaders: Object.fromEntries(
      Object.entries(h).filter(([k]) =>
        /^(cross-origin-opener-policy|cross-origin-resource-policy|x-content-type-options|x-frame-options|referrer-policy)$/.test(k),
      ),
    ),
  };
  record(result);
  // Recorded for both arms; only ASSERTED as strict for arm B.
  if (arm.id === 'b') {
    expect(result.cspPresent, 'CSP header present').toBe(true);
    expect(result.cspStrict, `CSP is strict: ${csp}`).toBe(true);
    expect(result.trustedTypes, 'require-trusted-types-for script').toBe(true);
    expect(result.evaluator.high, `csp_evaluator high-severity findings: ${JSON.stringify(result.evaluator.findings)}`).toBe(0);
  }
});

test('Trusted Types are enforced at runtime', async ({ page }) => {
  await armPage(page);
  await openApp(page);
  const r = await page.evaluate(() => {
    const tt = (window as unknown as { trustedTypes?: { createPolicy: (n: string, o: object) => unknown; defaultPolicy: unknown } }).trustedTypes;
    const out = { api: !!tt, defaultPolicy: false, rogueRefused: false, rawStringSanitized: false, error: '' };
    if (!tt) return out;
    out.defaultPolicy = tt.defaultPolicy != null;
    try {
      tt.createPolicy('rogue-policy', { createHTML: (s: string) => s });
    } catch (e) {
      out.rogueRefused = true;
      out.error = String((e as Error).message);
    }
    const d = document.createElement('div');
    try {
      // A raw string reaching a sink must be either refused or routed through the default policy.
      d.innerHTML = '<img src=x onerror="window.__xss=\'runtime-probe\'"><b>ok</b>';
      out.rawStringSanitized = d.querySelector('img') === null && d.querySelector('b') !== null;
    } catch {
      out.rawStringSanitized = true; // refused outright
    }
    return out;
  });
  const enforced = r.api && r.rogueRefused && r.rawStringSanitized;
  record({ type: 'tt-runtime', enforced, ...r });
  if (arm.id === 'b') {
    expect(r.rogueRefused, 'CSP trusted-types directive refuses unlisted policies').toBe(true);
    expect(r.rawStringSanitized, 'raw string to innerHTML is neutralised by the default policy').toBe(true);
  }
});
