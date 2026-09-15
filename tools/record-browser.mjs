#!/usr/bin/env node
/**
 * Records the browser money shot for one arm: the same visible img-onerror payload is submitted
 * through the app's own form. Arm A: the payload fires (red banner). Arm B: nothing happens.
 * A status overlay (built with textContent only, so it works under Trusted Types) shows the served
 * CSP and the Trusted Types state.
 *
 * Usage: node tools/record-browser.mjs --arm a|b [--out runs/arm-a-xss.webm] [--seconds 8]
 * The arm's server must not be running; this script builds nothing — run bench/run.sh <arm> first.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const armId = opt('--arm');
if (armId !== 'a' && armId !== 'b') {
  console.error('usage: node tools/record-browser.mjs --arm a|b [--out file.webm]');
  process.exit(2);
}
const ARMS = {
  a: { dir: path.join(ROOT, 'arm-a-vibe'), serve: 'server.mjs', port: 4273, label: 'Arm A — vibe: no CSP, no Trusted Types', out: 'runs/arm-a-xss.webm' },
  b: { dir: path.join(ROOT, 'arm-b-harness'), serve: 'harness/server.mjs', port: 4274, label: 'Arm B — harness: strict CSP + Trusted Types', out: 'runs/arm-b-inert.webm' },
};
const arm = ARMS[armId];
const out = path.resolve(ROOT, opt('--out', arm.out));
const holdSeconds = Number(opt('--seconds', '6'));
const payloadKind = opt('--payload', 'img'); // img | jslink
const labelSuffix = opt('--label', '');
const tmpVideoDir = path.join(ROOT, 'runs', 'tmp', `video-${armId}`);
fs.rmSync(tmpVideoDir, { recursive: true, force: true });
fs.mkdirSync(tmpVideoDir, { recursive: true });

const reportLog = path.join(ROOT, 'runs', `arm-${armId}-demo-reports.jsonl`);
fs.rmSync(reportLog, { force: true });
const server = spawn('node', [arm.serve, '--port', String(arm.port)], {
  cwd: arm.dir,
  env: { ...process.env, CSP_REPORT_LOG: reportLog },
  stdio: ['ignore', 'ignore', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
await new Promise((r) => setTimeout(r, 700));

// The demo payloads: the same techniques as the benchmark corpus, with a visible effect.
const BANNER =
  `window.__xss='demo';var d=document.createElement('div');d.id='pwned';d.textContent='XSS: attacker script executed in your session';` +
  `d.style.cssText='position:fixed;left:0;right:0;top:0;padding:28px;background:#b91c1c;color:#fff;font:700 34px system-ui;text-align:center;z-index:9999';` +
  `document.body.appendChild(d)`;
const PAYLOADS = {
  img: { value: `<img src=x onerror="${BANNER}">`, describe: 'note body: <img src=x onerror="…">', click: false },
  // void(…) so the javascript: navigation returns undefined and the page is not replaced.
  jslink: { value: `<a href="javascript:void(function(){${BANNER}})()">tap here for the map</a>`, describe: 'note body: <a href="javascript:…">tap here for the map</a>, then the link is clicked', click: true },
};
const PAYLOAD = PAYLOADS[payloadKind].value;
if (labelSuffix) arm.label += ` ${labelSuffix}`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpVideoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const violations = [];
await page.addInitScript(() => {
  window.__xss = null;
  document.addEventListener('securitypolicyviolation', (e) => (window.__cspv = (window.__cspv || 0) + 1));
});
page.on('console', (m) => {
  if (/Trusted Types|Content Security Policy|Refused/i.test(m.text())) violations.push(m.text());
});
page.on('dialog', (d) => d.dismiss());

const base = `http://127.0.0.1:${arm.port}`;
const res = await page.goto(base + '/', { waitUntil: 'load' });
const csp = res.headers()['content-security-policy'] ?? '';

// Status overlay — DOM APIs only, no HTML strings (works under Trusted Types enforcement).
const overlay = async (lines) => {
  await page.evaluate(
    ({ label, lines }) => {
      let box = document.getElementById('demo-overlay');
      if (!box) {
        box = document.createElement('div');
        box.id = 'demo-overlay';
        box.style.cssText =
          'position:fixed;left:0;right:0;bottom:0;padding:14px 20px;background:#0f172a;color:#e2e8f0;font:16px/1.45 ui-monospace,Menlo,monospace;z-index:9998;white-space:pre-wrap;border-top:4px solid #38bdf8';
        document.body.appendChild(box);
      }
      box.replaceChildren();
      const title = document.createElement('div');
      title.textContent = label;
      title.style.cssText = 'font:700 20px system-ui;margin-bottom:6px;color:#f8fafc';
      box.appendChild(title);
      for (const l of lines) {
        const p = document.createElement('div');
        p.textContent = l;
        box.appendChild(p);
      }
    },
    { label: arm.label, lines },
  );
};
const cspLine = csp ? `Content-Security-Policy: ${csp.replace(/'nonce-[^']+'/, "'nonce-…'")}` : 'Content-Security-Policy: (none)';
await overlay([cspLine, `submitting ${PAYLOADS[payloadKind].describe}`]);
await page.waitForTimeout(1500);

await page.fill('#title', 'Just a note');
await page.waitForTimeout(400);
await page.fill('#body', PAYLOAD);
await page.waitForTimeout(400);
await page.locator('#note-form button[type="submit"], #note-form button:not([type])').first().click();
await page.waitForTimeout(1200);
if (PAYLOADS[payloadKind].click) {
  const link = page.locator('#feed article.note').first().locator('a').first();
  if ((await link.count()) > 0) {
    await link.hover().catch(() => undefined);
    await page.waitForTimeout(600);
    await link.click({ noWaitAfter: true, force: true, timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
}

const fired = (await page.evaluate(() => window.__xss)) !== null;
const cspv = await page.evaluate(() => window.__cspv || 0);
const rendered = await page.locator('#feed article.note').first().locator('.note-body').innerHTML().catch(() => '');
let ttLine;
if (armId === 'b') {
  let reports = 0;
  try {
    reports = fs.readFileSync(reportLog, 'utf8').split('\n').filter(Boolean).length;
  } catch {}
  ttLine =
    reports > 0
      ? `Trusted Types: enforced — a raw string hit a sink and went through the default policy; DOMPurify removed the payload (${reports} report${reports === 1 ? '' : 's'} logged to /tt-report)`
      : 'Trusted Types: enforced — no raw string reached a sink; the app rendered through the typed boundary (safevalues sanitizer), payload removed';
} else {
  ttLine = 'Trusted Types: not enforced — whatever the app\'s own escaping missed reaches the DOM';
}
await overlay([cspLine, ttLine, fired ? '→ window.__xss set: the attacker script RAN' : '→ window.__xss still null: nothing ran', `→ rendered body: ${rendered.replace(/\s+/g, ' ').slice(0, 110)}`]);
await page.waitForTimeout(holdSeconds * 1000);

await context.close();
await browser.close();
server.kill();

const [video] = fs.readdirSync(tmpVideoDir).filter((f) => f.endsWith('.webm'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(path.join(tmpVideoDir, video), out);
fs.rmSync(tmpVideoDir, { recursive: true, force: true });
console.log(`${arm.label}: payload ${fired ? 'FIRED' : 'inert'} · csp violations seen: ${cspv} · console: ${violations.length} → ${path.relative(ROOT, out)}`);
