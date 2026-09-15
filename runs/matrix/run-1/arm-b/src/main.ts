// Porto Notes — implement the app here (see CLAUDE.md). This file is loaded by harness/entry.ts.
import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes } from './storage';
import { parseHash, buildHash } from './hash';
import { buildApp } from './layout';
import { renderFeed } from './feed';

const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const els = buildApp(root);

let notes: Note[] = loadNotes();
let { query, noteId: selectedId } = parseHash(location.hash);

function currentHash(): string {
  return location.hash;
}

function updateHash(): void {
  const target = buildHash({ query, noteId: selectedId });
  if (target !== currentHash()) {
    history.replaceState(null, '', location.pathname + location.search + target);
  }
}

function render(): void {
  els.resultsLine.textContent = query ? `results for "${query}"` : '';
  renderFeed(els.feed, notes, query, selectedId, selectNote);
}

function selectNote(id: number): void {
  selectedId = id;
  updateHash();
  render();
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value;
  const avatar = els.avatarInput.value.trim();
  if (!title || !body.trim()) return;

  const nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  notes = [...notes, { id: nextId, title, body, avatar, createdAt: new Date().toISOString() }];
  saveNotes(notes);
  els.form.reset();
  render();
});

els.searchInput.addEventListener('input', () => {
  query = els.searchInput.value;
  updateHash();
  render();
});

window.addEventListener('hashchange', () => {
  const parsed = parseHash(location.hash);
  query = parsed.query;
  selectedId = parsed.noteId;
  els.searchInput.value = query;
  render();
});

els.searchInput.value = query;
render();
