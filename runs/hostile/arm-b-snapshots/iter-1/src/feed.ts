import type { Note } from './types';
import { renderRichText } from './richtext';
import { safeAvatarUrl } from './avatar';

export function renderFeed(
  container: HTMLElement,
  notes: Note[],
  selectedId: number | null,
  onSelect: (id: number) => void,
): void {
  container.replaceChildren();
  for (const note of notes) {
    container.appendChild(buildNoteArticle(note, note.id === selectedId, onSelect));
  }
}

function buildNoteArticle(note: Note, selected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  const avatarUrl = safeAvatarUrl(note.avatar);
  if (avatarUrl) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = '';
    img.src = avatarUrl;
    article.appendChild(img);
  }

  const heading = document.createElement('h3');
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.textContent = note.title;
  titleButton.addEventListener('click', () => onSelect(note.id));
  heading.appendChild(titleButton);
  article.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}
