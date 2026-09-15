import { loadNotes, saveNotes } from './storage';
import { parseHash, writeHash } from './hash';
import { renderFeed } from './feed';
import type { Note } from './types';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

const notes: Note[] = loadNotes();
const initial = parseHash(window.location.hash);
let query = initial.query;
let selectedId = initial.noteId;

searchInput.value = query;

function matches(note: Note, q: string): boolean {
  const haystack = `${note.title} ${note.body}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function render(): void {
  const filtered = query ? notes.filter((note) => matches(note, query)) : notes;
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderFeed(feed, sorted, selectedId, selectNote);
  resultsLine.textContent = query ? `results for "${query}"` : '';
}

function selectNote(id: number): void {
  selectedId = id;
  writeHash({ query, noteId: selectedId });
  render();
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeHash({ query, noteId: selectedId });
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();
  if (!title || !body.trim()) return;

  const nextId = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
  notes.push({ id: nextId, title, body, avatar, createdAt: new Date().toISOString() });
  saveNotes(notes);
  form.reset();
  render();
});

render();
