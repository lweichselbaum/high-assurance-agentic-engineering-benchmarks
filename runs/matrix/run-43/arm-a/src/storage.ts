import fixturesData from '../fixtures.json';
import { Note } from './types';

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
  } catch (e) {
    console.error('Failed to load notes from localStorage:', e);
  }

  // Seed with fixtures
  const initial = fixturesData as Note[];
  saveNotes(initial);
  return initial;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage:', e);
  }
}

export function getNextId(notes: Note[]): number {
  if (notes.length === 0) return 1;
  return Math.max(...notes.map((n) => n.id)) + 1;
}
