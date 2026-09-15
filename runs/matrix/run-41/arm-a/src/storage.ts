import seedNotes from '../fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto_notes';

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to parse notes from localStorage:', error);
  }

  // First load: seed with fixtures.json
  const initial = (seedNotes as Note[]).map((note) => ({ ...note }));
  saveNotes(initial);
  return initial;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save notes to localStorage:', error);
  }
}

export function getNextNoteId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
