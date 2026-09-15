import type { Note } from './types';
import { renderRichText } from './richtext';
import { isSafeAvatarUrl } from './avatar';

export interface FeedOptions {
  onSelect: (id: number) => void;
}

function createNoteElement(note: Note, isSelected: boolean, options: FeedOptions): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (isSelected) article.setAttribute('aria-current', 'true');

  if (note.avatar && isSafeAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  renderRichText(titleButton, note.title);
  titleButton.addEventListener('click', () => options.onSelect(note.id));
  article.appendChild(titleButton);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}

export function renderFeed(feed: HTMLElement, notes: Note[], selectedId: number | null, options: FeedOptions): void {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  feed.replaceChildren(...sorted.map((note) => createNoteElement(note, note.id === selectedId, options)));
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((note) => note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q));
}
