import { HtmlSanitizerBuilder } from 'safevalues';

/**
 * Rendering the body is the only place untrusted input becomes markup, so it is the only place
 * that needs an argument. The argument is: the sanitizer below decides what an element *may* be,
 * the strict CSP decides what it may *do*, and neither depends on the other holding.
 *
 * The allowlist is the feature request's list (bold, italic, links, line breaks) plus a few inline
 * tags that cost nothing. Everything else — including IMG and SVG, the usual `onerror`/`onload`
 * carriers — is dropped, and `href` goes through safevalues' URL sanitizer, which rewrites
 * `javascript:` to `about:invalid`.
 */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'A',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'CODE',
  'SPAN',
  'BR',
]);

const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'title']);

const sanitizer = new HtmlSanitizerBuilder()
  .onlyAllowElements(ALLOWED_ELEMENTS)
  .onlyAllowAttributes(ALLOWED_ATTRIBUTES)
  .build();

/** A newline in the body is a line break too, so make it one before parsing. */
function newlinesToBreaks(source: string): string {
  return source.replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * Renders the user's rich text into `target`, replacing whatever was there.
 *
 * `sanitizeToFragment` parses the source in an inert document and rebuilds an allowlisted copy of
 * the tree, so no HTML string is ever assigned to a DOM sink: there is nothing here for
 * `innerHTML` — or Trusted Types — to intercept.
 */
export function renderRichText(target: Element, source: string): void {
  target.replaceChildren(sanitizer.sanitizeToFragment(newlinesToBreaks(source)));
}
