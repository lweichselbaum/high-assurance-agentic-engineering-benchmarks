import './style.css';
import { renderRichText, richTextToPlain, safeImageUrl } from './richtext';
import { loadNotes, nextId, saveNotes, sortNewestFirst } from './storage';
import type { Note } from './types';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

let notes: Note[] = sortNewestFirst(loadNotes());
saveNotes(notes); // persist the seed board on first load

let query = '';
let selectedId: number | null = null;

/* ---------------------------------------------------------------- fragment */

/** Read `#q=port&note=3`. */
function readFragment(): void {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  query = params.get('q') ?? '';
  const note = params.get('note');
  selectedId = note !== null && /^\d+$/.test(note) ? Number(note) : null;
}

/** Write the current query and selection back, without adding history entries. */
function writeFragment(): void {
  const parts: string[] = [];
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  if (selectedId !== null) parts.push(`note=${selectedId}`);
  const hash = parts.join('&');
  if (window.location.hash.replace(/^#/, '') === hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}${hash ? `#${hash}` : ''}`);
}

/* ----------------------------------------------------------------- search */

function matches(note: Note, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${richTextToPlain(note.title)} ${richTextToPlain(note.body)}`;
  return haystack.toLowerCase().includes(needle);
}

function visibleNotes(): Note[] {
  const needle = query.trim().toLowerCase();
  return notes.filter((note) => matches(note, needle));
}

/* ---------------------------------------------------------------- rendering */

function formatDate(iso: string): { label: string; machine: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { label: '', machine: '' };
  return {
    label: date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    machine: date.toISOString(),
  };
}

function renderNote(note: Note): HTMLElement {
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
    img.setAttribute('src', avatar);
    img.setAttribute('alt', '');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.setAttribute('width', '40');
    img.setAttribute('height', '40');
    header.appendChild(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';

  // The title is the control that selects the note, so it is a real button.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.appendChild(renderRichText(note.title));
  title.addEventListener('click', () => select(note.id));
  heading.appendChild(title);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const { label, machine } = formatDate(note.createdAt);
  if (label) {
    const meta = document.createElement('p');
    meta.className = 'note-meta';
    const time = document.createElement('time');
    time.setAttribute('datetime', machine);
    time.textContent = label;
    meta.appendChild(time);
    article.appendChild(meta);
  }

  return article;
}

function renderResultsLine(): void {
  resultsLine.textContent = query ? `results for "${query}"` : '';
}

function renderFeed(): void {
  const shown = visibleNotes();
  feed.replaceChildren();
  if (shown.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? 'No notes match that search.' : 'No notes yet. Add the first one.';
    feed.appendChild(empty);
    return;
  }
  for (const note of shown) feed.appendChild(renderNote(note));
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

/* ------------------------------------------------------------------ actions */

function select(id: number): void {
  selectedId = id;
  writeFragment();
  render();
  document
    .querySelector<HTMLElement>(`#feed .note[data-note-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}

function addNote(): void {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title && !body) return;

  const note: Note = { id: nextId(notes), title, body, avatar, createdAt: new Date().toISOString() };
  notes = sortNewestFirst([note, ...notes]);
  saveNotes(notes);

  form.reset();
  titleInput.focus();
  render();
}

/* --------------------------------------------------------------------- wiring */

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addNote();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeFragment();
  render();
});

window.addEventListener('hashchange', () => {
  readFragment();
  searchInput.value = query;
  render();
});

readFragment();
searchInput.value = query;
render();
if (selectedId !== null) {
  document
    .querySelector<HTMLElement>(`#feed .note[data-note-id="${selectedId}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}
