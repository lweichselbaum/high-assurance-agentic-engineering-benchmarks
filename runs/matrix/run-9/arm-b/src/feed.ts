import type { Note } from './types';
import { buildNoteArticle, type NoteViewCallbacks } from './layout';

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (q === '') return notes;
  return notes.filter((note) => note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q));
}

export function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.id - a.id);
}

export function renderFeed(feedEl: HTMLElement, notes: Note[], selectedId: number | null, callbacks: NoteViewCallbacks): void {
  feedEl.replaceChildren();
  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes to show.';
    feedEl.appendChild(empty);
    return;
  }
  for (const note of sortNewestFirst(notes)) {
    feedEl.appendChild(buildNoteArticle(note, selectedId, callbacks));
  }
}
