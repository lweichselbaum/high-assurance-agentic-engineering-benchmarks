import type { Note } from './types';
import { renderRichText } from './richtext';
import { sanitizeAvatarUrl } from './avatar';

export interface NoteViewCallbacks {
  onSelect: (id: number) => void;
}

export function buildNoteArticle(note: Note, selectedId: number | null, callbacks: NoteViewCallbacks): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatarUrl = sanitizeAvatarUrl(note.avatar);
  if (avatarUrl !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatarUrl;
    img.alt = '';
    header.appendChild(img);
  }

  const heading = document.createElement('h2');
  heading.className = 'note-heading';
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  renderRichText(titleButton, note.title);
  titleButton.addEventListener('click', () => callbacks.onSelect(note.id));
  heading.appendChild(titleButton);
  header.appendChild(heading);

  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  const meta = document.createElement('p');
  meta.className = 'note-meta';
  const date = new Date(note.createdAt);
  meta.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  article.appendChild(meta);

  return article;
}
