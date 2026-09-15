import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** A bare newline in the textarea is also a line break, alongside explicit <br>. */
function withLineBreaks(body: string): string {
  return body.replace(/\r\n|\r|\n/g, '<br>');
}

/** Renders user-authored rich text into `el`, sanitized through the app's Trusted Types boundary. */
export function renderRichText(el: HTMLElement, body: string): void {
  setElementInnerHtml(el, sanitizeHtml(withLineBreaks(body)));
}
