import type { Note } from './types';
import fixtures from './fixtures.json';

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
    /* fall through to reseed */
  }
  return null;
}

function writeStoredNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function loadNotes(): Note[] {
  const stored = readStoredNotes();
  if (stored !== null) return stored;
  const seeded = fixtures as Note[];
  writeStoredNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  writeStoredNotes(notes);
}

export function nextNoteId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
