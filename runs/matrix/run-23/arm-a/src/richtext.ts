/**
 * Rich text for note titles and bodies.
 *
 * Notes are typed as plain text into an input/textarea, and users format them with a small
 * set of inline tags: <b> <strong> <i> <em> <a href="…"> <br>. Everything else is text.
 *
 * The renderer is a tokenizer, not a filter: it walks the input, escapes every run of text,
 * and re-emits only tags it recognises from the allowlist. A tag it does not recognise is
 * escaped and shown literally, so there is no path from input to markup that this file does
 * not construct itself. The only user-controlled value that reaches an attribute is a link
 * href, and that is entity-decoded, scheme-checked and re-escaped first.
 */

const TEXT_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a run of text so it renders literally in HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => TEXT_ESCAPES[c]);
}

/** Inline tags that carry no attributes. */
const PLAIN_TAGS = new Set(['b', 'strong', 'i', 'em']);

/** URL schemes we are willing to put in an href. */
const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Media types we are willing to put in an <img src> as a data: URL. */
const IMAGE_DATA_TYPES = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  tab: '\t',
  newline: '\n',
};

/**
 * Decode HTML entities in a value that is about to be scheme-checked.
 *
 * The browser decodes entities in attribute values, so `&#106;avascript:alert(1)` would
 * become a javascript: URL after parsing. Scheme checks have to run on the decoded form.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);?/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const digits = hex ? body.slice(2) : body.slice(1);
      const code = Number.parseInt(digits, hex ? 16 : 10);
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Strip the characters a URL may not contain but that get ignored when parsing one. */
function stripUrlNoise(value: string): string {
  // Tabs, newlines and C0/C1 controls are dropped by URL parsers, so `java\nscript:` is a
  // javascript: URL. Remove them before looking at the scheme.
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '').trim();
}

function hasScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

/**
 * Return `url` if it is safe to use as a link target, else null.
 * Relative and protocol-relative URLs are allowed; absolute ones must use a known scheme.
 */
export function safeLinkUrl(url: string): string | null {
  const candidate = stripUrlNoise(decodeEntities(url));
  if (!candidate) return null;
  if (!hasScheme(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    return LINK_SCHEMES.has(parsed.protocol) ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * Return `url` if it is safe to use as an image source, else null.
 * Allows http(s) and data: URLs with an image media type. An SVG loaded through <img> cannot
 * run script, so image/svg+xml is included (the seed data uses it). Relative URLs are
 * rejected: an avatar always points somewhere, and allowing them turns typos into requests
 * back at this app.
 */
export function safeImageUrl(url: string): string | null {
  const candidate = stripUrlNoise(decodeEntities(url));
  if (!candidate) return null;
  if (IMAGE_DATA_TYPES.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

export interface RichTextOptions {
  /** Render <a href="…"> as a link. Off for titles, which are inside a button. */
  links?: boolean;
  /** Turn a literal newline into a line break. On for bodies. */
  newlines?: boolean;
}

/** A parsed `<…>` run from the input. */
interface ParsedTag {
  closing: boolean;
  name: string;
  attrs: string;
}

function parseTag(raw: string): ParsedTag | null {
  const match = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([\s/][\s\S]*?)?\s*\/?\s*>$/.exec(raw);
  if (!match) return null;
  return { closing: match[1] === '/', name: match[2].toLowerCase(), attrs: match[3] ?? '' };
}

function hrefFrom(attrs: string): string {
  const match = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>]+))/i.exec(attrs);
  if (!match) return '';
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function escapeText(value: string, newlines: boolean): string {
  const escaped = escapeHtml(value);
  return newlines ? escaped.replace(/\r\n|\r|\n/g, '<br>') : escaped.replace(/[\r\n]+/g, ' ');
}

/** Close open tags down to and including `index`, innermost first. */
function unwindTo(open: string[], index: number): string {
  let out = '';
  while (open.length > index) out += `</${open.pop()}>`;
  return out;
}

/**
 * Render note text as HTML: allowlisted inline formatting kept, everything else escaped.
 * The result is safe to assign to innerHTML.
 */
export function renderRichText(input: string, options: RichTextOptions = {}): string {
  const { links = false, newlines = false } = options;
  const open: string[] = [];
  let out = '';
  let cursor = 0;

  while (cursor < input.length) {
    const start = input.indexOf('<', cursor);
    if (start < 0) {
      out += escapeText(input.slice(cursor), newlines);
      break;
    }
    out += escapeText(input.slice(cursor, start), newlines);

    const end = input.indexOf('>', start + 1);
    if (end < 0) {
      // No closing bracket: the rest of the input is text.
      out += escapeText(input.slice(start), newlines);
      break;
    }

    const raw = input.slice(start, end + 1);
    const tag = parseTag(raw);
    cursor = end + 1;

    if (!tag) {
      out += escapeText(raw, newlines);
      continue;
    }

    if (tag.name === 'br') {
      // A closing </br> is meaningless; treat any br as a single break.
      out += '<br>';
      continue;
    }

    if (tag.name === 'a' && !links) {
      // Titles sit inside a button, where an anchor cannot go: keep the text, drop the tag.
      continue;
    }

    if (!PLAIN_TAGS.has(tag.name) && tag.name !== 'a') {
      // Not on the allowlist (script, img, div, onerror carriers, …): show it as text.
      out += escapeText(raw, newlines);
      continue;
    }

    if (tag.closing) {
      const index = open.lastIndexOf(tag.name);
      // A close with no matching open is dropped rather than emitted unbalanced.
      if (index >= 0) out += unwindTo(open, index);
      continue;
    }

    if (tag.name === 'a') {
      // Anchors cannot nest; close an open one first so the browser does not reparent.
      const nested = open.lastIndexOf('a');
      if (nested >= 0) out += unwindTo(open, nested);
      const href = safeLinkUrl(hrefFrom(tag.attrs));
      // An unusable href still leaves the link text visible, just not clickable.
      out += href
        ? `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer">`
        : '<a>';
      open.push('a');
      continue;
    }

    out += `<${tag.name}>`;
    open.push(tag.name);
  }

  // Unclosed formatting must not leak into the rest of the feed.
  return out + unwindTo(open, 0);
}

/** The visible text of note markup, used for case-insensitive search matching. */
export function plainText(input: string): string {
  const stripped = input.replace(/<\s*\/?\s*[a-zA-Z][a-zA-Z0-9]*(?:[\s/][^<>]*)?>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}
