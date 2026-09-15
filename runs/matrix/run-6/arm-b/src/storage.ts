import type { Note } from './types';
import fixtures from './fixtures.json';

const STORAGE_KEY = 'porto-notes';

export function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) return JSON.parse(raw) as Note[];
  const seeded = fixtures as Note[];
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
