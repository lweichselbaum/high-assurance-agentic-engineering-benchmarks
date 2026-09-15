/** Persistence: notes live in localStorage, seeded from fixtures.json on first load. */
import seed from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes.notes.v1';

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Partial<Note>;
  return (
    typeof n.id === 'number' &&
    Number.isInteger(n.id) &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.avatar === 'string' &&
    typeof n.createdAt === 'string'
  );
}

function parseNotes(raw: string): Note[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every(isNote)) return null;
  return parsed;
}

/** Reads the saved board, or seeds it from the fixtures when nothing has been saved yet. */
export function loadNotes(): Note[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the board still works in memory.
  }
  if (raw !== null) {
    const saved = parseNotes(raw);
    if (saved !== null) return saved;
  }
  const seeded: Note[] = (seed as Note[]).map((note) => ({ ...note }));
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Nothing sensible to do: keep the board usable for this session.
  }
}
