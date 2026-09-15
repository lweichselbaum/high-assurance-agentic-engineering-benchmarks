/**
 * Safe rich-text sanitizer and renderer.
 * Supported tags: <b>, <strong>, <i>, <em>, <a href="...">, <br>.
 * Newlines (\n) are treated as line breaks.
 */

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return false;
  }
  return true;
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName.toUpperCase();

    if (tag === 'B' || tag === 'STRONG') {
      const result = document.createElement(tag.toLowerCase());
      for (const child of Array.from(el.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) {
          result.appendChild(sanitized);
        }
      }
      return result;
    }

    if (tag === 'I' || tag === 'EM') {
      const result = document.createElement(tag.toLowerCase());
      for (const child of Array.from(el.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) {
          result.appendChild(sanitized);
        }
      }
      return result;
    }

    if (tag === 'BR') {
      return document.createElement('br');
    }

    if (tag === 'A') {
      const result = document.createElement('a');
      const href = el.getAttribute('href');
      if (href && isSafeUrl(href)) {
        result.setAttribute('href', href.trim());
        const lower = href.trim().toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) {
          result.setAttribute('target', '_blank');
          result.setAttribute('rel', 'noopener noreferrer');
        }
      }
      for (const child of Array.from(el.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) {
          result.appendChild(sanitized);
        }
      }
      return result;
    }

    // For disallowed container elements, unpack children safely
    const frag = document.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      const sanitized = sanitizeNode(child);
      if (sanitized) {
        frag.appendChild(sanitized);
      }
    }
    return frag;
  }

  return null;
}

export function renderRichText(content: string, container: HTMLElement): void {
  container.innerHTML = '';
  if (!content) return;

  // Replace newline sequences with <br>
  const formatted = content
    .replace(/\r\n/g, '<br>')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(formatted, 'text/html');

  for (const child of Array.from(doc.body.childNodes)) {
    const sanitized = sanitizeNode(child);
    if (sanitized) {
      container.appendChild(sanitized);
    }
  }
}

export function noteMatchesSearch(
  title: string,
  body: string,
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // Check raw strings
  if (title.toLowerCase().includes(q) || body.toLowerCase().includes(q)) {
    return true;
  }

  // Check stripped strings (without HTML tags)
  const strippedTitle = title.replace(/<[^>]*>/g, '').toLowerCase();
  const strippedBody = body.replace(/<[^>]*>/g, '').toLowerCase();

  return strippedTitle.includes(q) || strippedBody.includes(q);
}
