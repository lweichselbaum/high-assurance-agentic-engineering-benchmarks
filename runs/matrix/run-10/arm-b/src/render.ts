import type { Note } from './types';
import { renderRichText, safeAvatarUrl, toPlainText } from './richtext';

export function renderResultsLine(el: HTMLElement, query: string): void {
  el.textContent = query ? `results for "${query}"` : '';
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((note) => {
    const haystack = `${toPlainText(note.title)} ${toPlainText(note.body)}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.id - a.id);
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
    img.src = avatarUrl;
    img.alt = '';
    article.appendChild(img);
  }

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.tabIndex = 0;
  title.setAttribute('role', 'button');
  title.setAttribute('aria-pressed', selected ? 'true' : 'false');
  renderRichText(title, note.title);
  const select = (): void => onSelect(note.id);
  title.addEventListener('click', select);
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    }
  });
  article.appendChild(title);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}

export function renderFeed(feedEl: HTMLElement, notes: Note[], selectedId: number | null, onSelect: (id: number) => void): void {
  feedEl.replaceChildren();
  for (const note of notes) {
    feedEl.appendChild(buildNoteArticle(note, note.id === selectedId, onSelect));
  }
}
