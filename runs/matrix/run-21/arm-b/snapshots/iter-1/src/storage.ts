/** Persistence. Notes live in localStorage; the fixtures seed an empty board on first load. */
import fixtures from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

/** Stored JSON is untrusted input like any other: shape it back into a Note or drop it. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw['id'] === 'number' ? raw['id'] : Number(raw['id']);
  if (!Number.isFinite(id)) return null;
  return {
    id: Math.trunc(id),
    title: typeof raw['title'] === 'string' ? raw['title'] : '',
    body: typeof raw['body'] === 'string' ? raw['body'] : '',
    avatar: typeof raw['avatar'] === 'string' ? raw['avatar'] : '',
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : new Date(0).toISOString(),
  };
}

function toNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  return value.map(toNote).filter((note): note is Note => note !== null);
}

export function loadNotes(): Note[] {
  let stored: unknown = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) stored = JSON.parse(raw);
  } catch {
    stored = null;
  }

  const notes = toNotes(stored);
  if (notes.length > 0) return notes;

  const seeded = toNotes(fixtures as unknown[]);
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* a full or blocked storage must not take the board down */
  }
}
