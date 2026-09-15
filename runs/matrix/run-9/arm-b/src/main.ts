import type { Note } from './types';
import { loadNotes, saveNotes, nextNoteId } from './storage';
import { filterNotes, renderFeed } from './feed';
import { readHash, writeHash } from './hash';
import './style.css';

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedEl = document.getElementById('feed') as HTMLElement;

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

function render(): void {
  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;
  renderFeed(feedEl, filterNotes(notes, query), selectedId, { onSelect: selectNote });
}

function syncHash(): void {
  writeHash({ query, noteId: selectedId });
}

function selectNote(id: number): void {
  selectedId = id;
  syncHash();
  render();
}

function applyHash(): void {
  const state = readHash();
  query = state.query;
  selectedId = state.noteId;
  searchInput.value = query;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' || body === '') return;
  const note: Note = {
    id: nextNoteId(notes),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  form.reset();
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  syncHash();
  render();
});

window.addEventListener('hashchange', () => {
  applyHash();
  render();
});

applyHash();
render();
