// URL vetting for the two places a note carries a user-supplied URL:
// link hrefs inside the rich-text body, and the author avatar.

// Control characters and whitespace tucked inside a URL are how "java\tscript:"
// style bypasses are written, so refuse them outright.
const CONTROL_CHARS = /[\u0000-\u0020\u007f-\u00a0\u2028\u2029\ufeff]/;
// A scheme per RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":"
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns a href safe to put on an <a>, or null if it must be dropped.
 * Absolute http(s)/mailto and same-document or site-relative URLs pass;
 * every other scheme (javascript:, data:, vbscript:, …) is refused.
 */
export function safeLinkHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || CONTROL_CHARS.test(value)) return null;
  if (/^(?:https?|mailto):/i.test(value)) return value;
  if (HAS_SCHEME.test(value)) return null;
  // No scheme at all: a relative or same-document URL, which cannot execute.
  return value;
}

/**
 * Returns a src safe to put on <img class="note-avatar">, or null.
 * http(s) and data:image/* only — an SVG loaded through <img> cannot run
 * script, so the seeded data: avatars are fine, but data:text/html is not.
 */
export function safeImageSrc(raw: string): string | null {
  const value = raw.trim();
  if (!value || CONTROL_CHARS.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/[a-z0-9+.-]+[,;]/i.test(value)) return value;
  if (HAS_SCHEME.test(value)) return null;
  return value;
}
