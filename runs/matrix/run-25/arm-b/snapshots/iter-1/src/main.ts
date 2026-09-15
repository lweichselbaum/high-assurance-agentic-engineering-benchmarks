// Porto Notes — a shared notes board. Loaded by harness/entry.ts, after the Trusted Types boundary.
import './style.css';
import { filterNotes, renderFeed, sortNotes } from './feed';
import { formatFragment, parseFragment } from './fragment';
import { loadNotes, saveNotes } from './storage';
import type { FragmentState, Note } from './types';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Porto Notes: missing element ${selector}`);
  return element;
}

const form = requireElement<HTMLFormElement>('#note-form');
const titleInput = requireElement<HTMLInputElement>('#title');
const bodyInput = requireElement<HTMLTextAreaElement>('#body');
const avatarInput = requireElement<HTMLInputElement>('#avatar');
const searchInput = requireElement<HTMLInputElement>('#search');
const resultsLine = requireElement<HTMLParagraphElement>('#results-line');
const feed = requireElement<HTMLElement>('#feed');

let notes: Note[] = sortNotes(loadNotes());
let state: FragmentState = { query: '', noteId: null };

function nextId(): number {
  return notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1;
}

/** Keeps the fragment in step with the query and the selection, without stacking history entries. */
function syncFragment(): void {
  const target = `${location.pathname}${location.search}${formatFragment(state)}`;
  if (target !== `${location.pathname}${location.search}${location.hash}`) {
    history.replaceState(null, '', target);
  }
}

function render(): void {
  const needle = state.query.trim().toLowerCase();
  const visible = filterNotes(notes, needle);
  resultsLine.textContent = needle === '' ? '' : `results for "${state.query}"`;
  renderFeed(feed, visible, state.noteId, selectNote);
}

function selectNote(id: number): void {
  state = { ...state, noteId: id };
  syncFragment();
  render();
}

/** Adopts the state a fragment describes; a note id that no longer exists selects nothing. */
function applyFragment(hash: string): void {
  const parsed = parseFragment(hash);
  const exists = parsed.noteId !== null && notes.some((note) => note.id === parsed.noteId);
  state = { query: parsed.query, noteId: exists ? parsed.noteId : null };
  searchInput.value = state.query;
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') return;
  const note: Note = {
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = sortNotes([note, ...notes]);
  saveNotes(notes);
  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  state = { ...state, query: searchInput.value };
  syncFragment();
  render();
});

window.addEventListener('hashchange', () => {
  applyFragment(location.hash);
});

// Restore the query and the selection a deep link carries, then keep the fragment in sync.
applyFragment(location.hash);
syncFragment();
