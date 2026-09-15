/**
 * The body/title mini-format: text plus the inline tags `<b>`, `<strong>`, `<i>`, `<em>`,
 * `<a href="…">` and `<br>`. A newline is also a line break.
 *
 * This renderer never produces an HTML *string*. It walks the source and builds DOM nodes with
 * `createElement` (always with a literal tag name) and `createTextNode`, so there is no sink for a
 * payload to reach: anything outside the allow-list above is not markup here, it is text, and is
 * inserted as a text node. That is why `<img src=x onerror=…>` in a note body renders as the
 * characters `<img src=x onerror=…>` rather than as an element.
 */
import { setAnchorHref } from 'safevalues/dom';

/** Matches an open or close tag. Deliberately loose: whatever it matches is checked against the allow-list. */
function tagPattern(): RegExp {
  return /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
}

const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i;
const NEWLINE_PATTERN = /\r\n|\r|\n/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(entity: string): string | null {
  const lower = entity.toLowerCase();
  if (lower.startsWith('#x')) {
    const code = Number.parseInt(entity.slice(2), 16);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
  }
  if (lower.startsWith('#')) {
    const code = Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
  }
  return NAMED_ENTITIES[lower] ?? null;
}

/**
 * Turns character references back into characters. Safe to do here because the result only ever
 * becomes a text node or goes through `setAnchorHref` — it is never re-parsed as markup.
 */
function decodeEntities(source: string): string {
  return source.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match: string, entity: string): string => {
    return decodeEntity(entity) ?? match;
  });
}

/** Appends a run of plain text, turning newlines into `<br>`. */
function appendText(parent: Node, source: string): void {
  if (source === '') return;
  const lines = decodeEntities(source).split(NEWLINE_PATTERN);
  lines.forEach((line, index) => {
    if (index > 0) parent.appendChild(document.createElement('br'));
    if (line !== '') parent.appendChild(document.createTextNode(line));
  });
}

/** Literal tag names only — there is no path here that creates an element from a variable. */
function createInline(name: string): HTMLElement | null {
  switch (name) {
    case 'b':
      return document.createElement('b');
    case 'strong':
      return document.createElement('strong');
    case 'i':
      return document.createElement('i');
    case 'em':
      return document.createElement('em');
    default:
      return null;
  }
}

function extractHref(attributes: string): string | null {
  const match = HREF_PATTERN.exec(attributes);
  if (match === null) return null;
  const value = match[1] ?? match[2] ?? match[3];
  if (value === undefined) return null;
  return decodeEntities(value).trim();
}

export interface RichTextOptions {
  /**
   * When false, `<a>` contributes its inline content but no anchor element. Used for note titles,
   * which sit inside the select button — an anchor inside a button is invalid nesting.
   */
  allowLinks?: boolean;
}

/** Renders the mini-format into a fragment of DOM nodes. */
export function renderRichText(source: string, options: RichTextOptions = {}): DocumentFragment {
  const allowLinks = options.allowLinks !== false;
  const fragment = document.createDocumentFragment();

  // `stack` holds the node new children go into; `openTags` names the tag each level was opened for.
  // stack[0] is the fragment, so openTags[i] describes stack[i + 1].
  const stack: Node[] = [fragment];
  const openTags: string[] = [];
  const top = (): Node => stack[stack.length - 1] ?? fragment;

  const pattern = tagPattern();
  let textFrom = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const raw = match[0];
    const isClosing = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const attributes = match[3] ?? '';

    const known = name === 'br' || name === 'a' || createInline(name) !== null;
    // Not one of ours: leave it in the surrounding text run, so it renders as literal characters.
    if (!known) continue;

    appendText(top(), source.slice(textFrom, match.index));
    textFrom = match.index + raw.length;

    if (name === 'br') {
      if (!isClosing) top().appendChild(document.createElement('br'));
      continue;
    }

    if (isClosing) {
      const level = openTags.lastIndexOf(name);
      // A stray close tag with nothing open for it is dropped.
      if (level >= 0) {
        stack.length = level + 1;
        openTags.length = level;
      }
      continue;
    }

    if (name === 'a') {
      if (!allowLinks) {
        // Transparent: children keep flowing into the current parent.
        stack.push(top());
        openTags.push(name);
        continue;
      }
      const anchor = document.createElement('a');
      const href = extractHref(attributes);
      // setAnchorHref neutralises javascript: URLs; a link with no href stays a plain <a>.
      if (href !== null) setAnchorHref(anchor, href);
      anchor.rel = 'noopener noreferrer';
      top().appendChild(anchor);
      stack.push(anchor);
      openTags.push(name);
      continue;
    }

    const element = createInline(name);
    if (element === null) continue;
    top().appendChild(element);
    stack.push(element);
    openTags.push(name);
  }

  appendText(top(), source.slice(textFrom));
  return fragment;
}

/** The text a reader actually sees, used for search matching. */
export function richTextToPlain(source: string): string {
  return decodeEntities(source.replace(tagPattern(), ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
