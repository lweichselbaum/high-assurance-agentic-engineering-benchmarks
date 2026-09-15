#!/usr/bin/env node
// Gate 03 — runtime. Serves dist/ with a fresh nonce per response and the strict CSP + Trusted Types
// policy below. Part of the harness (verify.sh gate 0 checks it is untouched).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = Number(arg('--port', process.env.PORT ?? 4174));
const HOST = '127.0.0.1';
const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const REPORT_LOG = process.env.CSP_REPORT_LOG ?? path.resolve(import.meta.dirname, '..', '..', 'runs', 'arm-b-csp-reports.jsonl');

/** The policies a string may come out of. Everything else is refused by the browser. */
export const TRUSTED_TYPES_POLICIES = ['default', 'google#safe', 'dompurify'];

export function buildCsp(nonce) {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `require-trusted-types-for 'script'`,
    `trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`,
    `report-uri /csp-report`,
  ].join('; ');
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function logReport(kind, body, req) {
  let parsed = body;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* keep raw */
  }
  const line = { ts: new Date().toISOString(), kind, report: parsed, ua: req.headers['user-agent'] ?? '' };
  try {
    fs.mkdirSync(path.dirname(REPORT_LOG), { recursive: true });
    fs.appendFileSync(REPORT_LOG, JSON.stringify(line) + '\n');
  } catch {
    /* logging is best-effort */
  }
  const summary =
    kind === 'csp-report'
      ? `${parsed?.['csp-report']?.['violated-directive'] ?? '?'} blocked ${parsed?.['csp-report']?.['blocked-uri'] ?? ''} ${parsed?.['csp-report']?.['script-sample'] ?? ''}`
      : `${parsed?.sink ?? '?'} ${JSON.stringify(parsed?.sample ?? '').slice(0, 120)}`;
  console.error(`[${kind}] ${summary}`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  if (req.method === 'POST' && (url.pathname === '/csp-report' || url.pathname === '/tt-report')) {
    let body = '';
    req.on('data', (chunk) => {
      if (body.length < 65536) body += chunk;
    });
    req.on('end', () => {
      logReport(url.pathname.slice(1), body, req);
      res.writeHead(204).end();
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(DIST, pathname));
  if (!file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }).end('not found');
    return;
  }

  const ext = path.extname(file);
  if (ext === '.html') {
    const nonce = crypto.randomBytes(16).toString('base64');
    const html = fs
      .readFileSync(file, 'utf8')
      .replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
    res.writeHead(200, {
      'Content-Type': MIME['.html'],
      'Content-Security-Policy': buildCsp(nonce),
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`harness/server.mjs: ${DIST}/index.html not found — run "pnpm build" first`);
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.error(`arm B (harness) serving ${DIST} at http://${HOST}:${PORT}/ — strict CSP + Trusted Types enforced; reports → ${REPORT_LOG}`);
});
