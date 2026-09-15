/**
 * Rich text: the body (and title) are typed as text and may contain the inline tags
 * `<b> <strong> <i> <em> <a href="…">` and `<br>`; a newline is also a line break.
 *
 * The markup is turned into real DOM nodes here — every character of user text lands in a
 * text node, and the only elements that can ever be created are the five inline tags plus
 * `<br>`, each built with a literal `document.createElement` call. No HTML string ever
 * reaches a DOM sink, so nothing in a note can become a script, an image, or an attribute.
 * Anything that is not one of the supported tags is dropped and its text is kept, which is
 * what the sanitizer at the trusted boundary would do with it.
 */
import { setAnchorHref } from 'safevalues/dom';

type InlineTag = 'b' | 'strong' | 'i' | 'em' | 'a';

/** `<tag …>` / `</tag>`, with quoted attribute values allowed to contain `>`. */
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const HREF_RE = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;
const ENTITY_RE = /&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;
const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

/** Enough of the named entities to render what people actually type. */
const NAMED_ENTITIES = new Map<string, string>([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['hellip', '…'],
  ['mdash', '—'],
  ['ndash', '–'],
  ['copy', '©'],
  ['eacute', 'é'],
  ['ccedil', 'ç'],
  ['atilde', 'ã'],
  ['otilde', 'õ'],
]);

/** Deeply nested markup is user input too: stop building elements past this depth. */
const MAX_DEPTH = 32;

function asInlineTag(name: string): InlineTag | null {
  switch (name) {
    case 'b':
    case 'strong':
    case 'i':
    case 'em':
    case 'a':
      return name;
    default:
      return null;
  }
}

/** Literal tag names only — the element kinds this module can create are fixed at compile time. */
function createInline(tag: InlineTag): HTMLElement {
  switch (tag) {
    case 'b':
      return document.createElement('b');
    case 'strong':
      return document.createElement('strong');
    case 'i':
      return document.createElement('i');
    case 'em':
      return document.createElement('em');
    case 'a':
      return document.createElement('a');
  }
}

function decodeCharRef(ref: string): string | null {
  const hex = ref[1] === 'x' || ref[1] === 'X';
  const code = Number.parseInt(hex ? ref.slice(2) : ref.slice(1), hex ? 16 : 10);
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return null;
  if (code >= 0xd800 && code <= 0xdfff) return null;
  try {
    return String.fromCodePoint(code);
  } catch {
    return null;
  }
}

/** Entity references are decoded only after tags have been split off, so `&lt;b&gt;` stays text. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(ENTITY_RE, (match: string, ref: string): string => {
    if (ref.startsWith('#')) return decodeCharRef(ref) ?? match;
    return NAMED_ENTITIES.get(ref.toLowerCase()) ?? match;
  });
}

/** Appends `text` to `parent`, turning newlines into `<br>` the way `<br>` itself is. */
function appendText(parent: Node, text: string): void {
  const lines = decodeEntities(text).replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parent.appendChild(document.createElement('br'));
    const line = lines[i] ?? '';
    if (line !== '') parent.appendChild(document.createTextNode(line));
  }
}

/** Reads `href` off the raw attribute text and hands it to safevalues, which drops `javascript:`. */
function applyHref(anchor: HTMLAnchorElement, attributes: string): void {
  const match = HREF_RE.exec(attributes);
  if (match === null) return;
  const raw = match[1] ?? match[2] ?? match[3] ?? '';
  const url = decodeEntities(raw).trim();
  if (url === '') return;
  setAnchorHref(anchor, url);
  if (ABSOLUTE_HTTP_RE.test(url)) anchor.rel = 'noopener noreferrer';
}

/**
 * Parses the supported inline markup into a fragment of text nodes and inline elements.
 * Unsupported tags are skipped; their content is still rendered as text.
 */
export function renderRichText(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const open: { tag: InlineTag; node: HTMLElement }[] = [];
  const parent = (): Node => open.at(-1)?.node ?? fragment;

  const text = source.replace(COMMENT_RE, '');
  let cursor = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(text)) !== null) {
    if (match.index > cursor) appendText(parent(), text.slice(cursor, match.index));
    cursor = TAG_RE.lastIndex;

    const closing = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const attributes = match[3] ?? '';

    if (name === 'br') {
      if (!closing) parent().appendChild(document.createElement('br'));
      continue;
    }

    const tag = asInlineTag(name);
    if (tag === null) continue;

    if (closing) {
      // Close the innermost element with this tag, discarding anything still open inside it.
      for (let i = open.length - 1; i >= 0; i--) {
        if (open[i]?.tag === tag) {
          open.length = i;
          break;
        }
      }
      continue;
    }

    const element = createInline(tag);
    if (tag === 'a') applyHref(element as HTMLAnchorElement, attributes);
    parent().appendChild(element);
    // `<b/>` closes itself; so does anything we refuse to nest any deeper.
    if (!attributes.trimEnd().endsWith('/') && open.length < MAX_DEPTH) open.push({ tag, node: element });
  }

  if (cursor < text.length) appendText(parent(), text.slice(cursor));
  return fragment;
}

/** The text a reader sees, used for search so a query may span formatting tags. */
export function richTextToPlainText(source: string): string {
  const stripped = source
    .replace(COMMENT_RE, '')
    .replace(TAG_RE, (_match: string, _closing: string, name: string): string => (name.toLowerCase() === 'br' ? '\n' : ''));
  return decodeEntities(stripped);
}
