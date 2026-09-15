import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** Renders user-typed note text as inline rich text: allowed tags plus bare newlines as <br>. */
export function renderRichText(el: Element, raw: string): void {
  const withLineBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withLineBreaks));
}
