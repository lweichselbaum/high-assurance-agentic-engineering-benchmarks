import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/**
 * Rendering user rich text.
 *
 * A title/body is typed as text and may contain the inline tags <b>, <strong>, <i>, <em>,
 * <a href="…"> and <br>. It is untrusted input, so it never reaches a DOM sink as a raw
 * string: `sanitizeHtml` (safevalues) parses it and returns a `SafeHtml` that keeps the
 * formatting elements and drops everything else — scripts, event handlers, javascript: hrefs.
 * `setElementInnerHtml` is the only way that value gets written, and the Trusted Types
 * boundary in harness/trusted-boundary.ts backstops it at runtime.
 */

/** A newline in the source is a line break too, exactly like an explicit <br>. */
function withLineBreaks(source: string): string {
  return source.replace(/\r\n|\r|\n/g, '<br>');
}

/** Replace the contents of `target` with the rendered form of `source`. */
export function renderRichText(target: HTMLElement, source: string): void {
  setElementInnerHtml(target, sanitizeHtml(withLineBreaks(source)));
}

/** The text a reader actually sees, with the markup resolved. Used for search matching. */
export function toPlainText(source: string): string {
  const holder = document.createElement('div');
  renderRichText(holder, source);
  return holder.textContent ?? '';
}
