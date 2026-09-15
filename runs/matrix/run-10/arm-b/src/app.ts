import type { Note } from './types';
import { loadNotes, saveNotes, nextNoteId } from './storage';
import { parseHash, writeHash } from './hash';
import { renderFeed, renderResultsLine, filterNotes, sortNewestFirst } from './render';

export function initApp(): void {
  const form = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;
  const searchInput = document.getElementById('search') as HTMLInputElement;
  const resultsLine = document.getElementById('results-line') as HTMLElement;
  const feed = document.getElementById('feed') as HTMLElement;

  let notes = loadNotes();
  const initial = parseHash(location.hash);
  let query = initial.query;
  let selectedId = initial.noteId;
  searchInput.value = query;

  function draw(): void {
    renderResultsLine(resultsLine, query);
    const visible = sortNewestFirst(filterNotes(notes, query));
    renderFeed(feed, visible, selectedId, (id) => {
      selectedId = id;
      writeHash({ query, noteId: selectedId });
      draw();
    });
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    writeHash({ query, noteId: selectedId });
    draw();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();
    if (!title || !body) return;
    const note: Note = {
      id: nextNoteId(notes),
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };
    notes = [...notes, note];
    saveNotes(notes);
    form.reset();
    draw();
  });

  const syncFromUrl = (): void => {
    const state = parseHash(location.hash);
    query = state.query;
    selectedId = state.noteId;
    searchInput.value = query;
    draw();
  };
  window.addEventListener('hashchange', syncFromUrl);
  window.addEventListener('popstate', syncFromUrl);

  draw();
}
