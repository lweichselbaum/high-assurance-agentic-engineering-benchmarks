import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/**
 * Renders user-authored note text into `el`. A literal newline is treated as a line break
 * (per the feature spec), same as an explicit <br>; the inline formatting tags the user typed
 * (<b>, <i>, <a href>, ...) are sanitized, not escaped, so they render as formatting.
 */
export function renderRichText(el: Element, raw: string): void {
  const withLineBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withLineBreaks));
}
