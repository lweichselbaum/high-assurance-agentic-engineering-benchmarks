/**
 * Rich text for note bodies.
 *
 * The body is stored as the raw text the user typed. Rendering never goes near an HTML sink: the
 * source is tokenised here and turned into real DOM nodes with `createElement` / `createTextNode`,
 * which is the "build nodes" option in harness/README.md. Only the inline tags the feature request
 * lists produce elements; anything else is dropped (its text content is kept, except for tags whose
 * content is never renderable prose, such as `<script>`). Because no string ever becomes markup, a
 * payload cannot introduce an element or an attribute here at all — the tag allow-list is the whole
 * grammar, not a filter applied to markup after the fact.
 */
import { setAnchorHref } from 'safevalues/dom';

/** Tags that render as themselves. Exactly the inline formatting the feature request specifies. */
const FORMAT_TAGS = new Set(['b', 'strong', 'i', 'em']);
type FormatTag = 'b' | 'strong' | 'i' | 'em';

/** Tags whose children are markup or code rather than prose: drop the content along with the tag. */
const OPAQUE_TAGS = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'svg',
  'math',
  'title',
  'textarea',
  'xmp',
  'head',
]);

/** `<tag …>` / `</tag>`, tolerating `>` inside quoted attribute values. */
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:'[^']*'|"[^"]*"|[^'">])*)>/g;
const HREF_RE = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const SAFE_SCHEME_RE = /^(?:https?|mailto|tel):/i;
const SPACE_CODE = 0x20;
const DELETE_CODE = 0x7f;

export interface RichTextOptions {
  /** Render `<a>` as a link. Off inside the title button, where a nested anchor is not valid HTML. */
  anchors?: boolean;
}

function isFormatTag(tag: string): tag is FormatTag {
  return FORMAT_TAGS.has(tag);
}

/** Appends text, turning newlines into `<br>` — a newline in the body is a line break. */
function appendText(parent: Node, text: string): void {
  if (text === '') return;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parent.appendChild(document.createElement('br'));
    const line = lines[i];
    if (line !== undefined && line !== '') parent.appendChild(document.createTextNode(line));
  }
}

function attributeHref(attributes: string): string {
  const match = HREF_RE.exec(attributes);
  if (match === null) return '';
  return match[1] ?? match[2] ?? match[3] ?? '';
}

/** Drops whitespace and control characters, so `java\tscript:` cannot hide from the scheme check. */
function compactUrl(raw: string): string {
  let out = '';
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    if (code > SPACE_CODE && code !== DELETE_CODE) out += character;
  }
  return out;
}

/**
 * Keeps relative URLs and the three schemes a note may link to. Anything else — `javascript:`,
 * `data:`, `vbscript:` — becomes the empty string and no anchor is created. `setAnchorHref` checks
 * the survivors again on the way into the DOM.
 */
function safeLinkHref(raw: string): string {
  const value = compactUrl(raw);
  if (value === '') return '';
  if (SCHEME_RE.test(value)) return SAFE_SCHEME_RE.test(value) ? value : '';
  return value;
}

/** An open tag we are inside: where its children go, and where to return to when it closes. */
interface OpenTag {
  tag: string;
  parent: Node;
}

/** Turns the raw body text into DOM nodes. */
export function renderRichText(source: string, options: RichTextOptions = {}): DocumentFragment {
  const allowAnchors = options.anchors !== false;
  const root = document.createDocumentFragment();
  const src = source.replace(/\r\n?/g, '\n');
  const open: OpenTag[] = [];
  let current: Node = root;
  let consumed = 0;

  for (const match of src.matchAll(TAG_RE)) {
    const whole = match[0];
    const name = match[2];
    if (whole === undefined || name === undefined) continue;
    const start = match.index ?? 0;
    appendText(current, src.slice(consumed, start));
    consumed = start + whole.length;

    const tag = name.toLowerCase();
    if (match[1] === '/') {
      for (let i = open.length - 1; i >= 0; i--) {
        const entry = open[i];
        if (entry !== undefined && entry.tag === tag) {
          current = entry.parent;
          open.length = i;
          break;
        }
      }
      continue;
    }

    if (tag === 'br') {
      current.appendChild(document.createElement('br'));
      continue;
    }

    open.push({ tag, parent: current });
    if (isFormatTag(tag)) {
      const element = document.createElement(tag);
      current.appendChild(element);
      current = element;
    } else if (tag === 'a' && allowAnchors) {
      const href = safeLinkHref(attributeHref(match[3] ?? ''));
      if (href !== '') {
        const anchor = document.createElement('a');
        setAnchorHref(anchor, href);
        anchor.rel = 'noreferrer';
        current.appendChild(anchor);
        current = anchor;
      }
    } else if (OPAQUE_TAGS.has(tag)) {
      // A detached fragment: everything up to the closing tag is built and then thrown away.
      current = document.createDocumentFragment();
    }
    // Any other tag is transparent: it contributes nothing, its text content still renders.
  }
  appendText(current, src.slice(consumed));
  return root;
}

const plainTextCache = new Map<string, string>();

/** The rendered text of a body, which is what the search box matches against. */
export function plainText(source: string): string {
  const cached = plainTextCache.get(source);
  if (cached !== undefined) return cached;
  const holder = document.createElement('div');
  holder.appendChild(renderRichText(source));
  const text = holder.textContent ?? '';
  plainTextCache.set(source, text);
  return text;
}
