import type { Note } from './types.ts';
import fixturesData from './fixtures.json';

const STORAGE_KEY = 'porto_notes';

export function getSeedNotes(): Note[] {
  return (fixturesData as Note[]).map((item) => ({ ...item }));
}

export function sortNotesNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const initial = sortNotesNewestFirst(getSeedNotes());
      saveNotes(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return sortNotesNewestFirst(parsed as Note[]);
    }
  } catch {
    // Fallback if localStorage read or JSON parse fails
  }
  const fallback = sortNotesNewestFirst(getSeedNotes());
  saveNotes(fallback);
  return fallback;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Handle storage quota errors gracefully
  }
}

export function getNextNoteId(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, Number(n.id) || 0), 0) + 1;
}
