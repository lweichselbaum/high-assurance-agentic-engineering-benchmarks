/**
 * The single trusted boundary — the only place a raw HTML string is allowed in.
 *
 * With `require-trusted-types-for 'script'` in the CSP, a string reaching a DOM sink is routed
 * through the policy named `default` if one exists, and refused otherwise. This policy sanitizes.
 * It is small on purpose: the whole trusted surface of the app is this file, and it is reviewed,
 * exempted by name in tsec-exemptions.json, and untouchable by the agent (verify.sh gate 0).
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'span', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote'];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false, KEEP_CONTENT: true });
}

/** Best-effort telemetry: the server logs it under runs/ (a test signal and a demo overlay). */
function report(sink: string, sample: string): void {
  try {
    navigator.sendBeacon('/tt-report', JSON.stringify({ sink, sample: sample.slice(0, 300), href: location.href }));
  } catch {
    /* reporting never affects the app */
  }
}

if (window.trustedTypes) {
  window.trustedTypes.createPolicy('default', {
    createHTML: (s: string): string => {
      const clean = sanitize(s);
      if (clean !== s) report('html', s);
      return clean;
    },
    createScriptURL: (s: string): string => {
      report('script-url', s);
      throw new TypeError('Trusted Types: script URLs from strings are not allowed here');
    },
    createScript: (s: string): string => {
      report('script', s);
      throw new TypeError('Trusted Types: dynamic script from strings is not allowed here');
    },
  });
}
