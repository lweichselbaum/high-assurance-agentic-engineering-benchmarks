/** The notes feed: ordering, filtering, and rendering one `<article class="note">` per note. */
import { safeAvatarUrl } from './avatar';
import { renderRichText, toPlainText } from './richtext';
import type { Note } from './types';

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function createdAtValue(note: Note): number {
  const time = Date.parse(note.createdAt);
  return Number.isNaN(time) ? 0 : time;
}

/** Newest first, falling back to the id sequence when timestamps tie or are missing. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => createdAtValue(b) - createdAtValue(a) || b.id - a.id);
}

/**
 * Case-insensitive match on title or body. Both the rich-text source and its rendered text are
 * searched, so "Douro" finds `<b>Douro</b>` and a query never has to step around the markup.
 */
export function matchesQuery(note: Note, needle: string): boolean {
  if (needle === '') return true;
  const haystack = [note.title, note.body, toPlainText(note.title), toPlainText(note.body)];
  return haystack.some((field) => field.toLowerCase().includes(needle));
}

export function filterNotes(notes: readonly Note[], needle: string): Note[] {
  return notes.filter((note) => matchesQuery(note, needle));
}

function renderTimestamp(note: Note): HTMLElement {
  const time = document.createElement('time');
  const parsed = new Date(note.createdAt);
  if (Number.isNaN(parsed.getTime())) {
    time.textContent = '';
  } else {
    time.dateTime = parsed.toISOString();
    time.textContent = TIMESTAMP_FORMAT.format(parsed);
  }
  return time;
}

function renderAvatar(note: Note): HTMLImageElement | null {
  const url = safeAvatarUrl(note.avatar);
  if (url === null) return null;
  const img = document.createElement('img');
  img.className = 'note-avatar';
  img.alt = 'Author avatar';
  img.width = 40;
  img.height = 40;
  img.loading = 'lazy';
  img.src = url;
  return img;
}

/** One note. The title is a button: clicking it selects the note and updates the fragment. */
function renderNote(note: Note, selected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  const header = document.createElement('header');
  header.className = 'note-header';

  const avatar = renderAvatar(note);
  if (avatar !== null) header.append(avatar);

  const heading = document.createElement('h2');
  heading.className = 'note-heading';
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

  const meta = document.createElement('p');
  meta.className = 'note-meta';
  meta.append(renderTimestamp(note));

  article.append(header, body, meta);
  return article;
}

/** Replaces the contents of `<section id="feed">` with the given notes, newest first. */
export function renderFeed(
  feed: HTMLElement,
  notes: readonly Note[],
  selectedId: number | null,
  onSelect: (id: number) => void,
): void {
  feed.replaceChildren();
  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = 'No notes match your search.';
    feed.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    fragment.append(renderNote(note, note.id === selectedId, onSelect));
  }
  feed.append(fragment);
}
