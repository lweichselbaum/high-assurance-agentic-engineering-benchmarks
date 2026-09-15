// Rich text for note titles and bodies.
//
// Bodies are typed as plain text into a textarea; users format them with a small
// set of inline tags. Everything is escaped first, then only the allow-listed
// tags are re-introduced, so no attribute or tag the user wrote can survive into
// the output — the only markup in the result is markup this module emitted.

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

const SPACE = 0x20;
const DEL = 0x7f;

function parseUrl(raw: string): URL | null {
  // Drop whitespace and control characters: URL parsers ignore them inside
  // attributes, which is the classic way to smuggle `java\nscript:` past a check.
  let cleaned = '';
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (code > SPACE && code !== DEL) cleaned += char;
  }
  if (!cleaned) return null;
  try {
    // Resolving against the page turns anything that merely looks like a scheme
    // (`javascript&colon;…`) into an inert relative URL instead.
    return new URL(cleaned, document.baseURI);
  } catch {
    return null;
  }
}

/** A link target safe to put in `href`, or null. */
export function safeLinkUrl(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url || !LINK_PROTOCOLS.has(url.protocol)) return null;
  return url.href;
}

/** An image source safe to put in `src`, or null. */
export function safeImageUrl(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url) return null;
  if (IMAGE_PROTOCOLS.has(url.protocol)) return url.href;
  // Inline images are handy for avatars (the seed data uses them) and cannot run
  // script from an <img>, but they do have to actually be images.
  if (url.protocol === 'data:' && /^data:image\/[a-z0-9.+-]+[;,]/i.test(url.href)) {
    return url.href;
  }
  return null;
}

// These all run against already-escaped text, so `&lt;` is a user-typed `<`.
const INLINE_TAG = /&lt;(\/?)(b|strong|i|em)\s*&gt;/gi;
const BR_TAG = /&lt;br\s*\/?\s*&gt;/gi;
const LINK_CLOSE = /&lt;\/a\s*&gt;/gi;
// Only `<a href="…">` exactly — an anchor carrying any other attribute simply
// does not match and stays visible as literal text.
const LINK_OPEN = /&lt;a\s+href\s*=\s*(?:&quot;(.*?)&quot;|&#39;(.*?)&#39;|([^\s&]+))\s*&gt;/gi;

function renderInline(source: string, allowLinks: boolean): string {
  let html = escapeHtml(source);
  html = html.replace(INLINE_TAG, (_m, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`);
  html = html.replace(LINK_CLOSE, allowLinks ? '</a>' : '');
  html = html.replace(LINK_OPEN, (_m, quoted?: string, single?: string, bare?: string) => {
    if (!allowLinks) return '';
    const href = safeLinkUrl(unescapeHtml(quoted ?? single ?? bare ?? ''));
    if (!href) return '';
    return `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer" target="_blank">`;
  });
  return html;
}

/** Body markup: inline formatting, links, `<br>`, and newlines as line breaks. */
export function renderBody(source: string): string {
  return renderInline(source, true)
    .replace(BR_TAG, '<br>')
    .replace(/\r\n|[\r\n]/g, '<br>');
}

/**
 * Title markup: emphasis only. A heading stays on one line, and the title is
 * itself the button that selects the note, so it cannot nest a link.
 */
export function renderTitle(source: string): string {
  return renderInline(source, false)
    .replace(BR_TAG, ' ')
    .replace(/\r\n|[\r\n]/g, ' ');
}

/** The visible text of a note field, used for search matching. */
export function toPlainText(source: string): string {
  return source
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\/?(?:b|strong|i|em|a)(?:\s[^>]*)?>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
