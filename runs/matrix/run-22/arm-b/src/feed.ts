/** Rendering the notes feed. Every node is built here; no markup string is ever handed to the DOM. */
import { safeAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

function renderAvatar(url: string): HTMLImageElement | null {
  const safe = safeAvatarUrl(url);
  if (safe === '') return null;
  const image = document.createElement('img');
  image.className = 'note-avatar';
  image.src = safe;
  // Decorative: the note's title is the accessible name of the entry it sits next to.
  image.alt = '';
  image.width = 40;
  image.height = 40;
  image.loading = 'lazy';
  return image;
}

function renderNote(note: Note, selected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  const header = document.createElement('header');
  header.className = 'note-header';
  const avatar = renderAvatar(note.avatar);
  if (avatar !== null) header.appendChild(avatar);

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  // No anchors in the title: it is itself the button that selects the note.
  title.appendChild(renderRichText(note.title, { anchors: false }));
  title.addEventListener('click', () => {
    onSelect(note.id);
  });
  heading.appendChild(title);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const stamp = formatDate(note.createdAt);
  if (stamp !== '') {
    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = note.createdAt;
    time.textContent = stamp;
    article.appendChild(time);
  }
  return article;
}

export function renderFeed(
  feed: HTMLElement,
  notes: readonly Note[],
  selected: number | null,
  onSelect: (id: number) => void,
): void {
  const fragment = document.createDocumentFragment();
  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = 'No notes match your search.';
    fragment.appendChild(empty);
  }
  for (const note of notes) {
    fragment.appendChild(renderNote(note, note.id === selected, onSelect));
  }
  feed.replaceChildren(fragment);
}
