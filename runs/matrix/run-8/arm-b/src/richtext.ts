// Porto Notes — renders user-authored rich text safely.
// Inline tags (<b>, <strong>, <i>, <em>, <a href>, <br>) plus plain newlines-as-line-breaks are
// supported; sanitizeHtml() strips anything else before it ever reaches the DOM.
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

export function renderRichText(el: HTMLElement, raw: string): void {
  const withLineBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withLineBreaks));
}
