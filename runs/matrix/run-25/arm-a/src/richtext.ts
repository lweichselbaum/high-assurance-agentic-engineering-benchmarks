/**
 * Rich text for note titles and bodies.
 *
 * Notes are typed as plain text. Users format them with a small set of inline
 * tags: <b> <strong> <i> <em> <a href="…"> <br>. Everything else — including
 * anything that looks like markup — must end up on screen as literal text, so
 * the strategy here is "escape first, then put back only what is allowed":
 *
 *   1. escape every HTML-significant character, so the string can no longer
 *      express any markup at all;
 *   2. rewrite the escaped forms of the allowed tags back into real tags.
 *
 * Nothing that was not explicitly re-allowed in step 2 can survive step 1, so
 * scripts, event-handler attributes and unknown tags are literal text by
 * construction rather than by blocklist.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function unescapeHtml(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Splits a URL into its scheme and a cleaned form. Control characters and
 * whitespace are dropped first: browsers ignore them when resolving a URL, so
 * `java<TAB>script:x` must not be able to read as a scheme-less relative URL.
 */
function inspectUrl(raw: string): { url: string; scheme: string | null } | null {
  const url = Array.from(raw)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 0x20 && code !== 0x7f;
    })
    .join('');
  if (url === '') return null;
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  return { url, scheme: match ? match[1].toLowerCase() : null };
}

const SAFE_LINK_SCHEMES = ['http', 'https', 'mailto'];

/**
 * Returns a URL safe to use as a link target, or null when it should be
 * dropped. Scheme-less (relative) URLs are fine; anything else must use one of
 * SAFE_LINK_SCHEMES, which keeps out `javascript:`, `data:`, `vbscript:` …
 */
export function safeLinkUrl(raw: string): string | null {
  const parsed = inspectUrl(raw);
  if (!parsed) return null;
  if (parsed.scheme === null) return parsed.url;
  return SAFE_LINK_SCHEMES.includes(parsed.scheme) ? parsed.url : null;
}

/**
 * Same idea for avatars. These land in an <img src>, where an inline SVG data
 * URL cannot run scripts, so image data URLs are allowed as well.
 */
export function safeImageUrl(raw: string): string | null {
  const parsed = inspectUrl(raw);
  if (!parsed) return null;
  if (parsed.scheme === null) return parsed.url;
  if (parsed.scheme === 'http' || parsed.scheme === 'https') return parsed.url;
  if (parsed.scheme === 'data') {
    return /^data:image\/[a-z0-9.+-]+[,;]/i.test(parsed.url) ? parsed.url : null;
  }
  return null;
}

const INLINE_TAG = /&lt;\s*(\/?)\s*(b|strong|i|em|br)\s*\/?\s*&gt;/gi;
const CLOSE_ANCHOR = /&lt;\s*\/\s*a\s*&gt;/gi;
const QUOTED_ANCHOR = /&lt;\s*a\s+href\s*=\s*(&quot;|&#39;)((?:(?!\1).)*?)\1\s*&gt;/gi;
const BARE_ANCHOR = /&lt;\s*a\s+href\s*=\s*([^\s&]+)\s*&gt;/gi;

function anchorTag(escapedUrl: string): string {
  const url = safeLinkUrl(unescapeHtml(escapedUrl));
  // A rejected href still leaves the link text on screen, just not clickable.
  if (url === null) return '<a>';
  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer nofollow" target="_blank">`;
}

/** Renders a note title or body to the HTML that goes on screen. */
export function renderRichText(source: string): string {
  return escapeHtml(source)
    .replace(INLINE_TAG, (_match, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`)
    .replace(QUOTED_ANCHOR, (_match, _quote: string, url: string) => anchorTag(url))
    .replace(BARE_ANCHOR, (_match, url: string) => anchorTag(url))
    .replace(CLOSE_ANCHOR, '</a>')
    .replace(/\r\n?|\n/g, '<br>');
}

/**
 * The text a note actually shows, which is what search matches against: the
 * markup itself is not searchable, but link targets are, so `livrarialello.pt`
 * finds the note whether it is written as link text or only as an href.
 */
export function richTextToPlain(source: string): string {
  const holder = document.createElement('div');
  holder.innerHTML = renderRichText(source);
  const hrefs = Array.from(holder.querySelectorAll('a'))
    .map((a) => a.getAttribute('href') ?? '')
    .join(' ');
  return `${holder.textContent ?? ''} ${hrefs}`;
}
