/**
 * Rich text rendering — the only place in the app where a user-supplied string becomes markup.
 *
 * Bodies and titles are typed as text and may contain inline tags. They are parsed by
 * safevalues' HTML sanitizer, which returns a `SafeHtml` minted through the `google#safe`
 * Trusted Types policy; `setElementInnerHtml` is the only way that value reaches the DOM.
 * Anything outside the allowlists below (script, img, svg, event handlers, `javascript:`
 * hrefs) is dropped by the sanitizer, so the harness' `default` policy never has to catch it.
 */
import { HtmlSanitizerBuilder } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

/** The inline formatting the feature request promises, plus the obvious block-level neighbours. */
const BODY_ELEMENTS = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'span', 'code', 'pre', 'p', 'ul', 'ol', 'li', 'blockquote']);
/** Titles sit inside a button, so they get formatting but no links or block elements. */
const TITLE_ELEMENTS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'span', 'code']);
const ALLOWED_ATTRIBUTES = new Set(['href', 'title', 'target', 'rel']);

const bodySanitizer = new HtmlSanitizerBuilder().onlyAllowElements(BODY_ELEMENTS).onlyAllowAttributes(ALLOWED_ATTRIBUTES).build();
const titleSanitizer = new HtmlSanitizerBuilder().onlyAllowElements(TITLE_ELEMENTS).onlyAllowAttributes(ALLOWED_ATTRIBUTES).build();

/** A newline in the body is a line break too, not just an explicit `<br>`. */
function withLineBreaks(body: string): string {
  return body.replace(/\r\n|\r|\n/g, '<br>');
}

/** Renders a note body: inline tags kept, newlines turned into breaks, everything else stripped. */
export function renderBody(target: Element, body: string): void {
  setElementInnerHtml(target, bodySanitizer.sanitize(withLineBreaks(body)));
  for (const anchor of target.querySelectorAll('a')) {
    // The sanitizer already dropped unsafe schemes; this only hardens links that opt into a new tab.
    anchor.rel = 'noopener noreferrer';
  }
}

/** Renders a note title with its inline formatting. */
export function renderTitle(target: Element, title: string): void {
  setElementInnerHtml(target, titleSanitizer.sanitize(title));
}

/**
 * An avatar URL is only used as `img.src`, which is not a script sink — but a `javascript:`
 * URL there is still a stored-XSS foothold for anything that later copies it into an anchor.
 * Only the three schemes an avatar can legitimately use are accepted.
 */
const SAFE_IMAGE_URL = /^(?:https?:\/\/|data:image\/[a-z0-9.+-]+[;,])/i;

export function safeAvatarUrl(raw: string): string | null {
  const url = raw.trim();
  return url !== '' && SAFE_IMAGE_URL.test(url) ? url : null;
}
