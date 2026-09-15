#!/usr/bin/env node
// Prints the plain-text output of an asciicast (v2) file — handy for reading a recorded agent session.
// Usage: node tools/cast-text.mjs runs/arm-b.cast [--tail 3000]
import fs from 'node:fs';
const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('usage: node tools/cast-text.mjs <file.cast> [--tail N]'); process.exit(2); }
const tail = rest.indexOf('--tail') >= 0 ? Number(rest[rest.indexOf('--tail') + 1]) : 0;
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
let text = '';
for (const l of lines.slice(1)) {
  try { const e = JSON.parse(l); if (e[1] === 'o') text += e[2]; } catch { /* skip */ }
}
text = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r\n/g, '\n');
const header = JSON.parse(lines[0]);
const last = lines.length > 1 ? JSON.parse(lines[lines.length - 1])[0] : 0;
console.error(`[${file}: ${header.width}x${header.height}, ${lines.length - 1} events, ${Math.round(last)}s]`);
process.stdout.write(tail ? text.slice(-tail) : text);
