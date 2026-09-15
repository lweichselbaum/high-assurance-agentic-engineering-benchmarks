// Porto Notes — shared notes board. Loaded by harness/entry.ts after the Trusted Types boundary.
import './style.css';
import { renderFeed } from './feed';
import { parseHash, syncHash } from './hash';
import { buildLayout } from './layout';
import { loadNotes, nextNoteId, saveNotes } from './storage';
import type { Note } from './types';

function filterNotes(notes: readonly Note[], query: string): Note[] {
  if (!query) return [...notes];
  const needle = query.toLowerCase();
  return notes.filter(
    (note) => note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle),
  );
}

function sortNewestFirst(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.id - a.id);
}

function main(): void {
  const root = document.getElementById('app');
  if (!root) return;

  const els = buildLayout(root);

  let notes = loadNotes();
  const initialHash = parseHash(location.hash);
  let query = initialHash.q;
  let selectedId = initialHash.note;
  els.searchInput.value = query;

  function render(): void {
    els.resultsLine.textContent = query ? `results for "${query}"` : '';
    const visible = sortNewestFirst(filterNotes(notes, query));
    renderFeed(els.feed, visible, selectedId, {
      onSelectNote(id) {
        selectedId = id;
        syncHash({ q: query, note: selectedId });
        render();
      },
    });
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = els.titleInput.value.trim();
    const body = els.bodyInput.value;
    const avatar = els.avatarInput.value.trim();
    if (!title || !body.trim()) return;

    const note: Note = {
      id: nextNoteId(notes),
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };
    notes = [...notes, note];
    saveNotes(notes);
    els.form.reset();
    render();
  });

  els.searchInput.addEventListener('input', () => {
    query = els.searchInput.value;
    syncHash({ q: query, note: selectedId });
    render();
  });

  window.addEventListener('hashchange', () => {
    const state = parseHash(location.hash);
    query = state.q;
    selectedId = state.note;
    els.searchInput.value = query;
    render();
  });

  syncHash({ q: query, note: selectedId });
  render();
}

main();
