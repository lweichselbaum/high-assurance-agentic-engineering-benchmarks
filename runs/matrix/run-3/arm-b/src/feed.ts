import { validateAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

export function matchesQuery(note: Note, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

function renderNoteArticle(note: Note, selectedId: number | null, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const avatarUrl = validateAvatarUrl(note.avatar);
  if (avatarUrl !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatarUrl;
    img.alt = '';
    article.appendChild(img);
  }

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.textContent = note.title;
  titleButton.addEventListener('click', () => onSelect(note.id));
  article.appendChild(titleButton);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}

export function renderFeed(
  feedEl: Element,
  notes: readonly Note[],
  query: string,
  selectedId: number | null,
  onSelect: (id: number) => void,
): void {
  while (feedEl.firstChild) feedEl.removeChild(feedEl.firstChild);
  for (const note of notes) {
    if (!matchesQuery(note, query)) continue;
    feedEl.appendChild(renderNoteArticle(note, selectedId, onSelect));
  }
}

export function renderResultsLine(el: Element, query: string): void {
  el.textContent = query === '' ? '' : `results for "${query}"`;
}
