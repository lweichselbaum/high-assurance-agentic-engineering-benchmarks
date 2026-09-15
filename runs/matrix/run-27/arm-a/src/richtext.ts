// Rich text for note bodies and titles.
//
// Notes are typed as plain text. Users format them with a small, fixed set of inline
// tags — <b>, <strong>, <i>, <em>, <a href="…"> and <br> — and a newline is a line break.
//
// The renderer is an allow-list tokenizer, not a filter: it never passes any part of the
// source through to the output. Every character either goes through `escapeHtml` or is
// dropped, and the only unescaped markup in the result is the literal tag strings this
// file constructs. Anything the tokenizer does not recognise (an `<img onerror=…>`, a
// `<script>`, a stray `<`) comes out as visible text.

/** Tags a user may open and close inside a note. */
const INLINE_TAGS = 'b|strong|i|em';

const OPEN_INLINE = new RegExp(`^<\\s*(${INLINE_TAGS})\\s*>$`, 'i');
const CLOSE_INLINE = new RegExp(`^<\\s*/\\s*(${INLINE_TAGS})\\s*>$`, 'i');
const LINE_BREAK = /^<\s*br\s*\/?\s*>$/i;
const OPEN_LINK = /^<\s*a\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))\s*\/?\s*>$/i;
const CLOSE_LINK = /^<\s*\/\s*a\s*>$/i;

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
/** Stripped before a URL is inspected, so a tab inside `java<tab>script:` cannot hide the scheme. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
const LINK_SCHEMES = new Set(['http', 'https', 'mailto']);
const IMAGE_DATA_TYPES = /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Escape a run of source text and turn its newlines into line breaks. */
function escapeTextRun(text: string): string {
  return escapeHtml(text).replace(/\r\n?|\n/g, '<br>');
}

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'break' }
  | { kind: 'open'; tag: string; href?: string | null }
  | { kind: 'close'; tag: string };

/** Recognise a single `<…>` run, or return null so the caller renders it as text. */
function classify(raw: string, allowLinks: boolean): Token | null {
  if (LINE_BREAK.test(raw)) return { kind: 'break' };

  const opened = raw.match(OPEN_INLINE);
  if (opened) return { kind: 'open', tag: opened[1].toLowerCase() };

  const closed = raw.match(CLOSE_INLINE);
  if (closed) return { kind: 'close', tag: closed[1].toLowerCase() };

  if (!allowLinks) return null;

  const link = raw.match(OPEN_LINK);
  if (link) return { kind: 'open', tag: 'a', href: safeLinkUrl(link[1] ?? link[2] ?? link[3] ?? '') };

  if (CLOSE_LINK.test(raw)) return { kind: 'close', tag: 'a' };

  return null;
}

function* tokenize(source: string, allowLinks: boolean): Generator<Token> {
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf('<', index);
    if (start === -1) {
      yield { kind: 'text', text: source.slice(index) };
      return;
    }
    if (start > index) yield { kind: 'text', text: source.slice(index, start) };

    const end = source.indexOf('>', start);
    if (end === -1) {
      // An unterminated `<…`: the rest of the note is text.
      yield { kind: 'text', text: source.slice(start) };
      return;
    }

    const raw = source.slice(start, end + 1);
    yield classify(raw, allowLinks) ?? { kind: 'text', text: raw };
    index = end + 1;
  }
}

/**
 * Close `tag` and anything still open inside it, so `<b><i></b>` cannot leak an
 * unbalanced element into the rest of the feed. A closer with no opener is dropped.
 */
function closeThrough(open: string[], tag: string): string {
  const at = open.lastIndexOf(tag);
  if (at === -1) return '';
  let html = '';
  while (open.length > at) html += `</${open.pop()}>`;
  return html;
}

/**
 * A URL safe to put in an `href`: http(s), mailto, or a relative reference.
 * Returns null for every other scheme, `javascript:` included.
 */
export function safeLinkUrl(raw: string): string | null {
  const url = raw.replace(CONTROL_CHARS, '').trim();
  if (!url) return null;
  const scheme = url.match(SCHEME);
  if (!scheme) return url;
  return LINK_SCHEMES.has(scheme[1].toLowerCase()) ? url : null;
}

/**
 * A URL safe to put in an `<img src>`: http(s), a relative reference, or a `data:` URL
 * whose media type is an image. Browsers do not run scripts in an SVG loaded through
 * `<img>`, so the seeded `data:image/svg+xml` avatars are fine; `data:text/html` is not.
 */
export function safeImageUrl(raw: string): string | null {
  const url = raw.replace(CONTROL_CHARS, '').trim();
  if (!url) return null;
  const scheme = url.match(SCHEME);
  if (!scheme) return url;
  switch (scheme[1].toLowerCase()) {
    case 'http':
    case 'https':
      return url;
    case 'data':
      return IMAGE_DATA_TYPES.test(url) ? url : null;
    default:
      return null;
  }
}

export interface RichTextOptions {
  /** Titles render inside a button, where an anchor would be invalid; default true. */
  links?: boolean;
}

/** Render a note's source text as sanitised HTML. */
export function renderRichText(source: string, options: RichTextOptions = {}): string {
  const allowLinks = options.links !== false;
  const open: string[] = [];
  let html = '';

  for (const token of tokenize(source, allowLinks)) {
    switch (token.kind) {
      case 'text':
        html += escapeTextRun(token.text);
        break;
      case 'break':
        html += '<br>';
        break;
      case 'close':
        html += closeThrough(open, token.tag);
        break;
      case 'open':
        if (token.tag === 'a') {
          html += closeThrough(open, 'a'); // anchors cannot nest
          open.push('a');
          // `escapeHtml` also escapes `&`, so an entity in the source cannot re-form a
          // scheme once the browser decodes the attribute.
          html += token.href
            ? `<a href="${escapeHtml(token.href)}" rel="noopener noreferrer">`
            : '<a>';
        } else {
          open.push(token.tag);
          html += `<${token.tag}>`;
        }
        break;
    }
  }

  while (open.length) html += `</${open.pop()}>`;
  return html;
}

/** The visible text of a note, used for search so markup never matches a query. */
export function richTextToPlain(source: string): string {
  let text = '';
  for (const token of tokenize(source, true)) {
    if (token.kind === 'text') text += token.text;
    else if (token.kind === 'break') text += '\n';
  }
  return text;
}
