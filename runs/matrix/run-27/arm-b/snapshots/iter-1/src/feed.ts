/** Builds the feed DOM. Every value here is either a text node or sanitized rich text. */
import { renderBody, renderTitle, safeAvatarUrl } from './richtext';
import type { Note } from './types';

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatTimestamp(iso: string): string {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? iso : TIME_FORMAT.format(at);
}

/** One `<article class="note">`; clicking its title selects it. */
function noteElement(note: Note, selected: boolean, onSelect: (id: number) => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset['noteId'] = String(note.id);
  if (selected) article.setAttribute('aria-current', 'true');

  const header = document.createElement('header');
  header.className = 'note-header';

  const avatar = safeAvatarUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatar;
    img.alt = '';
    img.loading = 'lazy';
    header.appendChild(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  renderTitle(titleButton, note.title);
  titleButton.addEventListener('click', () => {
    onSelect(note.id);
  });
  heading.appendChild(titleButton);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderBody(body, note.body);
  article.appendChild(body);

  const time = document.createElement('time');
  time.className = 'note-time';
  time.dateTime = note.createdAt;
  time.textContent = formatTimestamp(note.createdAt);
  article.appendChild(time);

  return article;
}

export interface FeedView {
  notes: readonly Note[];
  selected: number | null;
  /** Non-empty when a search is active; used only for the empty-state message. */
  query: string;
}

export function renderFeed(feed: HTMLElement, view: FeedView, onSelect: (id: number) => void): void {
  const children: Element[] = view.notes.map((note) => noteElement(note, note.id === view.selected, onSelect));
  if (children.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = view.query === '' ? 'No notes yet. Add the first one above.' : `No notes match "${view.query}".`;
    children.push(empty);
  }
  feed.replaceChildren(...children);
}

/** Selection is the only thing that changes without rebuilding the feed, so keyboard focus survives. */
export function markSelected(feed: HTMLElement, selected: number | null): void {
  for (const article of feed.querySelectorAll<HTMLElement>('article.note')) {
    const id = Number(article.dataset['noteId']);
    if (id === selected) article.setAttribute('aria-current', 'true');
    else article.removeAttribute('aria-current');
  }
}
