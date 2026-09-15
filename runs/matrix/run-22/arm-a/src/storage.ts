import type { Note } from './types';
import fixtures from './fixtures.json';

const KEY = 'porto-notes.v1';

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'number' &&
    Number.isFinite(note.id) &&
    typeof note.title === 'string' &&
    typeof note.body === 'string'
  );
}

function normalise(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isNote).map((note) => ({
    id: Math.trunc(note.id),
    title: note.title,
    body: note.body,
    avatar: typeof note.avatar === 'string' ? note.avatar : '',
    createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date(0).toISOString(),
  }));
}

export function seedNotes(): Note[] {
  return normalise(fixtures);
}

/** Saved notes, or the seed data on first load. */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — fall back to seeds.
  }
  if (stored === null) {
    const seeded = seedNotes();
    saveNotes(seeded);
    return seeded;
  }
  try {
    return normalise(JSON.parse(stored));
  } catch {
    return seedNotes();
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // A full or unavailable store must not break the board.
  }
}
