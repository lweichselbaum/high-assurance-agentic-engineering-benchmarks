/**
 * Minimal allow-list rich text.
 *
 * A note body is plain text that may carry a handful of inline tags:
 * `<b> <strong> <i> <em> <a href="…"> <br>`, plus real newlines.
 *
 * The source string is never handed to `innerHTML`. It is tokenised here and
 * turned into real DOM nodes, so anything outside the allow-list can only ever
 * become literal text — a `<script>` in a note shows up as the characters
 * `<script>`, not as a script.
 */

/** Inline tags that may wrap content. */
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'a']);
/** Tags with no content of their own. */
const VOID_TAGS = new Set(['br']);
/** Guard against pathologically nested input. */
const MAX_DEPTH = 32;

/** A tag: name plus an attribute chunk where quoted values may contain `>`. */
const TAG = /<\s*(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
const HREF = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;
const NEWLINE = /\r\n|\r|\n/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Resolve HTML character references in a text run. Safe to do late: the result
 * only ever becomes a text node or an attribute value set with `setAttribute`,
 * never markup, so decoding cannot re-introduce a tag.
 */
export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, ref: string) => {
    if (ref.charCodeAt(0) === 35 /* # */) {
      const hex = ref[1] === 'x' || ref[1] === 'X';
      const code = parseInt(hex ? ref.slice(2) : ref.slice(1), hex ? 16 : 10);
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

export interface RichTextOptions {
  /**
   * Render `<a>` as a link. When false (note titles, which live inside the
   * select button) the link text is kept but no anchor element is created.
   */
  allowLinks?: boolean;
  /** Validates and normalises an href; return null to drop the link. */
  sanitizeHref?: (raw: string) => string | null;
}

/** Append a text run, turning newlines into `<br>`. */
function appendText(parent: Node, text: string): void {
  if (!text) return;
  const lines = text.split(NEWLINE);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parent.appendChild(document.createElement('br'));
    if (lines[i]) parent.appendChild(document.createTextNode(decodeEntities(lines[i])));
  }
}

function hrefOf(attrs: string): string | null {
  const m = HREF.exec(attrs);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? '');
}

/** Render `source` into a fragment of safe DOM nodes. */
export function renderRichText(source: string, options: RichTextOptions = {}): DocumentFragment {
  const allowLinks = options.allowLinks !== false;
  const sanitizeHref = options.sanitizeHref;
  const fragment = document.createDocumentFragment();

  // Parallel stacks: the open element at each depth and its tag name.
  const nodes: Node[] = [fragment];
  const names: string[] = [''];
  const top = (): Node => nodes[nodes.length - 1];

  let cursor = 0;
  let match: RegExpExecArray | null;
  TAG.lastIndex = 0;

  while ((match = TAG.exec(source)) !== null) {
    appendText(top(), source.slice(cursor, match.index));
    cursor = TAG.lastIndex;

    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    const attrs = match[3] ?? '';

    // Not one of ours: show the tag as the literal text the author typed.
    if (!INLINE_TAGS.has(name) && !VOID_TAGS.has(name)) {
      appendText(top(), match[0]);
      continue;
    }

    if (VOID_TAGS.has(name)) {
      if (!closing) top().appendChild(document.createElement('br'));
      continue;
    }

    if (closing) {
      // Close the nearest matching open tag; ignore a stray closer.
      for (let i = names.length - 1; i > 0; i--) {
        if (names[i] === name) {
          nodes.length = i;
          names.length = i;
          break;
        }
      }
      continue;
    }

    if (nodes.length > MAX_DEPTH) {
      appendText(top(), match[0]);
      continue;
    }

    let element: HTMLElement;
    if (name === 'a') {
      const raw = hrefOf(attrs);
      const href = raw !== null && sanitizeHref ? sanitizeHref(raw) : raw;
      if (allowLinks && href) {
        const anchor = document.createElement('a');
        anchor.setAttribute('href', href);
        anchor.setAttribute('rel', 'noopener noreferrer nofollow');
        element = anchor;
      } else {
        // Keep the words, drop the (missing or rejected) link.
        element = document.createElement('span');
      }
    } else {
      element = document.createElement(name);
    }

    top().appendChild(element);
    nodes.push(element);
    names.push(name);
  }

  appendText(top(), source.slice(cursor));
  return fragment;
}

/** The same source as plain text — what search matches against. */
export function richTextToPlainText(source: string): string {
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  TAG.lastIndex = 0;

  while ((match = TAG.exec(source)) !== null) {
    out += decodeEntities(source.slice(cursor, match.index));
    cursor = TAG.lastIndex;
    const name = match[2].toLowerCase();
    if (VOID_TAGS.has(name)) out += '\n';
    else if (!INLINE_TAGS.has(name)) out += decodeEntities(match[0]);
  }

  return out + decodeEntities(source.slice(cursor));
}
