import type { Note } from './types';
import { renderRichBody, isSafeAvatarUrl } from './richtext';

export function renderFeed(feed: HTMLElement, notes: Note[], selectedId: number | null, onSelectTitle: (id: number) => void): void {
  feed.replaceChildren();
  for (const note of notes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (note.id === selectedId) article.setAttribute('aria-current', 'true');

    if (note.avatar && isSafeAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.alt = '';
      img.src = note.avatar;
      article.appendChild(img);
    }

    const heading = document.createElement('h3');
    heading.className = 'note-heading';
    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-title';
    titleButton.textContent = note.title;
    titleButton.addEventListener('click', () => onSelectTitle(note.id));
    heading.appendChild(titleButton);
    article.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'note-body';
    renderRichBody(body, note.body);
    article.appendChild(body);

    feed.appendChild(article);
  }
}
