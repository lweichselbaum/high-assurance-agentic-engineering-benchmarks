import { setElementInnerHtml } from 'safevalues/dom';
import { sanitizeHtml } from 'safevalues';

/** Renders user-typed formatting (`<b>`, `<i>`, `<a href>`, `<br>`) and plain newlines as line breaks. */
export function renderRichText(el: HTMLElement, raw: string): void {
  const withBreaks = raw.replace(/\r\n|\n/g, '<br>');
  setElementInnerHtml(el, sanitizeHtml(withBreaks));
}

export function toPlainText(raw: string): string {
  const scratch = document.createElement('div');
  renderRichText(scratch, raw);
  return scratch.textContent ?? '';
}

const SAFE_AVATAR_PROTOCOLS = new Set(['http:', 'https:']);

/** Avatar `img.src` is not a script sink, but the scheme is still validated per harness/README.md. */
export function safeAvatarUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  try {
    const url = new URL(trimmed, location.href);
    return SAFE_AVATAR_PROTOCOLS.has(url.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}
