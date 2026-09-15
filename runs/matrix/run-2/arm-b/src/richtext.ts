import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** Renders user-typed rich text (inline tags, or bare newlines as line breaks) into `el`. */
export function renderRichText(el: HTMLElement, raw: string): void {
  const withBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withBreaks));
}
