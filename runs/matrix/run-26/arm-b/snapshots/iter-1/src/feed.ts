import { safeAvatarUrl } from './avatar';
import { setRichText } from './richtext';
import type { Note } from './types';

export type SelectHandler = (id: number) => void;

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Replaces the feed with `notes`, in the order given. */
export function renderFeed(
  feed: HTMLElement,
  notes: readonly Note[],
  selected: number | null,
  onSelect: SelectHandler,
): void {
  if (notes.length === 0) {
    feed.replaceChildren(emptyState());
  } else {
    feed.replaceChildren(...notes.map((note) => renderNote(note, onSelect)));
  }
  applySelection(feed, selected);
}

/**
 * Marks the selected note. Kept separate from `renderFeed` so that selecting a note does not
 * rebuild the feed under the user's focus.
 */
export function applySelection(feed: HTMLElement, selected: number | null): void {
  for (const article of feed.querySelectorAll<HTMLElement>('article.note')) {
    if (selected !== null && article.dataset['noteId'] === String(selected)) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  }
}

function renderNote(note: Note, onSelect: SelectHandler): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);

  const titleId = `note-title-${note.id}`;
  article.setAttribute('aria-labelledby', titleId);

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = safeAvatarUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatar;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    header.appendChild(img);
  }

  // The title is the control that selects the note, so it is a real button: keyboard reachable,
  // announced as a button, and it carries the accessible name of the article.
  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-title';
  button.id = titleId;
  button.textContent = note.title;
  button.addEventListener('click', () => {
    onSelect(note.id);
  });
  heading.appendChild(button);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  setRichText(body, note.body);
  article.appendChild(body);

  const meta = document.createElement('p');
  meta.className = 'note-meta';
  meta.appendChild(timestamp(note.createdAt));
  article.appendChild(meta);

  return article;
}

function timestamp(createdAt: string): HTMLTimeElement {
  const time = document.createElement('time');
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    time.textContent = createdAt;
    return time;
  }
  time.dateTime = createdAt;
  time.textContent = WHEN.format(parsed);
  return time;
}

function emptyState(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'feed-empty';
  p.textContent = 'No notes to show.';
  return p;
}
