import './style.css';
import { plainText, renderRichText, safeImageUrl } from './richtext';
import { loadNotes, nextId, saveNotes, STORAGE_KEY } from './store';
import type { Note } from './types';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

/** A whitespace-only search box is not a query. */
const isActiveQuery = (value: string) => value.trim().length > 0;

// ---------------------------------------------------------------- fragment

/** Read `#q=…&note=…` into state. Returns whether anything changed. */
function readFragment(): boolean {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const nextQuery = params.get('q') ?? '';
  const rawNote = params.get('note');
  const nextSelected = rawNote !== null && /^-?\d+$/.test(rawNote.trim()) ? Number(rawNote.trim()) : null;

  const changed = nextQuery !== query || nextSelected !== selectedId;
  query = nextQuery;
  selectedId = nextSelected;
  return changed;
}

function fragmentForState(): string {
  const parts: string[] = [];
  if (isActiveQuery(query)) parts.push(`q=${encodeURIComponent(query)}`);
  if (selectedId !== null) parts.push(`note=${selectedId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/**
 * Keep the URL in step with the board. Selecting a note is a navigation step worth going
 * back to; typing in the search box is not, so it only rewrites the current entry.
 */
function writeFragment(push: boolean): void {
  const fragment = fragmentForState();
  if (fragment === location.hash || (!fragment && !location.hash)) return;
  const url = `${location.pathname}${location.search}${fragment}`;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

// ---------------------------------------------------------------- rendering

function matches(note: Note, needle: string): boolean {
  return plainText(note.title).includes(needle) || plainText(note.body).includes(needle);
}

function visibleNotes(): Note[] {
  const needle = query.trim().toLowerCase();
  const found = needle ? notes.filter((note) => matches(note, needle)) : notes.slice();
  // Newest first; ids break ties for notes sharing a timestamp.
  return found.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
}

function noteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = note.avatar ? safeImageUrl(note.avatar) : null;
  if (avatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatar;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    header.appendChild(img);
  }

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.tabIndex = 0;
  title.setAttribute('role', 'button');
  title.setAttribute('aria-pressed', note.id === selectedId ? 'true' : 'false');
  title.appendChild(renderRichText(note.title));
  header.appendChild(title);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const time = document.createElement('time');
  time.className = 'note-time';
  const parsed = Date.parse(note.createdAt);
  if (Number.isFinite(parsed)) {
    time.dateTime = new Date(parsed).toISOString();
    time.textContent = new Date(parsed).toLocaleString();
  }
  article.appendChild(time);

  return article;
}

function render(): void {
  const shown = visibleNotes();

  feed.replaceChildren(...shown.map(noteElement));
  if (shown.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = isActiveQuery(query) ? 'No notes match your search.' : 'No notes yet — add the first one.';
    feed.appendChild(empty);
  }

  resultsLine.textContent = isActiveQuery(query) ? `results for "${query}"` : '';
  if (searchInput.value !== query) searchInput.value = query;
}

// ---------------------------------------------------------------- events

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title && !body) return;

  const note: Note = {
    id: nextId(notes),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = [note, ...notes];
  saveNotes(notes);

  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeFragment(false);
  render();
});

function select(id: number): void {
  if (selectedId === id) return;
  selectedId = id;
  writeFragment(true);
  render();
}

function titleFromEvent(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  // A link inside a title stays a link.
  if (target.closest('a')) return null;
  return target.closest<HTMLElement>('.note-title');
}

feed.addEventListener('click', (event) => {
  const title = titleFromEvent(event.target);
  const id = Number(title?.closest<HTMLElement>('article.note')?.dataset.noteId);
  if (Number.isInteger(id)) select(id);
});

feed.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const title = titleFromEvent(event.target);
  const id = Number(title?.closest<HTMLElement>('article.note')?.dataset.noteId);
  if (!Number.isInteger(id)) return;
  event.preventDefault();
  select(id);
});

// Back/forward, and hand-edited fragments, drive the board too.
const syncFromFragment = () => {
  if (readFragment()) render();
};
addEventListener('popstate', syncFromFragment);
addEventListener('hashchange', syncFromFragment);

// Another tab writing notes should not leave this one stale.
addEventListener('storage', (event) => {
  if (event.key === null || event.key === STORAGE_KEY) {
    notes = loadNotes();
    render();
  }
});

readFragment();
render();
