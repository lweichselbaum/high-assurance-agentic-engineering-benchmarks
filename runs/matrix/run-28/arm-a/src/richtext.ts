/**
 * Rich text for note titles and bodies.
 *
 * Users type plain text into a textarea and format it with a small set of inline
 * tags: <b> <strong> <i> <em> <a href="..."> <br>. A newline is also a line break.
 *
 * The source is never handed to innerHTML. It is tokenised here and rendered into
 * DOM nodes we construct ourselves, so the only markup that can ever appear is the
 * allowlist below: anything else -- <script>, <img onerror=...>, a stray attribute --
 * ends up as literal text, and link/image URLs are limited to safe schemes.
 */

/** Inline tags rendered as themselves. */
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em']);

/** Schemes a note may link to. */
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Image types an avatar may be inlined as. */
const AVATAR_DATA_TYPES = /^image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)(?:[;,]|$)/i;

/** Guards against a crafted body nesting thousands of tags. */
const MAX_DEPTH = 32;

/** A tag: name, then attributes where quoted values may contain '>'. */
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const HREF_RE = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(0xa0),
};

function fromCodePoint(value: number, fallback: string): string {
  if (!Number.isFinite(value) || value < 1 || value > 0x10ffff) return fallback;
  if (value >= 0xd800 && value <= 0xdfff) return fallback; // lone surrogate
  return String.fromCodePoint(value);
}

/**
 * Decode HTML entities. Applied to text before it becomes a text node, and to URLs
 * *before* they are validated: `java&#115;cript:` must not slip past a scheme check.
 */
function decodeEntities(input: string): string {
  return input.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const digits = hex ? body.slice(2) : body.slice(1);
      return fromCodePoint(parseInt(digits, hex ? 16 : 10), whole);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Browsers ignore control characters inside a URL, so a scheme check must too. */
function stripControlChars(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0) as number;
    if (code > 0x1f && code !== 0x7f) out += char;
  }
  return out;
}

/** Resolve a user-supplied URL and keep it only if `accept` allows the scheme. */
function safeUrl(raw: string, accept: (url: URL) => boolean): string | null {
  const cleaned = stripControlChars(decodeEntities(raw)).trim();
  if (!cleaned) return null;
  let url: URL;
  try {
    url = new URL(cleaned, document.baseURI);
  } catch {
    return null;
  }
  return accept(url) ? url.href : null;
}

/** An `href` a note is allowed to link to, or null. */
export function safeLinkUrl(raw: string): string | null {
  return safeUrl(raw, (url) => LINK_PROTOCOLS.has(url.protocol));
}

/**
 * An avatar URL we are willing to put in `<img src>`, or null.
 * `data:` is limited to image types; SVG cannot run script when loaded via <img>.
 */
export function safeImageUrl(raw: string): string | null {
  return safeUrl(raw, (url) => {
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
    return url.protocol === 'data:' && AVATAR_DATA_TYPES.test(url.pathname);
  });
}

function hrefFromAttributes(attributes: string): string | null {
  const match = HREF_RE.exec(attributes);
  if (!match) return null;
  return safeLinkUrl(match[1] ?? match[2] ?? match[3] ?? '');
}

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'break' }
  | { kind: 'open'; tag: string; href: string | null }
  | { kind: 'close'; tag: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];

  const pushText = (raw: string, decode: boolean): void => {
    if (!raw) return;
    const value = decode ? decodeEntities(raw) : raw;
    value.split('\n').forEach((line, index) => {
      if (index > 0) tokens.push({ kind: 'break' });
      if (line) tokens.push({ kind: 'text', value: line });
    });
  };

  let cursor = 0;
  TAG_RE.lastIndex = 0;
  for (let match = TAG_RE.exec(source); match; match = TAG_RE.exec(source)) {
    pushText(source.slice(cursor, match.index), true);
    cursor = match.index + match[0].length;

    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (tag === 'br') {
      if (!closing) tokens.push({ kind: 'break' });
    } else if (INLINE_TAGS.has(tag)) {
      tokens.push(closing ? { kind: 'close', tag } : { kind: 'open', tag, href: null });
    } else if (tag === 'a') {
      if (closing) tokens.push({ kind: 'close', tag });
      else tokens.push({ kind: 'open', tag, href: hrefFromAttributes(match[3]) });
    } else {
      // Not an allowed tag -- show what the user typed, as text.
      pushText(match[0], false);
    }
  }
  pushText(source.slice(cursor), true);
  return tokens;
}

function normalize(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

/** Render note source as DOM nodes, ready to append. */
export function renderRichText(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const open: { tag: string; node: Node }[] = [];
  const parent = (): Node => (open.length ? open[open.length - 1].node : fragment);

  const closeTag = (tag: string): void => {
    for (let i = open.length - 1; i >= 0; i -= 1) {
      if (open[i].tag === tag) {
        open.length = i;
        return;
      }
    }
    // No matching open tag: a stray close is dropped.
  };

  for (const token of tokenize(normalize(source))) {
    switch (token.kind) {
      case 'text':
        parent().appendChild(document.createTextNode(token.value));
        break;
      case 'break':
        parent().appendChild(document.createElement('br'));
        break;
      case 'close':
        closeTag(token.tag);
        break;
      case 'open': {
        if (token.tag === 'a') closeTag('a'); // links never nest
        if (open.length >= MAX_DEPTH) break;
        let element: HTMLElement;
        if (token.tag !== 'a') {
          element = document.createElement(token.tag);
        } else if (token.href) {
          const anchor = document.createElement('a');
          anchor.setAttribute('href', token.href);
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noopener noreferrer nofollow');
          element = anchor;
        } else {
          // A link we will not follow: keep the text, drop the anchor.
          element = document.createElement('span');
        }
        parent().appendChild(element);
        open.push({ tag: token.tag, node: element });
        break;
      }
    }
  }
  return fragment;
}

/** The visible text of note source, used for search matching. */
export function richTextToPlain(source: string): string {
  return tokenize(normalize(source))
    .map((token) => {
      if (token.kind === 'text') return token.value;
      return token.kind === 'break' ? ' ' : '';
    })
    .join('');
}
