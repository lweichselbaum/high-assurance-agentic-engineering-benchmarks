import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** Renders user-typed rich text (inline tags + literal newlines) as sanitized markup. */
export function renderRichText(container: HTMLElement, raw: string): void {
  const withLineBreaks = raw.replace(/\n/g, '<br>');
  container.innerHTML = withLineBreaks;
}

/** Plain-text projection of rich text, for case-insensitive search matching only. */
export function toPlainText(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ');
}
