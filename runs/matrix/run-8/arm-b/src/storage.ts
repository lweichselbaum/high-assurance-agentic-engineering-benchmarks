// Porto Notes — localStorage persistence, seeded from fixtures.json on first load.
import type { Note } from './types';
import seedNotes from './fixtures.json';

const STORAGE_KEY = 'porto-notes:v1';

function parseStoredNotes(raw: string): Note[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : null;
  } catch {
    return null;
  }
}

export function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  const stored = raw === null ? null : parseStoredNotes(raw);
  if (stored) return stored;

  const seeded = seedNotes as Note[];
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function nextNoteId(notes: readonly Note[]): number {
  let max = 0;
  for (const note of notes) max = Math.max(max, note.id);
  return max + 1;
}
