export function isSafeLinkUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  if (/[\x00-\x1f\x7f-\x9f]/.test(trimmed)) {
    return false;
  }

  const normalized = trimmed.replace(/[\s\x00-\x1f]+/g, '');
  if (/^(?:javascript|vbscript|data):/i.test(normalized)) {
    return false;
  }

  const decoded = normalized
    .replace(/&#(\d+);?/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  if (/^(?:javascript|vbscript|data):/i.test(decoded)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  if (/[\x00-\x1f\x7f-\x9f]/.test(trimmed)) {
    return false;
  }

  const normalized = trimmed.replace(/[\s\x00-\x1f]+/g, '');
  if (/^(?:javascript|vbscript):/i.test(normalized)) {
    return false;
  }

  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

export function renderRichText(text: string, container: HTMLElement): void {
  container.replaceChildren();

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const TOKEN_RE = /<(\/)?([a-zA-Z0-9]+)([^>]*)>|\n/g;

  const stack: HTMLElement[] = [container];
  const tagStack: string[] = [];

  const current = () => stack[stack.length - 1];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(normalized)) !== null) {
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      const textChunk = normalized.slice(lastIndex, matchStart);
      current().appendChild(document.createTextNode(textChunk));
    }
    lastIndex = TOKEN_RE.lastIndex;

    // Handle line break via newline
    if (match[0] === '\n') {
      current().appendChild(document.createElement('br'));
      continue;
    }

    const isClosing = match[1] === '/';
    const rawTag = match[2].toLowerCase();
    const attrs = match[3] || '';

    if (rawTag === 'br') {
      current().appendChild(document.createElement('br'));
      continue;
    }

    if (rawTag === 'b' || rawTag === 'strong') {
      if (isClosing) {
        popMatchingTag(['b', 'strong']);
      } else {
        const el = document.createElement(rawTag === 'strong' ? 'strong' : 'b');
        current().appendChild(el);
        stack.push(el);
        tagStack.push(rawTag);
      }
      continue;
    }

    if (rawTag === 'i' || rawTag === 'em') {
      if (isClosing) {
        popMatchingTag(['i', 'em']);
      } else {
        const el = document.createElement(rawTag === 'em' ? 'em' : 'i');
        current().appendChild(el);
        stack.push(el);
        tagStack.push(rawTag);
      }
      continue;
    }

    if (rawTag === 'a') {
      if (isClosing) {
        popMatchingTag(['a']);
      } else {
        const href = extractHref(attrs);
        if (href && isSafeLinkUrl(href)) {
          const el = document.createElement('a');
          el.setAttribute('href', href);
          el.setAttribute('rel', 'noopener noreferrer');
          current().appendChild(el);
          stack.push(el);
          tagStack.push('a');
        } else {
          const el = document.createElement('span');
          current().appendChild(el);
          stack.push(el);
          tagStack.push('a');
        }
      }
      continue;
    }

    // Any other tag: not allowed! Render as literal text node
    current().appendChild(document.createTextNode(match[0]));
  }

  if (lastIndex < normalized.length) {
    const remaining = normalized.slice(lastIndex);
    current().appendChild(document.createTextNode(remaining));
  }

  function popMatchingTag(acceptedNames: string[]) {
    const idx = tagStack.findLastIndex((name) => acceptedNames.includes(name));
    if (idx !== -1) {
      while (tagStack.length > idx) {
        tagStack.pop();
        stack.pop();
      }
    } else {
      current().appendChild(document.createTextNode(match![0]));
    }
  }
}
