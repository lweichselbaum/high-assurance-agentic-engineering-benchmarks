// Note storage: localStorage, seeded from fixtures.json on first load.

import seed from './fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes.v1';

/** Coerces one unknown value into a Note, or null if it is not one. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
  if (!Number.isInteger(id) || id < 0) return null;
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

function parseNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) return null;
  const notes: Note[] = [];
  for (const entry of value) {
    const note = toNote(entry);
    if (note) notes.push(note);
  }
  return notes;
}

/** Newest first, falling back to id so notes added in the same tick stay ordered. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (byDate) return byDate;
    return b.id - a.id;
  });
}

export function seedNotes(): Note[] {
  return parseNotes(seed) ?? [];
}

/**
 * Loads saved notes. A first load — or storage holding something we cannot
 * read — falls back to the seed board rather than an empty one; an explicitly
 * saved empty list stays empty.
 */
export function loadNotes(): Note[] {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return seedNotes(); // storage blocked (private mode, disabled cookies)
  }
  if (saved === null) return seedNotes();
  try {
    return parseNotes(JSON.parse(saved)) ?? seedNotes();
  } catch {
    return seedNotes();
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Full or unavailable storage must not take the board down.
  }
}

export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
