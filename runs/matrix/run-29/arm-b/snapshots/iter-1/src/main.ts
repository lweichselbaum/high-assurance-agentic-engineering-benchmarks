/**
 * Porto Notes — a shared notes board.
 *
 * The board is a list of notes in localStorage, seeded from fixtures.json. What the reader is
 * looking at — the search query and the selected note — lives in the URL fragment, so a view is
 * a link. Rendering goes through src/richtext.ts, which builds DOM nodes instead of HTML strings.
 */
import './style.css';
import { renderNote } from './feed';
import { parseHash, syncHash } from './hash';
import { richTextToPlainText } from './richtext';
import { loadNotes, nextId, saveNotes } from './storage';
import type { Note, ViewState } from './types';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Porto Notes: ${selector} is missing from index.html`);
  return element;
}

const form = required<HTMLFormElement>('#note-form');
const titleInput = required<HTMLInputElement>('#title');
const bodyInput = required<HTMLTextAreaElement>('#body');
const avatarInput = required<HTMLInputElement>('#avatar');
const searchInput = required<HTMLInputElement>('#search');
const resultsLine = required<HTMLParagraphElement>('#results-line');
const feed = required<HTMLElement>('#feed');
const emptyState = required<HTMLParagraphElement>('#empty-state');

let notes: Note[] = loadNotes();
const state: ViewState = { query: '', selectedId: null };

function timeOf(note: Note): number {
  const at = Date.parse(note.createdAt);
  return Number.isNaN(at) ? 0 : at;
}

/** Newest first; the id sequence decides ties, so a note added in the same millisecond still leads. */
function newestFirst(a: Note, b: Note): number {
  return timeOf(b) - timeOf(a) || b.id - a.id;
}

/** Title and body, as typed and as read, so a query may span formatting tags. */
function haystack(note: Note): string {
  return [note.title, richTextToPlainText(note.title), note.body, richTextToPlainText(note.body)].join('\n').toLowerCase();
}

function visibleNotes(): Note[] {
  const sorted = [...notes].sort(newestFirst);
  const query = state.query.trim().toLowerCase();
  return query === '' ? sorted : sorted.filter((note) => haystack(note).includes(query));
}

function applySelection(): void {
  const selected = state.selectedId === null ? null : String(state.selectedId);
  for (const article of feed.querySelectorAll('.note')) {
    if (selected !== null && article.getAttribute('data-note-id') === selected) article.setAttribute('aria-current', 'true');
    else article.removeAttribute('aria-current');
  }
}

function render(): void {
  const visible = visibleNotes();
  feed.replaceChildren(...visible.map(renderNote));

  resultsLine.textContent = state.query === '' ? '' : `results for "${state.query}"`;
  emptyState.textContent = notes.length === 0 ? 'No notes yet — add the first one.' : 'No notes match this search.';
  emptyState.hidden = visible.length > 0;

  applySelection();
}

/** The fragment is the source of truth for the query and the selection. */
function readHash(): void {
  const parsed = parseHash(location.hash);
  state.query = parsed.query;
  state.selectedId = parsed.selectedId;
  if (searchInput.value !== state.query) searchInput.value = state.query;
}

/** A new note is always the newest one, even if the clock disagrees with the board. */
function nextTimestamp(): string {
  let newest = 0;
  for (const note of notes) newest = Math.max(newest, timeOf(note));
  return new Date(Math.max(Date.now(), newest + 1000)).toISOString();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') return;

  notes = [...notes, { id: nextId(notes), title, body, avatar: avatarInput.value.trim(), createdAt: nextTimestamp() }];
  saveNotes(notes);
  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  syncHash(state);
  render();
});

// Delegated: a title is a button, but the click may land on the heading around it or on a <b> inside it.
feed.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const article = target.closest('.note-title')?.closest('.note');
  if (article === null || article === undefined) return;
  const id = Number(article.getAttribute('data-note-id'));
  if (!Number.isInteger(id)) return;

  state.selectedId = id;
  syncHash(state);
  applySelection();
});

// Someone edited the fragment, or followed a link into the board: adopt it.
window.addEventListener('hashchange', () => {
  readHash();
  render();
});

readHash();
render();
