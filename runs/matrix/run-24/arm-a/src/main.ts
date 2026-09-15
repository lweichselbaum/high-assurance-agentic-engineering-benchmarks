// Porto Notes — a shared notes board.
//
// State is three values: the notes, the search query and the selected note id. The
// query and the selection also live in the URL fragment (`#q=port&note=3`) so a board
// can be linked and restored; the notes live in localStorage.

import './style.css';
import { plainText, renderRichText, safeImageUrl } from './richtext';
import { byNewestFirst, loadNotes, nextId, saveNotes, type Note } from './storage';

/** Looks up an element the markup is contracted to provide. */
function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Porto Notes: #${id} is missing from the page`);
  return element as T;
}

const form = must<HTMLFormElement>('note-form');
const titleInput = must<HTMLInputElement>('title');
const bodyInput = must<HTMLTextAreaElement>('body');
const avatarInput = must<HTMLInputElement>('avatar');
const searchInput = must<HTMLInputElement>('search');
const resultsLine = must<HTMLParagraphElement>('results-line');
const feed = must<HTMLElement>('feed');

let notes = loadNotes().sort(byNewestFirst);
let query = '';
let selectedId: number | null = null;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------- deep links

interface Fragment {
  q: string;
  note: number | null;
}

/** Reads `#q=…&note=…`. Unknown keys and unparseable values are ignored. */
function readFragment(): Fragment {
  const result: Fragment = { q: '', note: null };
  for (const part of location.hash.replace(/^#/, '').split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = decode(eq === -1 ? '' : part.slice(eq + 1));
    if (key === 'q') result.q = value;
    if (key === 'note') {
      const id = Number(value);
      result.note = Number.isSafeInteger(id) ? id : null;
    }
  }
  return result;
}

/**
 * Writes the current query and selection back to the fragment, in the documented
 * `q` then `note` order. `replaceState` keeps typing in the search box from filling
 * the history with one entry per keystroke.
 */
function writeFragment(): void {
  const parts: string[] = [];
  if (query !== '') parts.push('q=' + encodeURIComponent(query));
  if (selectedId !== null) parts.push('note=' + selectedId);
  const hash = parts.length > 0 ? '#' + parts.join('&') : '';
  const url = location.pathname + location.search + hash;
  if (url !== location.pathname + location.search + location.hash) {
    history.replaceState(null, '', url);
  }
}

/** Adopts the fragment as the current state. Used on load and on back/forward. */
function applyFragment(): void {
  const { q, note } = readFragment();
  query = q;
  selectedId = note;
  searchInput.value = query;
  render();
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

// ------------------------------------------------------------------ rendering

function matches(note: Note, needle: string): boolean {
  if (needle === '') return true;
  const haystack = (plainText(note.title) + '\n' + plainText(note.body)).toLowerCase();
  return haystack.includes(needle);
}

function render(): void {
  const needle = query.toLowerCase();
  const visible = notes.filter((note) => matches(note, needle));

  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;

  feed.replaceChildren(
    ...(visible.length > 0
      ? visible.map(renderNote)
      : [emptyState(query === '' ? 'No notes yet. Add the first one.' : 'No notes match that search.')]),
  );
}

function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = safeImageUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.setAttribute('src', avatar);
    img.setAttribute('alt', '');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.width = 40;
    img.height = 40;
    header.appendChild(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';

  // The title is the selection control, so it is a real button: focusable, and
  // operable with Enter and Space without any extra key handling.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.appendChild(renderRichText(note.title, { links: false }));
  if (title.textContent === '') title.setAttribute('aria-label', 'Untitled note');
  title.addEventListener('click', () => select(note.id));
  heading.appendChild(title);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const stamp = Date.parse(note.createdAt);
  if (!Number.isNaN(stamp)) {
    const time = document.createElement('time');
    time.className = 'note-time';
    time.dateTime = note.createdAt;
    time.textContent = dateFormat.format(stamp);
    article.appendChild(time);
  }

  return article;
}

function emptyState(message: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = message;
  return p;
}

// -------------------------------------------------------------------- actions

function select(id: number): void {
  selectedId = id;
  writeFragment();
  render();
  // Selection is a visual-only change, so announce it to assistive technology.
  const selected = feed.querySelector<HTMLElement>(`.note[data-note-id="${id}"] .note-title`);
  selected?.focus({ preventScroll: true });
}

function addNote(): void {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') return;

  notes = [
    {
      id: nextId(notes),
      title,
      body,
      avatar: avatarInput.value.trim(),
      createdAt: new Date().toISOString(),
    },
    ...notes,
  ].sort(byNewestFirst);

  saveNotes(notes);
  form.reset();
  titleInput.focus();
  render();
}

// --------------------------------------------------------------------- wiring

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addNote();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeFragment();
  render();
});

// Someone edited the fragment, or used back/forward.
window.addEventListener('hashchange', applyFragment);

applyFragment();
