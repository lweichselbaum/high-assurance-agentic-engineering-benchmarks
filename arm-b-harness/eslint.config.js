// Gate 3: safe-coding lint (google/safety-web) + a few CSP-compatibility rules.
// This file is part of the harness. The agent does not edit it (see verify.sh gate 0).
import tseslint from 'typescript-eslint';
import safetyWeb from '@safety-web/eslint-plugin';

const SAFE_URL_HINT = 'from safevalues/dom (it rejects javascript: URLs). See harness/README.md.';

/**
 * safety-web reports at two confidence levels. VIOLATION is the bar tsec (gate 2) enforces; the
 * *_POTENTIAL_VIOLATION level also fires on e.g. `textContent` assignments to an `HTMLElement`-typed
 * variable (it could, statically, be a <script>). The gate enforces the tsec bar so that both
 * compile-time gates agree; a potential violation is still a real finding, only not a build error here.
 */
function atViolationConfidence(rule) {
  return {
    ...rule,
    create(context) {
      // context.report is non-configurable, so shadow it on a derived object instead of proxying.
      const filtered = Object.create(context, {
        report: {
          value: (descriptor) => {
            if (descriptor?.data?.confidence === 'VIOLATION') context.report(descriptor);
          },
        },
      });
      return rule.create(filtered);
    },
  };
}
const safetyWebAtTsecBar = {
  rules: { 'trusted-types-checks': atViolationConfidence(safetyWeb.rules['trusted-types-checks']) },
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'harness/server.mjs',
      'harness/vite.config.mjs',
      // The one reviewed Trusted Types boundary. Exempted in tsec-exemptions.json for the same reason.
      'harness/trusted-boundary.ts',
      '.scaffold/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'harness/entry.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@safety-web': safetyWebAtTsecBar },
    rules: {
      '@safety-web/trusted-types-checks': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='href'][right.type!='Literal']",
          message: 'Assigning a non-literal to .href can inject javascript: URLs. Use setAnchorHref(anchor, url) ' + SAFE_URL_HINT,
        },
        {
          selector: "AssignmentExpression[left.type='MemberExpression'][left.object.name='location']",
          message: 'Navigating via location.* from a string can inject javascript: URLs. Use setLocationHref(location, url) ' + SAFE_URL_HINT,
        },
        {
          selector: "CallExpression[callee.object.name='location'][callee.property.name=/^(assign|replace)$/]",
          message: 'location.assign/replace from a string can inject javascript: URLs. Use locationAssign/locationReplace ' + SAFE_URL_HINT,
        },
        {
          selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value=/^(href|src|srcdoc|action|formaction|on[a-z]+)$/i]",
          message: 'setAttribute on a URL/handler attribute bypasses type checks. Use the safevalues/dom setter for that element, or a validated URL. See harness/README.md.',
        },
      ],
    },
  },
);
