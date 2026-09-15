import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes, nextId } from './storage';
import { parseHash, writeHash } from './hash';
import { renderFeed, visibleNotes } from './feed';

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

let notes: Note[] = loadNotes();

const initial = parseHash(location.hash);
let query = initial.query;
let selectedId = notes.some((note) => note.id === initial.noteId) ? initial.noteId : null;

searchInput.value = query;

function render(): void {
  resultsLine.textContent = query ? `results for "${query}"` : '';
  renderFeed(feed, visibleNotes(notes, query), selectedId, { onSelectNote: selectNote });
  writeHash({ query, noteId: selectedId });
}

function selectNote(id: number): void {
  selectedId = id;
  render();
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextId(notes),
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

render();
