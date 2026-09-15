/** Persistence: the board lives in localStorage and is seeded from fixtures.json on first load. */
import fixtures from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Accepts anything shaped like a note; returns null for entries we cannot trust. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw['id'] === 'number' ? raw['id'] : Number.NaN;
  if (!Number.isInteger(id)) return null;
  return {
    id,
    title: asString(raw['title']),
    body: asString(raw['body']),
    avatar: asString(raw['avatar']),
    createdAt: asString(raw['createdAt']),
  };
}

function toNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) return null;
  const notes: Note[] = [];
  for (const entry of value) {
    const note = toNote(entry);
    if (note !== null) notes.push(note);
  }
  return notes;
}

/** The seed board, read from the fixtures shipped with the app. */
export function seedNotes(): Note[] {
  return toNotes(fixtures) ?? [];
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // A full or unavailable storage must not take the board down.
  }
}

/** Saved notes if there are any, otherwise the seed data (which is then persisted). */
export function loadNotes(): Note[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== null) {
    try {
      const stored = toNotes(JSON.parse(raw));
      if (stored !== null) return stored;
    } catch {
      // Corrupt storage falls through to the seed data.
    }
  }
  const seeded = seedNotes();
  saveNotes(seeded);
  return seeded;
}

/** New notes continue the id sequence. */
export function nextId(notes: Note[]): number {
  let max = 0;
  for (const note of notes) {
    if (note.id > max) max = note.id;
  }
  return max + 1;
}
