import type { Note } from './types';
import fixtures from './fixtures.json';

const STORAGE_KEY = 'porto-notes.notes.v1';

export function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      /* fall through to reseed */
    }
  }
  const seeded = fixtures as Note[];
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function nextNoteId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
