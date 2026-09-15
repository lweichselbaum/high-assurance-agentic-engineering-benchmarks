/** Building the note articles, and deciding which of them a search query matches. */
import { safeAvatarUrl } from './avatar';
import { renderRichText, richTextToPlain } from './richtext';
import type { Note } from './types';

/**
 * Case-insensitive match on title or body. Both the source the user typed and the text a reader
 * sees are searched, so `Café Santiago` matches even though the source has a `</b>` in the middle
 * of it, and a search for a literal `<b>` still finds the notes containing one.
 */
export function matchesQuery(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [note.title, note.body, richTextToPlain(note.title), richTextToPlain(note.body)].some((haystack) =>
    haystack.toLowerCase().includes(needle),
  );
}

function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderAvatar(note: Note): HTMLImageElement | null {
  const src = safeAvatarUrl(note.avatar);
  if (src === null) return null;
  const image = document.createElement('img');
  image.className = 'note-avatar';
  // Decorative: the avatar carries no information the note text does not already give.
  image.alt = '';
  image.loading = 'lazy';
  image.src = src;
  return image;
}

/** One `<article class="note" data-note-id="…">`. */
export function renderNote(note: Note, selected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));
  if (selected) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = renderAvatar(note);
  if (avatar !== null) header.appendChild(avatar);

  const title = document.createElement('h3');
  title.className = 'note-title';
  // The button makes the title reachable by keyboard; the click handler is delegated to the feed,
  // so a click anywhere on the heading — button or not — selects the note.
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-title-button';
  button.appendChild(renderRichText(note.title, { allowLinks: false }));
  title.appendChild(button);
  header.appendChild(title);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const formatted = formatDate(note.createdAt);
  if (formatted !== null) {
    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = note.createdAt;
    time.textContent = formatted;
    article.appendChild(time);
  }

  return article;
}
