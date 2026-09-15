import { Note } from './types';

/**
 * Renders user text with supported rich-text inline tags safely into a DOM element.
 * Supported tags: <b>, <strong>, <i>, <em>, <a href="...">, <br>
 * Newlines are also converted to line breaks.
 */
export function renderRichText(container: HTMLElement, rawText: string): void {
  container.replaceChildren();
  if (!rawText) {
    return;
  }

  // Convert newlines to <br> tags
  const textWithBr = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${textWithBr}</body>`, 'text/html');

  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue ?? '');
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      // Dangerous elements: completely discard
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(tagName)) {
        return null;
      }

      // Allowed formatting tags: B, STRONG, I, EM, BR
      if (['B', 'STRONG', 'I', 'EM', 'BR'].includes(tagName)) {
        const cleanEl = document.createElement(tagName.toLowerCase());
        for (const child of Array.from(el.childNodes)) {
          const cleanChild = sanitizeNode(child);
          if (cleanChild) {
            cleanEl.appendChild(cleanChild);
          }
        }
        return cleanEl;
      }

      // Allowed link tag: A
      if (tagName === 'A') {
        const cleanA = document.createElement('a');
        const href = el.getAttribute('href') ?? '';
        const trimmedHref = href.trim();

        // Safe protocols: http, https, mailto, tel, or relative URLs
        const isSafeProtocol = /^(https?:\/\/|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(trimmedHref);
        if (isSafeProtocol) {
          cleanA.setAttribute('href', trimmedHref);
        } else {
          cleanA.setAttribute('href', '#');
        }

        for (const child of Array.from(el.childNodes)) {
          const cleanChild = sanitizeNode(child);
          if (cleanChild) {
            cleanA.appendChild(cleanChild);
          }
        }
        return cleanA;
      }

      // For any other element, preserve child content without the disallowed tag wrapper
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(el.childNodes)) {
        const cleanChild = sanitizeNode(child);
        if (cleanChild) {
          fragment.appendChild(cleanChild);
        }
      }
      return fragment;
    }

    return null;
  }

  for (const child of Array.from(doc.body.childNodes)) {
    const cleanChild = sanitizeNode(child);
    if (cleanChild) {
      container.appendChild(cleanChild);
    }
  }
}

/**
 * Strip HTML tags for clean plain-text search matching.
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/**
 * Normalizes text for case and accent-insensitive matching.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Checks if a note matches the search query.
 */
export function matchNote(note: Note, query: string): boolean {
  if (!query || !query.trim()) {
    return true;
  }

  const q = query.trim().toLowerCase();
  const qNorm = normalizeForSearch(query.trim());

  const titleRaw = note.title.toLowerCase();
  const titlePlain = stripHtmlTags(note.title).toLowerCase();
  const titleNorm = normalizeForSearch(note.title);

  const bodyRaw = note.body.toLowerCase();
  const bodyPlain = stripHtmlTags(note.body).toLowerCase();
  const bodyNorm = normalizeForSearch(note.body);

  return (
    titleRaw.includes(q) ||
    titlePlain.includes(q) ||
    titleNorm.includes(qNorm) ||
    bodyRaw.includes(q) ||
    bodyPlain.includes(q) ||
    bodyNorm.includes(qNorm)
  );
}
