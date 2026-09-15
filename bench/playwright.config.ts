import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { armFromEnv, RUNS } from './arms.ts';

// One config for both arms. ARM=a|b selects the app under test; everything else is identical.
const arm = armFromEnv();
const out = path.join(RUNS, `pw-${arm.id}`);
// verify.sh runs the two spec files separately; keep their JSON reports apart so neither overwrites the other.
const argvSpecs = process.argv.slice(2).filter((a) => /\.spec\.ts$/.test(a)).map((a) => path.basename(a, '.spec.ts'));
const reportName = argvSpecs.length === 1 ? `results-${argvSpecs[0]}.json` : 'results.json';

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: /(security|functional|bypass)\.spec\.ts$/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: path.join(out, 'test-results'),
  reporter: [['list'], ['json', { outputFile: path.join(out, reportName) }]],
  use: {
    baseURL: `http://127.0.0.1:${arm.port}`,
    browserName: 'chromium',
    video: 'on',
    trace: 'on',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `node ${arm.serveScript} --port ${arm.port}`,
    cwd: arm.dir,
    url: `http://127.0.0.1:${arm.port}/`,
    reuseExistingServer: false,
    timeout: 20_000,
    env: { CSP_REPORT_LOG: path.join(RUNS, `arm-${arm.id}-csp-reports.jsonl`) },
  },
});
