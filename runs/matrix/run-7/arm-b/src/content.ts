import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/**
 * Renders a note body into `el`. The body is plain text typed by the user, formatted with the
 * inline tags <b>/<strong>/<i>/<em>/<a href>/<br>; a literal newline is also a line break.
 * The HTML sanitizer (safevalues, backed by the reviewed Trusted Types policy) strips anything
 * else before it reaches the DOM.
 */
export function renderRichBody(el: Element, raw: string): void {
  const withLineBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withLineBreaks));
}

/** Plain-text rendition of a rich body, used for search matching. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/** Avatar URLs are assigned to img.src (not a script sink), but the scheme is still checked. */
export function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  if (/^data:image\//i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
