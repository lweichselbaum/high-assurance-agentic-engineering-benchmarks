import './style.css';
import { renderFeed } from './feed';
import { loadNotes, saveNotes } from './storage';
import type { Note, ViewState } from './types';
import { readViewState, writeViewState } from './urlstate';

function required<T extends Element>(selector: string, ctor: new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof ctor)) {
    throw new Error(`Porto Notes: index.html is missing ${selector}`);
  }
  return el;
}

const form = required('#note-form', HTMLFormElement);
const titleInput = required('#title', HTMLInputElement);
const bodyInput = required('#body', HTMLTextAreaElement);
const avatarInput = required('#avatar', HTMLInputElement);
const searchInput = required('#search', HTMLInputElement);
const resultsLine = required('#results-line', HTMLParagraphElement);
const feed = required('#feed', HTMLElement);

const notes: Note[] = loadNotes();
const state: ViewState = readViewState();

function render(): void {
  // Only when it differs: reassigning an <input> value mid-typing moves the caret.
  if (searchInput.value !== state.query) searchInput.value = state.query;
  resultsLine.textContent = state.query === '' ? '' : `results for "${state.query}"`;
  renderFeed(feed, notes, state.query, state.selectedId, select);
}

function select(id: number): void {
  state.selectedId = id;
  writeViewState(state);
  render();
}

/**
 * New notes continue the id sequence, and their timestamp is never older than the newest note on
 * the board, so "newest first" and "most recently added first" cannot disagree if the clock is off.
 */
function nextId(): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}

function nextTimestamp(): string {
  const newest = notes.reduce((max, note) => Math.max(max, Date.parse(note.createdAt) || 0), 0);
  return new Date(Math.max(Date.now(), newest + 1000)).toISOString();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (title === '' && body.trim() === '') return;

  notes.push({
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: nextTimestamp(),
  });
  saveNotes(notes);
  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  writeViewState(state);
  render();
});

// Back/forward and hand-edited fragments. Our own updates go through replaceState, which does not
// fire this, so there is no loop to break.
window.addEventListener('hashchange', () => {
  const restored = readViewState();
  state.query = restored.query;
  state.selectedId = restored.selectedId;
  render();
});

render();
