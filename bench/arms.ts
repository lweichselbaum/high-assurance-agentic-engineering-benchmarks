import path from 'node:path';

export type ArmId = 'a' | 'b';

export interface Arm {
  id: ArmId;
  label: string;
  pkg: string;          // pnpm workspace package name
  dir: string;          // absolute path
  port: number;
  serveScript: string;  // relative to dir
  // Agent-written files the static scan looks at (relative to dir).
  scanGlobs: string[];
}

export const ROOT = path.resolve(import.meta.dirname, '..');
// RUNS_DIR redirects every benchmark output (security jsonl, Playwright reports, scorecards) — used by side experiments.
export const RUNS = process.env.RUNS_DIR ? path.resolve(process.env.RUNS_DIR) : path.join(ROOT, 'runs');
// PORT_BASE lets several copies of the repo (matrix lanes) benchmark side by side without port clashes.
const PORT_BASE = Number(process.env.PORT_BASE ?? 4173);

export const ARMS: Record<ArmId, Arm> = {
  a: {
    id: 'a',
    label: 'Arm A — vibe (no guardrails)',
    pkg: 'arm-a-vibe',
    dir: path.join(ROOT, 'arm-a-vibe'),
    port: PORT_BASE,
    serveScript: 'server.mjs',
    scanGlobs: ['src/**/*.{ts,js,mts,mjs}', 'index.html'],
  },
  b: {
    id: 'b',
    label: 'Arm B — high-assurance harness',
    pkg: 'arm-b-harness',
    dir: path.join(ROOT, 'arm-b-harness'),
    port: PORT_BASE + 1,
    serveScript: 'harness/server.mjs',
    scanGlobs: ['src/**/*.{ts,js,mts,mjs}', 'index.html'],
  },
};

export function armFromEnv(): Arm {
  const id = (process.env.ARM ?? 'a') as ArmId;
  const arm = ARMS[id];
  if (!arm) throw new Error(`Unknown ARM=${process.env.ARM}; expected "a" or "b"`);
  return arm;
}
