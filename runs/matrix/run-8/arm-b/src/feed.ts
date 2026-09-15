// Porto Notes — renders the feed of notes.
import { isValidAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

export interface FeedCallbacks {
  onSelectNote(id: number): void;
}

export function renderFeed(
  feedEl: HTMLElement,
  notes: readonly Note[],
  selectedId: number | null,
  callbacks: FeedCallbacks,
): void {
  feedEl.replaceChildren();
  for (const note of notes) {
    feedEl.appendChild(renderNote(note, note.id === selectedId, callbacks));
  }
}

function renderNote(note: Note, selected: boolean, callbacks: FeedCallbacks): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  if (isValidAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.textContent = note.title;
  title.addEventListener('click', () => callbacks.onSelectNote(note.id));
  article.appendChild(title);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}
