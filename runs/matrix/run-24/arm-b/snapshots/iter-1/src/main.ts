// Porto Notes — a shared notes board. Loaded by harness/entry.ts, after the Trusted Types
// boundary is installed. The static markup lives in index.html; this file wires it up.
import './style.css';

import { applySelection, byNewestFirst, renderFeed } from './feed';
import { readRoute, writeRoute, type Route } from './hash';
import { toPlainText } from './richtext';
import { loadNotes, nextCreatedAt, nextNoteId, saveNotes } from './storage';
import type { Note } from './types';

function element<T extends Element>(id: string, kind: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Porto Notes: #${id} is missing from index.html`);
  return found;
}

const form = element('note-form', HTMLFormElement);
const titleInput = element('title', HTMLInputElement);
const bodyInput = element('body', HTMLTextAreaElement);
const avatarInput = element('avatar', HTMLInputElement);
const searchInput = element('search', HTMLInputElement);
const resultsLine = element('results-line', HTMLParagraphElement);
const feed = element('feed', HTMLElement);

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

/** Lowercased text a note is searched against: both what was typed and what is displayed. */
const haystacks = new Map<number, string>();

function haystack(note: Note): string {
  const cached = haystacks.get(note.id);
  if (cached !== undefined) return cached;
  const built = [note.title, note.body, toPlainText(note.title), toPlainText(note.body)].join('\n').toLowerCase();
  haystacks.set(note.id, built);
  return built;
}

function visibleNotes(): Note[] {
  const sorted = [...notes].sort(byNewestFirst);
  const needle = query.trim().toLowerCase();
  if (needle === '') return sorted;
  return sorted.filter((note) => haystack(note).includes(needle));
}

function render(): void {
  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;
  renderFeed(feed, visibleNotes(), selectedId, select);
}

function syncUrl(): void {
  writeRoute({ query, noteId: selectedId });
}

function select(id: number): void {
  selectedId = id;
  syncUrl();
  applySelection(feed, selectedId);
}

/** Adopt a route that came from the URL (first load, or the fragment changed under us). */
function applyRoute(route: Route): void {
  query = route.query;
  searchInput.value = query;
  selectedId = route.noteId !== null && notes.some((note) => note.id === route.noteId) ? route.noteId : null;
  render();
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  syncUrl();
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (title === '' && body === '' && avatar === '') return;

  notes = [{ id: nextNoteId(notes), title, body, avatar, createdAt: nextCreatedAt(notes) }, ...notes];
  saveNotes(notes);
  form.reset();
  titleInput.focus();
  render();
});

window.addEventListener('hashchange', () => {
  applyRoute(readRoute());
});

applyRoute(readRoute());
