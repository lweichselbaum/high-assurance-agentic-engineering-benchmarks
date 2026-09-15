/**
 * Rich text rendering.
 *
 * A body is typed as text and formatted with the inline tags `<b>`, `<strong>`, `<i>`, `<em>`,
 * `<a href="…">` and `<br>`; a newline is a line break too. The source is user input, so it only
 * ever reaches the DOM through `sanitizeHtml` (safevalues' HTML sanitizer, minted through the
 * `google#safe` Trusted Types policy). Everything the sanitizer does not recognise — scripts,
 * event handler attributes, `javascript:` hrefs — is dropped before the string becomes markup.
 */
import { sanitizeHtml, type SafeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** Sanitizing parses the source; the same sources are rendered on every keystroke, so memoize. */
const htmlCache = new Map<string, SafeHtml>();
const textCache = new Map<string, string>();

/** A newline in the source is a line break, exactly like an explicit `<br>`. */
function withLineBreaks(source: string): string {
  return source.replace(/\r\n|\r|\n/g, '<br>');
}

function toSafeHtml(source: string): SafeHtml {
  const cached = htmlCache.get(source);
  if (cached !== undefined) return cached;
  const safe = sanitizeHtml(withLineBreaks(source));
  htmlCache.set(source, safe);
  return safe;
}

/** Replaces the contents of `target` with the rendered formatting of `source`. */
export function renderRichText(target: HTMLElement, source: string): void {
  setElementInnerHtml(target, toSafeHtml(source));
}

/**
 * The visible text of a rich-text source, with the tags resolved — what search matches against
 * so that a query never has to know about the markup around the words.
 */
export function toPlainText(source: string): string {
  const cached = textCache.get(source);
  if (cached !== undefined) return cached;
  const holder = document.createElement('div');
  renderRichText(holder, source);
  const text = (holder.textContent ?? '').replace(/\s+/g, ' ').trim();
  textCache.set(source, text);
  return text;
}
