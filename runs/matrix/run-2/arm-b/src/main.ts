import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes, nextId } from './storage';
import { buildLayout } from './layout';
import { renderFeed, filterNotes } from './feed';
import { parseHash, serializeHash } from './hash';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app root element');

const elements = buildLayout(root);

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

function updateHash(): void {
  const fragment = serializeHash({ query, noteId: selectedId });
  const url = `${location.pathname}${location.search}${fragment}`;
  history.replaceState(null, '', url);
}

function render(): void {
  const filtered = filterNotes(notes, query);
  elements.resultsLine.textContent = query ? `results for "${query}"` : '';
  renderFeed(elements.feed, filtered, selectedId, { onSelect: selectNote });
}

function selectNote(id: number): void {
  selectedId = id;
  updateHash();
  render();
}

function applyRouteFromHash(): void {
  const state = parseHash(location.hash);
  query = state.query;
  selectedId = state.noteId;
  elements.searchInput.value = query;
  render();
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = elements.titleInput.value.trim();
  const body = elements.bodyInput.value;
  const avatar = elements.avatarInput.value.trim();
  if (!title || !body) return;

  const note: Note = { id: nextId(notes), title, body, avatar, createdAt: new Date().toISOString() };
  notes = [...notes, note];
  saveNotes(notes);
  elements.form.reset();
  render();
});

elements.searchInput.addEventListener('input', () => {
  query = elements.searchInput.value;
  updateHash();
  render();
});

window.addEventListener('hashchange', applyRouteFromHash);

applyRouteFromHash();
