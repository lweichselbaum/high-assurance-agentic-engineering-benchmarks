// Porto Notes — a shared notes board.
//
// State lives in three places: the notes themselves in localStorage, and the
// search query plus the selected note in the URL fragment, so a board view can
// be shared as a link and survives a reload.

import './style.css';
import { formatHash, parseHash } from './hash';
import { plainText, renderRichText } from './richtext';
import { loadNotes, nextId, saveNotes, sortNotes } from './store';
import type { Note } from './store';
import { safeImageSrc } from './url';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const formError = document.querySelector<HTMLParagraphElement>('#form-error')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;
const emptyState = document.querySelector<HTMLParagraphElement>('#empty-state')!;

let notes: Note[] = sortNotes(loadNotes());
let query = '';
let selectedId: number | null = null;

function matches(note: Note, needle: string): boolean {
  const haystack = `${plainText(note.title)} ${plainText(note.body)}`.toLowerCase();
  return haystack.includes(needle);
}

function visibleNotes(): Note[] {
  const needle = query.trim().toLowerCase();
  return needle ? notes.filter((note) => matches(note, needle)) : notes;
}

function buildNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatarSrc = safeImageSrc(note.avatar);
  if (avatarSrc) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.setAttribute('src', avatarSrc);
    img.alt = ''; // decorative: the note carries no author name to announce
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    header.appendChild(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.appendChild(renderRichText(note.title));
  titleButton.addEventListener('click', () => select(note.id));
  heading.appendChild(titleButton);
  header.appendChild(heading);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body));
  article.appendChild(body);

  const time = document.createElement('time');
  time.className = 'note-time';
  time.dateTime = note.createdAt;
  const parsed = Date.parse(note.createdAt);
  time.textContent = Number.isNaN(parsed) ? '' : new Date(parsed).toLocaleString();
  article.appendChild(time);

  return article;
}

function render(): void {
  const shown = visibleNotes();

  resultsLine.textContent = query.trim() ? `results for "${query}"` : '';

  feed.replaceChildren(...shown.map(buildNote));

  if (shown.length) {
    emptyState.textContent = '';
    emptyState.hidden = true;
  } else {
    emptyState.hidden = false;
    emptyState.textContent = query.trim()
      ? 'No notes match this search.'
      : 'No notes yet — add the first one.';
  }
}

function syncHash(): void {
  const next = formatHash({ query, selectedId });
  const url = `${location.pathname}${location.search}${next}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) {
    // replaceState, so typing in the search box does not fill up the history.
    history.replaceState(null, '', url);
  }
}

function select(id: number): void {
  selectedId = id;
  render();
  syncHash();
}

/** Applies the fragment to the app: the source of truth on load and on hashchange. */
function applyHash(): void {
  const state = parseHash(location.hash);
  query = state.query;
  // Drop a selection that names a note we do not have, so the fragment stays honest.
  selectedId = notes.some((note) => note.id === state.selectedId) ? state.selectedId : null;
  searchInput.value = query;
  render();
  syncHash();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title && !body) {
    formError.textContent = 'Add a title or a body before saving.';
    titleInput.focus();
    return;
  }
  formError.textContent = '';

  const note: Note = { id: nextId(notes), title, body, avatar, createdAt: new Date().toISOString() };
  notes = sortNotes([note, ...notes]);
  saveNotes(notes);

  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  render();
  syncHash();
});

window.addEventListener('hashchange', applyHash);

applyHash();
