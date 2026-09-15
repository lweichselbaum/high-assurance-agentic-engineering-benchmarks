import { renderFeed, renderResultsLine } from './feed';
import { parseHash, syncHash } from './hash';
import { loadNotes, nextNoteId, saveNotes } from './storage';
import type { Note } from './types';

function requireElement<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing #${id}`);
  return el as unknown as T;
}

const form = requireElement<HTMLFormElement>('note-form');
const titleInput = requireElement<HTMLInputElement>('title');
const bodyInput = requireElement<HTMLTextAreaElement>('body');
const avatarInput = requireElement<HTMLInputElement>('avatar');
const searchInput = requireElement<HTMLInputElement>('search');
const resultsLine = requireElement<HTMLElement>('results-line');
const feedEl = requireElement<HTMLElement>('feed');

const notes: Note[] = loadNotes();
let nextId = nextNoteId(notes);

const initialHash = parseHash(location.hash);
let query = initialHash.query;
let selectedId = notes.some((n) => n.id === initialHash.noteId) ? initialHash.noteId : null;

function render(): void {
  renderResultsLine(resultsLine, query);
  renderFeed(feedEl, notes, query, selectedId, selectNote);
}

function selectNote(id: number): void {
  selectedId = id;
  syncHash({ query, noteId: selectedId });
  render();
}

syncHash({ query, noteId: selectedId });

searchInput.value = query;
searchInput.addEventListener('input', () => {
  query = searchInput.value;
  syncHash({ query, noteId: selectedId });
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' || body === '') return;

  const note: Note = {
    id: nextId++,
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes.unshift(note);
  saveNotes(notes);
  form.reset();
  render();
});

render();
