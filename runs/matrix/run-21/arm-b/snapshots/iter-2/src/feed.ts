/** Building one `<article class="note">`. */
import { safeAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function createNoteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);

  const header = document.createElement('header');
  header.className = 'note-header';

  const avatar = safeAvatarUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    img.src = avatar;
    header.appendChild(img);
  }

  // The title is the selection control, so it has to be reachable and operable from the keyboard.
  const title = document.createElement('h2');
  title.className = 'note-title';
  title.tabIndex = 0;
  title.setAttribute('role', 'button');
  title.appendChild(renderRichText(note.title));
  header.appendChild(title);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const created = new Date(note.createdAt);
  if (!Number.isNaN(created.getTime())) {
    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = created.toISOString();
    time.textContent = DATE_FORMAT.format(created);
    article.appendChild(time);
  }

  return article;
}
