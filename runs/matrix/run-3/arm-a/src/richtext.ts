// Sanitizing renderer for user-typed rich text. Users type <b>, <strong>, <i>, <em>,
// <a href="…"> and <br> (plus bare newlines) into a textarea; we parse that as HTML and
// rebuild only the whitelisted nodes so nothing else (scripts, event handler attributes,
// arbitrary tags) ever reaches the DOM.

const ALLOWED_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'BR']);
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'data:']);

function sanitizeUrl(raw: string, allowed: Set<string>): string | null {
  try {
    const url = new URL(raw, window.location.origin);
    if (allowed.has(url.protocol)) return raw;
  } catch {
    // malformed URL — drop it
  }
  return null;
}

export function sanitizeHref(raw: string): string | null {
  return sanitizeUrl(raw, ALLOWED_LINK_PROTOCOLS);
}

export function sanitizeAvatarUrl(raw: string): string | null {
  if (!raw) return null;
  return sanitizeUrl(raw, ALLOWED_IMAGE_PROTOCOLS);
}

function appendTextWithBreaks(target: Node, text: string): void {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) target.appendChild(document.createElement('br'));
    if (line) target.appendChild(document.createTextNode(line));
  });
}

function sanitizeInto(source: Node, target: Node): void {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      appendTextWithBreaks(target, child.textContent ?? '');
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as Element;
    const tag = el.tagName;

    if (tag === 'A') {
      const href = sanitizeHref(el.getAttribute('href') ?? '');
      const a = document.createElement('a');
      if (href) {
        a.setAttribute('href', href);
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('target', '_blank');
      }
      sanitizeInto(el, a);
      target.appendChild(a);
    } else if (ALLOWED_INLINE.has(tag)) {
      const clone = document.createElement(tag.toLowerCase());
      sanitizeInto(el, clone);
      target.appendChild(clone);
    } else {
      // Unknown/disallowed element: drop the tag but keep its sanitized content.
      sanitizeInto(el, target);
    }
  }
}

export function renderRichText(raw: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  const fragment = document.createDocumentFragment();
  sanitizeInto(parsed.body, fragment);
  return fragment;
}

export function toPlainText(raw: string): string {
  const parsed = new DOMParser().parseFromString(raw, 'text/html');
  return parsed.body.textContent ?? '';
}
