/**
 * Avatar URLs come from a text field, so they are attacker-controlled.
 *
 * `img.src` is not a script sink, but `javascript:` in an `href`-shaped field is a classic way to
 * get a scheme past a reviewer, so this is an allowlist rather than a `javascript:` blocklist:
 * a URL is rendered only if it *starts* with a scheme we chose. Anything else — `javascript:`,
 * `data:text/html`, `vbscript:`, whitespace- or NUL-padded variants — falls through to `null`
 * and no `<img>` is created at all.
 */
const ALLOWED_URL = /^(?:https?:\/\/|data:image\/)/i;

/** The URL to use as an avatar `src`, or `null` if there is no usable one. */
export function safeAvatarUrl(raw: string): string | null {
  const url = raw.trim();
  return ALLOWED_URL.test(url) ? url : null;
}
