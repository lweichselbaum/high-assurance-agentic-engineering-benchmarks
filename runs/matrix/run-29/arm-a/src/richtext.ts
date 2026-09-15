// Rich text for note titles and bodies.
//
// The body is authored as plain text in a textarea, with a small set of inline
// tags: <b> <strong> <i> <em> <a href="…"> <br>. Anything else the user types —
// including other tags — is shown literally, so the note reads back the way it
// was written.
//
// The renderer builds real DOM nodes for the tags it recognises and text nodes
// for everything else; it never assigns innerHTML. That is what keeps a body
// like `<img src=x onerror=alert(1)>` inert: it is not in the allow-list, so it
// is a text node, and there is no HTML-parsing step for it to escape from.

import { safeLinkHref } from './url';

type InlineTag = 'b' | 'strong' | 'i' | 'em';

type Token =
  | { t: 'text'; value: string }
  | { t: 'br' }
  | { t: 'open'; tag: InlineTag }
  | { t: 'close'; tag: InlineTag | 'a' }
  | { t: 'link'; href: string | null };

// Sticky patterns, matched only at a '<'. Whitespace inside the tag is tolerated
// (`< b >`) because hand-typed markup often has it; attributes other than an <a>
// href are not, so `<b onclick=…>` never becomes an element.
const RE_BR = /<[ \t]*br[ \t]*\/?[ \t]*>/iy;
const RE_OPEN = /<[ \t]*(b|strong|i|em)[ \t]*>/iy;
const RE_CLOSE = /<[ \t]*\/[ \t]*(b|strong|i|em|a)[ \t]*>/iy;
const RE_LINK = /<[ \t]*a[ \t]+href[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>=]+))[ \t]*\/?[ \t]*>/iy;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let text = '';
  let i = 0;

  const flush = () => {
    if (text) {
      tokens.push({ t: 'text', value: text });
      text = '';
    }
  };

  while (i < source.length) {
    if (source[i] !== '<') {
      text += source[i];
      i += 1;
      continue;
    }

    RE_BR.lastIndex = i;
    if (RE_BR.test(source)) {
      flush();
      tokens.push({ t: 'br' });
      i = RE_BR.lastIndex;
      continue;
    }

    RE_OPEN.lastIndex = i;
    const open = RE_OPEN.exec(source);
    if (open) {
      flush();
      tokens.push({ t: 'open', tag: open[1].toLowerCase() as InlineTag });
      i = RE_OPEN.lastIndex;
      continue;
    }

    RE_CLOSE.lastIndex = i;
    const close = RE_CLOSE.exec(source);
    if (close) {
      flush();
      tokens.push({ t: 'close', tag: close[1].toLowerCase() as InlineTag | 'a' });
      i = RE_CLOSE.lastIndex;
      continue;
    }

    RE_LINK.lastIndex = i;
    const link = RE_LINK.exec(source);
    if (link) {
      flush();
      tokens.push({ t: 'link', href: safeLinkHref(link[1] ?? link[2] ?? link[3] ?? '') });
      i = RE_LINK.lastIndex;
      continue;
    }

    // Not a tag we know: a literal '<'.
    text += '<';
    i += 1;
  }

  flush();
  return tokens;
}

/** Appends text, turning newlines into <br> so a typed line break shows as one. */
function appendText(parent: Node, value: string): void {
  const lines = value.split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    if (index > 0) parent.appendChild(document.createElement('br'));
    if (line) parent.appendChild(document.createTextNode(line));
  });
}

/** Renders note markup into a fragment of vetted elements and text nodes. */
export function renderRichText(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const stack: Node[] = [fragment];
  const top = () => stack[stack.length - 1];

  for (const token of tokenize(source)) {
    switch (token.t) {
      case 'text':
        appendText(top(), token.value);
        break;
      case 'br':
        top().appendChild(document.createElement('br'));
        break;
      case 'open': {
        const el = document.createElement(token.tag);
        top().appendChild(el);
        stack.push(el);
        break;
      }
      case 'link': {
        const el = document.createElement('a');
        if (token.href !== null) {
          el.setAttribute('href', token.href);
          el.setAttribute('rel', 'noopener noreferrer nofollow');
        }
        top().appendChild(el);
        stack.push(el);
        break;
      }
      case 'close': {
        // Close the nearest matching open element; ignore a stray close tag.
        for (let depth = stack.length - 1; depth > 0; depth -= 1) {
          const node = stack[depth];
          if (node instanceof HTMLElement && node.localName === token.tag) {
            stack.length = depth;
            break;
          }
        }
        break;
      }
    }
  }

  return fragment;
}

/** The text a reader sees, with tags removed — what search matches against. */
export function plainText(source: string): string {
  let out = '';
  for (const token of tokenize(source)) {
    if (token.t === 'text') out += token.value;
    else if (token.t === 'br') out += ' ';
  }
  return out;
}
