import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/**
 * Renders a note body typed as plain text with inline `<b>`/`<i>`/`<a href>`/`<br>` markup.
 * A literal newline is treated as a line break too, per the feature spec.
 */
export function renderRichBody(container: HTMLElement, raw: string): void {
  const withLineBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  setElementInnerHtml(container, sanitizeHtml(withLineBreaks));
}

const SAFE_AVATAR_SCHEME = /^(https?:|data:image\/)/i;

export function isSafeAvatarUrl(url: string): boolean {
  return SAFE_AVATAR_SCHEME.test(url.trim());
}
