import type { Note } from './types';
import seedNotes from './fixtures.json';

const STORAGE_KEY = 'porto-notes/notes';

export function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      /* corrupted storage: fall through and reseed */
    }
  }
  const seeded = seedNotes as Note[];
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
