// Build config for arm B. Part of the harness (verify.sh gate 0 checks it is untouched).
import path from 'node:path';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root,
  publicDir: path.join(root, 'public'),
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    // One nonce'd module script, no preload hints: exactly what a strict CSP with 'strict-dynamic' expects.
    modulePreload: false,
    sourcemap: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  plugins: [harnessGuard()],
});

/**
 * Refuses at build time what the CSP would refuse at runtime, so the feedback arrives in the loop:
 * inline scripts, inline event handlers, javascript: URLs, and an index.html that skips the harness entry.
 */
function harnessGuard() {
  return {
    name: 'harness-guard',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const problems = [];
        if (!/<script\b[^>]*\ssrc=["']\/harness\/entry\.ts["'][^>]*>/i.test(html)) {
          problems.push(
            'index.html must load the harness entry exactly like this: <script type="module" src="/harness/entry.ts"></script> — it installs the Trusted Types boundary before src/main.ts runs.',
          );
        }
        const inline = html.match(/<script\b(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/gi) ?? [];
        if (inline.length) problems.push(`inline <script> blocks are blocked by the strict CSP (${inline.length} found). Move the code into src/.`);
        const handlers = html.match(/\son[a-z]+\s*=\s*["']/gi) ?? [];
        if (handlers.length) problems.push(`inline event handler attributes are blocked by the strict CSP (${handlers.map((h) => h.trim()).join(', ')}). Use addEventListener in src/.`);
        if (/javascript:/i.test(html)) problems.push('javascript: URLs are blocked by the strict CSP.');
        if (problems.length) throw new Error('harness-guard: index.html is not CSP-compatible\n - ' + problems.join('\n - '));
        return html;
      },
    },
  };
}
