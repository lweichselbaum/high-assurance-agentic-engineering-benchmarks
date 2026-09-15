#!/usr/bin/env node
// Functional smoke check: build, serve, open the app in a headless browser, report console errors.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dir = import.meta.dirname;
const build = spawnSync('pnpm', ['build'], { cwd: dir, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const port = 4300 + Math.floor(Math.random() * 500);
const server = spawn('node', [path.join(dir, 'server.mjs'), '--port', String(port)], { cwd: dir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
let failed = false;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const form = await page.$('#note-form');
  const feed = await page.$('#feed');
  const notes = await page.$$('#feed article.note');
  console.log(`smoke: #note-form ${form ? 'found' : 'MISSING'}, #feed ${feed ? 'found' : 'MISSING'}, ${notes.length} note(s) rendered`);
  if (errors.length) {
    console.log('smoke: console/page errors:');
    for (const e of errors) console.log('  - ' + e);
  }
  failed = !form || !feed || errors.length > 0;
  await browser.close();
} finally {
  server.kill();
}
console.log(failed ? 'smoke: FAILED' : 'smoke: OK');
process.exit(failed ? 1 : 0);
