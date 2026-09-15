// Rich-text rendering for note titles and bodies.
//
// Notes are authored as plain text in which a small, fixed set of inline tags is
// meaningful: <b>, <strong>, <i>, <em>, <a href="…"> and <br>. A newline is also a
// line break.
//
// The renderer never builds an HTML string and never touches innerHTML: it tokenises
// the source itself and constructs DOM nodes with createElement/createTextNode. Any
// markup that is not on the allow-list — <script>, <img onerror=…>, stray attributes —
// ends up in a text node and is therefore displayed literally, never parsed. This is
// the only place note content becomes DOM, so it is the only place that has to be
// careful.

/** Inline tags that map straight onto an element of the same name. */
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em']);

/** Guards against pathologically nested input (`<b>` repeated ten thousand times). */
const MAX_DEPTH = 32;

/**
 * Matches anything that *looks* like a tag: `<`, an optional `/`, a name, an
 * attribute run, `>`. The attribute run understands quoting so that a `>` inside a
 * quoted value does not end the tag early; the three alternatives start with
 * distinct characters, so the group cannot backtrack exponentially.
 */
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/** Pulls the value of the first `href` attribute out of a tag's attribute run. */
const HREF_RE = /(?:^|[\s/])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

export interface RenderOptions {
  /**
   * Whether `<a>` becomes a real link. Titles render inside a button — a link nested
   * in a button is neither valid nor operable — so titles keep the link text and drop
   * the anchor.
   */
  links?: boolean;
}

/**
 * Returns a URL that is safe to put in an `href`, or `null` if it is not.
 *
 * Only http(s) and mailto are allowed as absolute URLs; everything relative is fine.
 * Anything else carrying an explicit scheme — `javascript:`, `data:`, `vbscript:` — is
 * rejected. Control characters are stripped first, because browsers ignore them when
 * resolving a URL and `java\nscript:` would otherwise slip past the scheme test.
 */
export function safeLinkUrl(raw: string): string | null {
  const url = stripControlChars(raw).trim();
  if (url === '') return null;
  if (/^(?:https?|mailto):/i.test(url)) return url;
  // A scheme-looking prefix that is not on the allow-list: refuse it outright.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return null;
  // No scheme at all — a path, query or fragment. Resolves against this origin.
  return url;
}

/**
 * Returns a URL that is safe to put in an `<img src>`, or `null` if it is not.
 * Same rules as links, except that inline `data:image/…` avatars are allowed (the
 * seed data uses them) and `mailto:` is not.
 */
export function safeImageUrl(raw: string): string | null {
  const url = stripControlChars(raw).trim();
  if (url === '') return null;
  if (/^https?:/i.test(url)) return url;
  // An image data URL renders as an image; scripts inside an SVG loaded through <img>
  // do not run. Anything that is not an image media type is refused.
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i.test(url)) return url;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return null;
  return url;
}

/** Renders note source into a fragment of allow-listed elements and text nodes. */
export function renderRichText(source: string, options: RenderOptions = {}): DocumentFragment {
  const allowLinks = options.links !== false;
  const text = normalise(source);
  const fragment = document.createDocumentFragment();

  // Stack of currently open elements; the root is the fragment itself.
  const open: Array<{ tag: string; node: Node }> = [{ tag: '', node: fragment }];
  const top = () => open[open.length - 1].node;
  const inLink = () => open.some((entry) => entry.tag === 'a');

  let cursor = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(text)) !== null) {
    appendText(top(), text.slice(cursor, match.index));
    cursor = TAG_RE.lastIndex;

    const [raw, slash, rawName, attrs] = match;
    const closing = slash === '/';
    const name = rawName.toLowerCase();

    if (name === 'br') {
      if (!closing) top().appendChild(document.createElement('br'));
      continue;
    }

    if (name === 'a') {
      if (!allowLinks) {
        // Keep the link's text, drop the anchor: push a span so </a> still balances.
        if (closing) closeTag('a');
        else openTag('a', document.createElement('span'));
        continue;
      }
      if (closing) {
        closeTag('a');
      } else {
        const href = attrs.match(HREF_RE);
        const url = href ? safeLinkUrl(href[1] ?? href[2] ?? href[3] ?? '') : null;
        // A link with no usable href, or a link inside a link, renders as plain text.
        openTag('a', url === null || inLink() ? document.createElement('span') : makeLink(url));
      }
      continue;
    }

    if (INLINE_TAGS.has(name)) {
      if (closing) closeTag(name);
      else openTag(name, document.createElement(name));
      continue;
    }

    // Not markup we understand — show it as the literal text the author typed.
    appendText(top(), raw);
  }

  appendText(top(), text.slice(cursor));
  return fragment;

  function openTag(tag: string, element: HTMLElement): void {
    if (open.length > MAX_DEPTH) {
      // Too deep to be meaningful; keep the content, drop the nesting.
      return;
    }
    top().appendChild(element);
    open.push({ tag, node: element });
  }

  function closeTag(tag: string): void {
    for (let i = open.length - 1; i > 0; i--) {
      if (open[i].tag === tag) {
        open.length = i;
        return;
      }
    }
    // A close tag with no matching open tag: ignore it.
  }
}

/** The rendered text of note source, with markup removed. Used for search matching. */
export function plainText(source: string): string {
  const text = normalise(source);
  let out = '';
  let cursor = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(text)) !== null) {
    out += text.slice(cursor, match.index);
    cursor = TAG_RE.lastIndex;
    const name = match[2].toLowerCase();
    if (name === 'br') out += '\n';
    else if (name !== 'a' && !INLINE_TAGS.has(name)) out += match[0];
  }

  return out + text.slice(cursor);
}

function makeLink(url: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', url);
  // Author-supplied links are untrusted third-party content.
  anchor.setAttribute('rel', 'nofollow noopener noreferrer ugc');
  return anchor;
}

/** Appends text, turning newlines into line breaks. */
function appendText(parent: Node, text: string): void {
  if (text === '') return;
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) parent.appendChild(document.createElement('br'));
    if (line !== '') parent.appendChild(document.createTextNode(line));
  });
}

function normalise(source: unknown): string {
  return typeof source === 'string' ? source.replace(/\r\n?/g, '\n') : '';
}

/**
 * Removes the C0 controls and DEL. Browsers drop these when resolving a URL, so
 * leaving them in would let `java<TAB>script:alert(1)` read as a harmless relative URL
 * here and as script there.
 */
function stripControlChars(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/[\u0000-\u001F\u007F]/g, "") : "";
}
