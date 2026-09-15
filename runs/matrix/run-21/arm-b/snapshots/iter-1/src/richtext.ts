/**
 * Rich text rendering.
 *
 * The body is stored exactly as the user typed it and is only ever interpreted here. DOMPurify is
 * asked for a DocumentFragment rather than a string (`RETURN_DOM_FRAGMENT`), so no HTML string is
 * produced that could reach `innerHTML`: the caller gets nodes and appends them. Anything outside
 * the allowlist below — script tags, event handler attributes, `javascript:` hrefs — is dropped
 * before the nodes exist.
 */
import DOMPurify from 'dompurify';

/** The inline formatting the feature request asks for, plus the handful of harmless block tags. */
const ALLOWED_TAGS = [
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'br',
  'p',
  'span',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

function sanitizeToFragment(source: string): DocumentFragment {
  return DOMPurify.sanitize(source, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
}

/** A link that opens in a new tab must not hand the opener over with it. */
function hardenLinks(root: DocumentFragment): void {
  for (const anchor of root.querySelectorAll('a')) {
    if (anchor.hasAttribute('target')) anchor.setAttribute('rel', 'noopener noreferrer');
  }
}

/** A newline in the body is a line break, the same as an explicit `<br>`. */
function applyLineBreaks(root: DocumentFragment): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode() !== null) texts.push(walker.currentNode as Text);

  for (const text of texts) {
    if (!text.data.includes('\n')) continue;
    const replacement = document.createDocumentFragment();
    text.data.split('\n').forEach((line, index) => {
      if (index > 0) replacement.appendChild(document.createElement('br'));
      if (line !== '') replacement.appendChild(document.createTextNode(line));
    });
    text.replaceWith(replacement);
  }
}

/** Nodes for `source`, ready to append. Formatting is honoured, everything else is dropped. */
export function renderRichText(source: string): DocumentFragment {
  const fragment = sanitizeToFragment(source);
  hardenLinks(fragment);
  applyLineBreaks(fragment);
  return fragment;
}

/** The text a reader actually sees, used so search can match across formatting tags. */
export function plainText(source: string): string {
  const fragment = sanitizeToFragment(source);
  for (const br of fragment.querySelectorAll('br')) br.replaceWith(document.createTextNode(' '));
  return fragment.textContent ?? '';
}
