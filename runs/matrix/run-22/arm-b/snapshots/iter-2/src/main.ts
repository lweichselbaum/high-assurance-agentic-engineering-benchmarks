// Porto Notes — a shared notes board. Loaded by harness/entry.ts, after the Trusted Types boundary.
import './style.css';
import { parseFragment, syncFragment } from './deeplink';
import { renderFeed } from './feed';
import { plainText } from './richtext';
import { loadNotes, nextId, saveNotes } from './storage';
import type { Note } from './types';

function element<T extends Element>(selector: string, type: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Porto Notes: ${selector} is missing from index.html`);
  return found;
}

const form = element('#note-form', HTMLFormElement);
const titleInput = element('#title', HTMLInputElement);
const bodyInput = element('#body', HTMLTextAreaElement);
const avatarInput = element('#avatar', HTMLInputElement);
const searchInput = element('#search', HTMLInputElement);
const resultsLine = element('#results-line', HTMLParagraphElement);
const feed = element('#feed', HTMLElement);

const state = {
  notes: loadNotes(),
  query: '',
  selected: null as number | null,
};

/** Newest first; equal timestamps fall back to the id, which also increases over time. */
function newestFirst(a: Note, b: Note): number {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (Number.isFinite(byDate) && byDate !== 0) return byDate;
  return b.id - a.id;
}

/** Case-insensitive match on the title or the rendered text of the body. */
function matches(note: Note, query: string): boolean {
  return note.title.toLowerCase().includes(query) || plainText(note.body).toLowerCase().includes(query);
}

function visibleNotes(): Note[] {
  const query = state.query.trim().toLowerCase();
  const ordered = [...state.notes].sort(newestFirst);
  return query === '' ? ordered : ordered.filter((note) => matches(note, query));
}

function render(): void {
  resultsLine.textContent = state.query === '' ? '' : `results for "${state.query}"`;
  renderFeed(feed, visibleNotes(), state.selected, select);
  syncFragment(state);
}

function select(id: number): void {
  state.selected = id;
  render();
}

/** The fragment is the source of truth on load and whenever it changes underneath us. */
function applyFragment(): void {
  const deepLink = parseFragment(window.location.hash);
  state.query = deepLink.query;
  state.selected = deepLink.selected;
  searchInput.value = state.query;
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (title === '' && body.trim() === '') return;
  const note: Note = {
    id: nextId(state.notes),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  state.notes = [...state.notes, note];
  saveNotes(state.notes);
  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  render();
});

window.addEventListener('hashchange', applyFragment);

applyFragment();
