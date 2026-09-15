import { safeAvatarUrl } from './avatar';
import { renderRichText } from './richtext';
import type { Note } from './types';

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatWhen(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '' : WHEN.format(new Date(ms));
}

/** Newest note first; ids rise with time, so they settle ties and survive a skewed clock. */
export function byNewestFirst(a: Note, b: Note): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

/** Case-insensitive match on the note's title or body source, as the search box promises. */
export function matchesQuery(note: Note, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

function renderAvatar(note: Note): HTMLImageElement | null {
  const src = safeAvatarUrl(note.avatar);
  if (src === null) return null;
  const img = document.createElement('img');
  img.className = 'note-avatar';
  img.src = src;
  img.width = 40;
  img.height = 40;
  img.loading = 'lazy';
  // Decorative: the avatar repeats no information the note does not already carry.
  img.alt = '';
  return img;
}

function renderNote(note: Note, selected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  const header = document.createElement('header');
  header.className = 'note-header';

  const avatar = renderAvatar(note);
  if (avatar !== null) header.appendChild(avatar);

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  // A real <button> so the title is reachable and operable from the keyboard, not a click handler
  // bolted onto a <span>.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.textContent = note.title;
  title.addEventListener('click', () => {
    onSelect(note.id);
  });
  heading.appendChild(title);
  header.appendChild(heading);

  const when = document.createElement('time');
  when.className = 'note-when';
  when.dateTime = note.createdAt;
  when.textContent = formatWhen(note.createdAt);
  header.appendChild(when);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);

  article.append(header, body);
  return article;
}

/** Replaces the feed with the notes matching `query`, newest first. */
export function renderFeed(
  feed: Element,
  notes: readonly Note[],
  query: string,
  selectedId: number | null,
  onSelect: (id: number) => void,
): void {
  const visible = notes.filter((note) => matchesQuery(note, query)).sort(byNewestFirst);
  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent =
      query === '' ? 'No notes yet — add the first one above.' : 'No notes match that search.';
    feed.replaceChildren(empty);
    return;
  }
  feed.replaceChildren(...visible.map((note) => renderNote(note, note.id === selectedId, onSelect)));
}
