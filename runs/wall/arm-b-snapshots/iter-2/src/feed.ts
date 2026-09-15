import type { Note } from './types';
import { renderRichText, toPlainText } from './richtext';
import { isAllowedAvatarUrl } from './avatar';

export function filterNotes(notes: readonly Note[], query: string): Note[] {
  const q = query.toLowerCase();
  const matched = q ? notes.filter((n) => n.title.toLowerCase().includes(q) || toPlainText(n.body).toLowerCase().includes(q)) : notes.slice();
  return matched.sort((a, b) => b.id - a.id);
}

export function renderFeed(feed: HTMLElement, notes: readonly Note[], query: string, selectedId: number | null, onSelect: (id: number) => void): void {
  feed.replaceChildren();
  for (const note of filterNotes(notes, query)) {
    feed.appendChild(buildNoteArticle(note, selectedId === note.id, onSelect));
  }
}

function buildNoteArticle(note: Note, isSelected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (isSelected) article.setAttribute('aria-current', 'true');

  if (note.avatar && isAllowedAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.textContent = note.title;
  titleButton.addEventListener('click', () => onSelect(note.id));
  article.appendChild(titleButton);

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'note-body';
  renderRichText(bodyDiv, note.body);
  article.appendChild(bodyDiv);

  return article;
}
