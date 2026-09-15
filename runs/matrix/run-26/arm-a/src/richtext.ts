// Rich text for note titles and bodies.
//
// Users type plain text into inputs and format it with a small set of inline tags:
// <b> <strong> <i> <em> <a href="…"> <br>. A newline is also a line break.
//
// The text is parsed here into a token list and turned into real DOM nodes. Anything
// outside the allow-list — other tags, attributes, unsafe URL schemes — is kept as
// literal text, so an author can only ever produce the markup listed above.
// Nothing in this module builds an HTML string, so there is no innerHTML sink to slip past.

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'a', 'br'] as const;
type AllowedTag = (typeof ALLOWED_TAGS)[number];
const ALLOWED = new Set<string>(ALLOWED_TAGS);

/** Schemes a note author may link to. */
const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
/** Image data: URLs an avatar may use. SVG is inert inside <img>. */
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i;

/** Nesting cap, so deeply nested input cannot build a pathological tree. */
const MAX_DEPTH = 24;

/** A tag: name, then attributes where quoted values may contain ">". */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

export type Token =
  | { kind: 'text'; value: string }
  | { kind: 'break' }
  | { kind: 'open'; name: AllowedTag; href: string | null }
  | { kind: 'close' };

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// Named refs need their semicolon; numeric ones do not, matching what browsers accept.
const ENTITY = /&(?:#[xX]([0-9a-fA-F]+);?|#([0-9]+);?|([a-zA-Z][a-zA-Z0-9]*);)/g;

/**
 * Decode the character references a browser would decode while parsing.
 * Done by hand rather than via a throwaway element: routing untrusted text through
 * innerHTML to decode it is the classic way a sanitizer ends up sanitizing the
 * wrong string.
 */
export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(ENTITY, (raw, hex, dec, name) => {
    if (name !== undefined) return NAMED_ENTITIES[name.toLowerCase()] ?? raw;
    const code = Number.parseInt(hex ?? dec, hex !== undefined ? 16 : 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return raw;
    // Surrogate halves are not valid on their own.
    if (code >= 0xd800 && code <= 0xdfff) return raw;
    return String.fromCodePoint(code);
  });
}

function attrValue(attrs: string, wanted: string): string | null {
  ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR.exec(attrs)) !== null) {
    // A repeated attribute keeps its first value, as in HTML parsing.
    if (m[1].toLowerCase() === wanted) return m[2] ?? m[3] ?? m[4] ?? '';
  }
  return null;
}

/**
 * Resolve a link URL and keep it only if it lands on a safe scheme. Parsing with URL
 * rather than string-matching means tricks that hide the scheme — entities, embedded
 * tabs or newlines, leading whitespace — are normalised away before the check.
 */
export function safeLinkUrl(raw: string | null): string | null {
  if (raw === null) return null;
  const value = decodeEntities(raw).trim();
  if (!value) return null;
  try {
    const url = new URL(value, document.baseURI);
    return LINK_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Same idea for avatars: http(s) images, or an inline image data: URL. */
export function safeImageUrl(raw: string): string | null {
  const value = decodeEntities(raw).trim();
  if (!value) return null;
  if (IMAGE_DATA_URL.test(value)) return value;
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseRichText(source: string): Token[] {
  const tokens: Token[] = [];
  const open: string[] = [];

  const pushText = (raw: string) => {
    if (!raw) return;
    const lines = raw.split(/\r\n|[\r\n]/);
    lines.forEach((line, i) => {
      if (i > 0) tokens.push({ kind: 'break' });
      if (line) tokens.push({ kind: 'text', value: decodeEntities(line) });
    });
  };

  TAG.lastIndex = 0;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG.exec(source)) !== null) {
    pushText(source.slice(cursor, m.index));
    cursor = TAG.lastIndex;

    const [raw, closing, rawName, attrs] = m;
    const name = rawName.toLowerCase();
    if (!ALLOWED.has(name)) {
      // Not something an author may write: show it, do not run it.
      pushText(raw);
      continue;
    }

    if (closing) {
      const at = open.lastIndexOf(name);
      if (at === -1) continue; // stray close tag
      for (let i = open.length - 1; i >= at; i--) tokens.push({ kind: 'close' });
      open.length = at;
      continue;
    }

    if (name === 'br') {
      tokens.push({ kind: 'break' });
      continue;
    }

    const tag = name as AllowedTag;
    tokens.push({ kind: 'open', name: tag, href: tag === 'a' ? safeLinkUrl(attrValue(attrs, 'href')) : null });
    if (/\/\s*$/.test(attrs) || open.length >= MAX_DEPTH) tokens.push({ kind: 'close' });
    else open.push(tag);
  }
  pushText(source.slice(cursor));

  for (let i = open.length - 1; i >= 0; i--) tokens.push({ kind: 'close' });
  return tokens;
}

/** Build the formatted nodes for a note title or body. */
export function renderRichText(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const ancestors: Node[] = [];
  let parent: Node = fragment;

  for (const token of parseRichText(source)) {
    if (token.kind === 'text') {
      parent.appendChild(document.createTextNode(token.value));
    } else if (token.kind === 'break') {
      parent.appendChild(document.createElement('br'));
    } else if (token.kind === 'open') {
      const el = document.createElement(token.name);
      if (token.name === 'a') {
        // A link with an unusable href still shows its text, just without the link.
        if (token.href) el.setAttribute('href', token.href);
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
      parent.appendChild(el);
      ancestors.push(parent);
      parent = el;
    } else {
      parent = ancestors.pop() ?? fragment;
    }
  }
  return fragment;
}

const plainCache = new Map<string, string>();

/** The text a reader actually sees, used for search matching. */
export function plainText(source: string): string {
  const cached = plainCache.get(source);
  if (cached !== undefined) return cached;
  let out = '';
  for (const token of parseRichText(source)) {
    if (token.kind === 'text') out += token.value;
    else if (token.kind === 'break') out += ' ';
  }
  const result = out.toLowerCase();
  if (plainCache.size > 500) plainCache.clear();
  plainCache.set(source, result);
  return result;
}
