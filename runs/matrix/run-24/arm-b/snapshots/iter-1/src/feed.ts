import { safeAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

/** Newest first: by creation time, with the id sequence breaking ties. */
export function byNewestFirst(a: Note, b: Note): number {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (!Number.isNaN(at) && !Number.isNaN(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

function formatDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderNote(note: Note, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = safeAvatarUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = '';
    img.src = avatar;
    header.append(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';

  // The title itself is the control that selects the note: a real <button>, so it is
  // reachable and operable from the keyboard as well as the mouse.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  renderRichText(title, note.title);
  title.addEventListener('click', () => {
    onSelect(note.id);
  });
  heading.append(title);
  header.append(heading);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);

  article.append(header, body);

  const stamp = formatDate(note.createdAt);
  if (stamp !== '') {
    const time = document.createElement('time');
    time.className = 'note-date';
    time.setAttribute('datetime', note.createdAt);
    time.textContent = stamp;
    article.append(time);
  }

  return article;
}

/** Mark the selected note, leaving the rest of the feed (and the focused title) alone. */
export function applySelection(feed: HTMLElement, selectedId: number | null): void {
  for (const article of feed.querySelectorAll('article.note')) {
    const id = article.getAttribute('data-note-id');
    if (selectedId !== null && id !== null && Number(id) === selectedId) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  }
}

export function renderFeed(
  feed: HTMLElement,
  notes: readonly Note[],
  selectedId: number | null,
  onSelect: (id: number) => void,
): void {
  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = 'No notes match your search.';
    feed.replaceChildren(empty);
    return;
  }
  feed.replaceChildren(...notes.map((note) => renderNote(note, onSelect)));
  applySelection(feed, selectedId);
}
