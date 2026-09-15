import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import type { Note } from './types';
import { sanitizeAvatarUrl } from './avatar';

export interface FeedCallbacks {
  onSelectNote: (id: number) => void;
}

function matchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const plainBody = note.body.replace(/<[^>]+>/g, ' ').toLowerCase();
  return note.title.toLowerCase().includes(needle) || plainBody.includes(needle);
}

export function visibleNotes(notes: Note[], query: string): Note[] {
  return [...notes].sort((a, b) => b.id - a.id).filter((note) => matchesQuery(note, query));
}

export function renderFeed(feed: HTMLElement, notes: Note[], selectedId: number | null, callbacks: FeedCallbacks): void {
  feed.textContent = '';

  for (const note of notes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (note.id === selectedId) article.setAttribute('aria-current', 'true');

    const avatarUrl = sanitizeAvatarUrl(note.avatar);
    if (avatarUrl) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.alt = '';
      img.src = avatarUrl;
      article.appendChild(img);
    }

    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-title';
    titleButton.textContent = note.title;
    titleButton.addEventListener('click', () => callbacks.onSelectNote(note.id));
    article.appendChild(titleButton);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    setElementInnerHtml(bodyEl, sanitizeHtml(note.body));
    article.appendChild(bodyEl);

    feed.appendChild(article);
  }
}
