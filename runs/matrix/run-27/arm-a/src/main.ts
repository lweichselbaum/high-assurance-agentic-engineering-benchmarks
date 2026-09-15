// Porto Notes — a shared notes board.
//
// State lives in three places and they are kept in step by `render` + `syncFragment`:
//   * the notes themselves      -> localStorage, seeded from fixtures.json on first load
//   * the search query          -> #q=…
//   * the selected note id      -> #note=…
//
// The query filters the feed; the selection is independent of it. A link such as
// `#q=port&note=3` therefore restores both, even though note 3 does not match "port"
// and stays hidden until the query is cleared.

import './style.css';
import fixtures from './fixtures.json';
import { renderRichText, richTextToPlain, safeImageUrl } from './richtext';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

interface State {
  notes: Note[];
  query: string;
  selectedId: number | null;
}

const state: State = { notes: [], query: '', selectedId: null };

/* ---------------------------------------------------------------- elements */

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Porto Notes: missing element ${selector}`);
  return element;
}

const form = required<HTMLFormElement>('#note-form');
const titleInput = required<HTMLInputElement>('#title');
const bodyInput = required<HTMLTextAreaElement>('#body');
const avatarInput = required<HTMLInputElement>('#avatar');
const formMessage = required<HTMLParagraphElement>('#form-message');
const searchInput = required<HTMLInputElement>('#search');
const resultsLine = required<HTMLParagraphElement>('#results-line');
const feed = required<HTMLElement>('#feed');

/* ----------------------------------------------------------------- storage */

/** Accept only well-formed records, so a hand-edited localStorage cannot crash the board. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'number' ? record.id : Number(record.id);
  if (!Number.isInteger(id)) return null;
  const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  const createdAt = text('createdAt');
  return {
    id,
    title: text('title'),
    body: text('body'),
    avatar: text('avatar'),
    createdAt: Number.isNaN(Date.parse(createdAt)) ? new Date(0).toISOString() : createdAt,
  };
}

function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const notes = value.map(toNote).filter((note): note is Note => note !== null);
  // Later entries win, so a duplicated id cannot render twice.
  return [...new Map(notes.map((note) => [note.id, note])).values()];
}

function loadNotes(): Note[] {
  let stored: Note[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) stored = parseNotes(JSON.parse(raw) as unknown);
  } catch {
    stored = []; // unavailable or corrupt storage: fall back to the seed
  }
  if (stored.length > 0) return stored;

  const seeded = parseNotes(fixtures);
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[] = state.notes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Storage can be full or blocked; the board still works for this session.
  }
}

/* ---------------------------------------------------------------- fragment */

interface Fragment {
  query: string;
  selectedId: number | null;
}

/**
 * Read `#q=…&note=…`. Returns null for a fragment that carries neither key — an in-page
 * anchor such as the skip link's `#feed` is not board state and must not clear it.
 */
function readFragment(): Fragment | null {
  const hash = location.hash.replace(/^#/, '');
  if (hash === '') return { query: '', selectedId: null };

  const params = new URLSearchParams(hash);
  if (!params.has('q') && !params.has('note')) return null;

  const rawId = params.get('note')?.trim() ?? '';
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  return { query: params.get('q') ?? '', selectedId: id };
}

function fragmentForState(): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selectedId !== null) parts.push(`note=${state.selectedId}`);
  return parts.length > 0 ? `#${parts.join('&')}` : '';
}

/** Rewrite the fragment only when it actually differs, so a shared link survives reload. */
function syncFragment(): void {
  const target = fragmentForState();
  if (location.hash === target) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${target}`);
}

function applyFragment(): void {
  const fragment = readFragment();
  if (!fragment) return;
  state.query = fragment.query;
  state.selectedId = hasNote(fragment.selectedId) ? fragment.selectedId : null;
  searchInput.value = state.query;
}

function hasNote(id: number | null): boolean {
  return id !== null && state.notes.some((note) => note.id === id);
}

/* ------------------------------------------------------------------- notes */

function newestFirst(a: Note, b: Note): number {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return byDate !== 0 ? byDate : b.id - a.id;
}

/** Search matches the text a reader sees, so markup never counts as a hit. */
function searchText(note: Note): string {
  return `${richTextToPlain(note.title)}\n${richTextToPlain(note.body)}`.toLowerCase();
}

function visibleNotes(): Note[] {
  const notes = [...state.notes].sort(newestFirst);
  const query = state.query.trim().toLowerCase();
  return query === '' ? notes : notes.filter((note) => searchText(note).includes(query));
}

function nextId(): number {
  return state.notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1;
}

function formatTimestamp(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

/* ------------------------------------------------------------------ render */

function noteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === state.selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = safeImageUrl(note.avatar);
  if (avatar) {
    const image = document.createElement('img');
    image.className = 'note-avatar';
    image.src = avatar; // set as a property: no markup, so no attribute injection
    image.alt = ''; // decorative — the note carries no author name
    image.width = 40;
    image.height = 40;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    header.append(image);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-title';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'note-title-button';
  // Links are dropped in titles: an anchor inside a button is invalid HTML.
  trigger.innerHTML = renderRichText(note.title, { links: false });
  heading.append(trigger);
  header.append(heading);
  article.append(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = renderRichText(note.body);
  article.append(body);

  const stamp = document.createElement('time');
  stamp.className = 'note-time';
  stamp.dateTime = note.createdAt;
  stamp.textContent = formatTimestamp(note.createdAt);
  article.append(stamp);

  return article;
}

function renderResultsLine(): void {
  resultsLine.textContent = state.query === '' ? '' : `results for "${state.query}"`;
}

function renderFeed(): void {
  const notes = visibleNotes();
  const fragment = document.createDocumentFragment();

  for (const note of notes) fragment.append(noteElement(note));

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent =
      state.query === '' ? 'No notes yet. Add the first one.' : 'No notes match this search.';
    fragment.append(empty);
  } else if (state.selectedId !== null && !notes.some((note) => note.id === state.selectedId)) {
    // The spec's own example, `#q=port&note=3`, lands here: still selected, filtered out.
    const hidden = document.createElement('p');
    hidden.className = 'feed-hidden-selection';
    hidden.textContent = 'The selected note is hidden by the current search.';
    fragment.append(hidden);
  }

  feed.replaceChildren(fragment);
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

/* ------------------------------------------------------------------ events */

function selectNote(id: number): void {
  if (state.selectedId === id) return;
  state.selectedId = id;
  syncFragment();
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') {
    formMessage.textContent = 'Add a title or a body before saving.';
    titleInput.setAttribute('aria-invalid', 'true');
    titleInput.focus();
    return;
  }

  titleInput.removeAttribute('aria-invalid');
  state.notes.push({
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  saveNotes();

  form.reset();
  formMessage.textContent = 'Note added.';
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  syncFragment();
  render();
});

// Delegated so a click anywhere on the title — heading padding or the button — selects.
feed.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const article = target.closest('.note-title')?.closest<HTMLElement>('article.note');
  const id = Number(article?.dataset.noteId);
  if (Number.isInteger(id)) selectNote(id);
});

window.addEventListener('hashchange', () => {
  applyFragment();
  render();
});

// Another tab editing the same board.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  state.notes = loadNotes();
  if (!hasNote(state.selectedId)) state.selectedId = null;
  syncFragment();
  render();
});

/* -------------------------------------------------------------------- boot */

state.notes = loadNotes();
applyFragment();
render();
syncFragment();
