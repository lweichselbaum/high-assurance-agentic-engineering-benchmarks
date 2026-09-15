/** Building one `<article class="note">` out of a note. */
import { renderRichText } from './richtext';
import type { Note } from './types';

/**
 * Avatar URLs are an allowlist, anchored at the start of the trimmed string: a page URL, or an
 * inline image. `img.src` is not a script sink, but `javascript:`/`vbscript:` have no business
 * there either, and an SVG that arrives as a document rather than an image would be one.
 */
const AVATAR_URL_RE = /^(?:https?:\/\/|data:image\/|\.{0,2}\/(?!\/))/i;

export function safeAvatarUrl(raw: string): string | null {
  const url = raw.trim();
  return url !== '' && AVATAR_URL_RE.test(url) ? url : null;
}

function formatTimestamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderAvatar(note: Note): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'note-avatar';
  // Decorative: the note's own title is right next to it and names the note.
  img.alt = '';
  const url = safeAvatarUrl(note.avatar);
  if (url !== null) img.src = url;
  return img;
}

function renderTitle(note: Note): HTMLHeadingElement {
  const heading = document.createElement('h3');
  heading.className = 'note-title';
  heading.id = `note-title-${String(note.id)}`;

  // A real button, so the title is reachable and activatable from the keyboard too.
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-title-button';
  if (note.title.trim() === '') button.appendChild(document.createTextNode('Untitled note'));
  else button.appendChild(renderRichText(note.title));

  heading.appendChild(button);
  return heading;
}

export function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  article.setAttribute('aria-labelledby', `note-title-${String(note.id)}`);

  const header = document.createElement('div');
  header.className = 'note-header';
  if (note.avatar.trim() !== '') header.appendChild(renderAvatar(note));
  header.appendChild(renderTitle(note));
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const stamp = formatTimestamp(note.createdAt);
  if (stamp !== '') {
    const meta = document.createElement('p');
    meta.className = 'note-meta';
    const time = document.createElement('time');
    time.dateTime = note.createdAt;
    time.appendChild(document.createTextNode(stamp));
    meta.appendChild(time);
    article.appendChild(meta);
  }

  return article;
}
