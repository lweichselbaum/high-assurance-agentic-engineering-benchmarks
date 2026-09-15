/**
 * Safely parse and render allowed rich text tags into a target HTMLElement.
 * Allowed tags: <b>, <strong>, <i>, <em>, <a href="...">, <br>
 * Newlines (\n) in input are also converted to <br>.
 * All other tags and potentially malicious attributes/schemes are safely escaped as plain text.
 */

export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  // Relative links and anchors
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.com');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return true;
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.com');
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function renderRichText(input: string, container: HTMLElement): void {
  container.replaceChildren();
  if (!input) return;

  // Normalize line endings
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Regex matching opening/closing tags or newlines
  const TAG_REGEX = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|\n/g;

  interface StackEntry {
    tag: string;
    element: HTMLElement;
  }

  const stack: StackEntry[] = [{ tag: 'root', element: container }];
  const currentParent = () => stack[stack.length - 1].element;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    // Append any plain text before the match
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      currentParent().appendChild(document.createTextNode(plain));
    }
    lastIndex = TAG_REGEX.lastIndex;

    const fullMatch = match[0];

    // Handle newline
    if (fullMatch === '\n') {
      currentParent().appendChild(document.createElement('br'));
      continue;
    }

    const isClosing = match[1] === '/';
    const rawTag = match[2].toLowerCase();
    const attrsString = match[3] || '';

    // Check if tag is allowed
    const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'a', 'br'];
    if (!ALLOWED_TAGS.includes(rawTag)) {
      // Not allowed -> treat entire match as plain text
      currentParent().appendChild(document.createTextNode(fullMatch));
      continue;
    }

    // Handle <br>
    if (rawTag === 'br') {
      currentParent().appendChild(document.createElement('br'));
      continue;
    }

    if (!isClosing) {
      // Opening tag
      if (rawTag === 'a') {
        const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrsString);
        if (hrefMatch) {
          const rawHref = hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '';
          if (isSafeUrl(rawHref)) {
            const a = document.createElement('a');
            a.setAttribute('href', rawHref);
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
            currentParent().appendChild(a);
            stack.push({ tag: 'a', element: a });
          } else {
            // Unsafe href (e.g. javascript:), render as plain text
            currentParent().appendChild(document.createTextNode(fullMatch));
          }
        } else {
          // <a> with no href
          const a = document.createElement('a');
          currentParent().appendChild(a);
          stack.push({ tag: 'a', element: a });
        }
      } else {
        // b, strong, i, em
        const el = document.createElement(rawTag);
        currentParent().appendChild(el);
        stack.push({ tag: rawTag, element: el });
      }
    } else {
      // Closing tag
      let foundIndex = -1;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === rawTag) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) {
        // Pop down to and including foundIndex
        stack.splice(foundIndex);
      } else {
        // Stray closing tag: treat as plain text
        currentParent().appendChild(document.createTextNode(fullMatch));
      }
    }
  }

  // Append any trailing plain text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    currentParent().appendChild(document.createTextNode(remaining));
  }
}
