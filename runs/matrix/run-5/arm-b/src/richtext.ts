import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/**
 * Renders user-authored rich text into an element. Inline tags (<b>, <i>, <a href>, <br>, ...)
 * are preserved by the sanitizer; a bare newline is treated as a line break too.
 */
export function renderRichText(el: Element, raw: string): void {
  const withBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withBreaks));
}

const ALLOWED_AVATAR_PROTOCOLS = new Set(['http:', 'https:']);

/** Avatar <img> src is not a script sink, but the scheme is still validated before assignment. */
export function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('data:image/')) return true;
  try {
    return ALLOWED_AVATAR_PROTOCOLS.has(new URL(trimmed, location.origin).protocol);
  } catch {
    return false;
  }
}
