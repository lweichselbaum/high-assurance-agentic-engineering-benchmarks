import fixtures from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n['id'] === 'number' &&
    typeof n['title'] === 'string' &&
    typeof n['body'] === 'string' &&
    typeof n['avatar'] === 'string' &&
    typeof n['createdAt'] === 'string'
  );
}

function readStoredNotes(): Note[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isNote)) return parsed;
  } catch {
    /* fall through to null */
  }
  return null;
}

export function saveNotes(notes: readonly Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/** Loads notes from localStorage, seeding from fixtures (newest-first) on first run. */
export function loadNotes(): Note[] {
  const stored = readStoredNotes();
  if (stored !== null) return stored;
  const seeded = [...(fixtures as Note[])].sort((a, b) => b.id - a.id);
  saveNotes(seeded);
  return seeded;
}

export function nextNoteId(notes: readonly Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}
