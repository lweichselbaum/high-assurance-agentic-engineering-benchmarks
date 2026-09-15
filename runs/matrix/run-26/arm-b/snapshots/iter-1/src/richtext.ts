import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** A newline in the body is a line break too (the tags <br>/<b>/<i>/<a> are typed by hand). */
const NEWLINE = /\r\n|\r|\n/g;

/**
 * Renders a note body as rich text.
 *
 * The body is attacker-controlled, so it never reaches a sink as a raw string: `sanitizeHtml`
 * (safevalues) parses it against an allowlist — inline formatting and `<a href>` survive, event
 * handlers, `<script>`/`<svg>` and `javascript:` URLs do not — and hands back a `SafeHtml` that
 * `setElementInnerHtml` can assign under `require-trusted-types-for 'script'`.
 */
export function setRichText(el: HTMLDivElement, body: string): void {
  setElementInnerHtml(el, sanitizeHtml(body.replace(NEWLINE, '<br>')));
}
