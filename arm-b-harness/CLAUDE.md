# Porto Notes — arm B (high-assurance harness)

Implement the feature request you were given in `src/` (start in `src/main.ts`). `index.html` is yours
to edit too; keep the `<script type="module" src="/harness/entry.ts">` tag, it is how the app starts.
`fixtures.json` in this directory is the seed data from the request.

**`./verify.sh` must pass.** If it fails, read the first error, fix your code, and run it again.

Do not modify config, tests, tsconfig, ESLint, or the CSP: everything under `harness/`, `verify.sh`,
`package.json`, `tsconfig*.json`, `tsec-exemptions.json` and `eslint.config.js` is the harness, not the
app, and gate 0 of `verify.sh` checks that it is untouched. Do not add or upgrade dependencies.
`harness/README.md` explains what each gate checks.
