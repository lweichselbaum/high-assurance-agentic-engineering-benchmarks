# The harness

This directory is the high-assurance stack the app is built inside. The app code lives in `src/`;
nothing here is app code, and none of it changes to make a check pass.

The invariants live outside the agent loop, in three places (the three gates of the talk):

| gate | where | what |
|---|---|---|
| compile time | `tsconfig.tsec.json` (tsec), `eslint.config.js` (safety-web) | unsafe DOM APIs are build errors |
| commit time | `verify.sh` gate 0 + `bench/harness-manifest.sha256` + CI | the gates themselves are checked for tampering on every run and every push |
| runtime | `server.mjs` | strict CSP with a per-response nonce and `require-trusted-types-for 'script'`, enforced by the browser on every response |

## What `verify.sh` runs, in order

0. **integrity** — `sha256sum -c ../bench/harness-manifest.sha256`: the harness files are the ones that were reviewed.
1. **tsc** — TypeScript strict mode.
2. **tsec** — Google's safe-coding conformance checker. Bans string-to-sink assignments (`innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `eval`, `script.src`, `Function`, `trustedTypes.createPolicy`, ...).
   Exemptions are listed in `tsec-exemptions.json`; for this app that list contains only the one reviewed boundary below.
3. **eslint** — `@safety-web/trusted-types-checks` (the same rules as a lint rule) plus CSP-compatibility rules
   (no `javascript:` URLs, no `eval`, no string timers, no raw `href`/`location` assignment).
4. **build** — Vite production build. `harness/vite.config.mjs` refuses inline `<script>` blocks and inline event handlers in `index.html`, because the CSP would.
5. **functional** — `bench/functional.spec.ts`: the features work.
6. **security** — `bench/security.spec.ts`: the payload corpus is inert, the served CSP is strict (checked with Google's `csp_evaluator`), Trusted Types are enforced.

## The runtime policy

`server.mjs` serves `dist/` and sets, on every response:

```
Content-Security-Policy:
  script-src 'nonce-{fresh per response}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
  trusted-types default google#safe dompurify;
  report-uri /csp-report
```

`'strict-dynamic'` lets the nonce'd module script load its own imports; nothing else executes.
`require-trusted-types-for 'script'` means a raw string can no longer reach `innerHTML`, `script.src`, `eval`, ...:
it must come out of one of the three listed policies. `default` is the boundary in `trusted-boundary.ts`
(DOMPurify, the last line of defense); `google#safe` is the policy `safevalues` uses to mint the values its
builders produce; `dompurify` is DOMPurify's own. Violations and sanitizer interventions are POSTed to
`/csp-report` and `/tt-report` and logged under `runs/`.

## Banned → use instead

| banned (compile error) | use instead |
|---|---|
| `el.innerHTML = s`, `el.outerHTML = s`, `el.insertAdjacentHTML(...)` | plain text: `el.textContent = s`. Rich text: `setElementInnerHtml(el, sanitizeHtml(s))` (`safevalues/dom`, `safevalues`) — or build nodes with `document.createElement` + `textContent` |
| `document.write(...)` | build DOM nodes |
| `eval`, `new Function`, `setTimeout('...')` | no equivalent; there is no dynamic code in this app |
| `a.href = s`, `el.setAttribute('href', s)` | `setAnchorHref(a, s)` (`safevalues/dom`) — drops `javascript:` |
| `location.href = s`, `location.assign(s)` | `setLocationHref(location, s)` (`safevalues/dom`) |
| `script.src = s` | not needed |
| `trustedTypes.createPolicy(...)` | already exists once, in `harness/trusted-boundary.ts` |

Avatar URLs: `img.src` is not a script sink, but validate the scheme (`http:`, `https:`, `data:image/`) before assigning it.
