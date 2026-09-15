/**
 * Porto Notes — a shared notes board.
 *
 * The state is three values: the notes (persisted in localStorage), the search query and the
 * selected note id (both persisted in the URL fragment). Everything else is derived.
 */
import './style.css';
import { markSelected, renderFeed } from './feed';
import { readRoute, writeRoute } from './hash';
import { filterNotes, nextId, nextTimestamp } from './notes';
import { loadNotes, saveNotes } from './storage';
import type { Note } from './types';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Porto Notes: missing element ${selector}`);
  return element;
}

const form = required<HTMLFormElement>('#note-form');
const titleInput = required<HTMLInputElement>('#title');
const bodyInput = required<HTMLTextAreaElement>('#body');
const avatarInput = required<HTMLInputElement>('#avatar');
const searchInput = required<HTMLInputElement>('#search');
const resultsLine = required<HTMLParagraphElement>('#results-line');
const feed = required<HTMLElement>('#feed');

const state: { notes: Note[]; query: string; selected: number | null } = {
  notes: loadNotes(),
  query: '',
  selected: null,
};

/** A query of only whitespace is not a search. */
function isSearching(): boolean {
  return state.query.trim() !== '';
}

function render(): void {
  const query = isSearching() ? state.query : '';
  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;
  renderFeed(feed, { notes: filterNotes(state.notes, state.query), selected: state.selected, query }, select);
}

/**
 * Selecting only flips `aria-current`: the feed itself does not change, and rebuilding it would
 * throw away the focus of the title button that was just activated.
 */
function select(id: number): void {
  state.selected = id;
  markSelected(feed, state.selected);
  syncRoute();
}

function syncRoute(): void {
  writeRoute({ query: isSearching() ? state.query : '', selected: state.selected });
}

/** Adopts the query and selection from the fragment (initial load, and back/forward). */
function applyRoute(): void {
  const route = readRoute();
  state.query = route.query;
  state.selected = route.selected;
  searchInput.value = route.query;
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (title === '' && body.trim() === '') return;

  state.notes = [
    ...state.notes,
    { id: nextId(state.notes), title, body, avatar: avatarInput.value.trim(), createdAt: nextTimestamp(state.notes) },
  ];
  saveNotes(state.notes);
  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  syncRoute();
  render();
});

// Back/forward and hand-edited fragments; `writeRoute` uses replaceState, so this never re-enters.
window.addEventListener('hashchange', applyRoute);

applyRoute();
syncRoute();
