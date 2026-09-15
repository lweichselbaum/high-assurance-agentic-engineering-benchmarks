import type { Note } from './types';
import seed from './fixtures.json';

const STORAGE_KEY = 'porto-notes.notes.v1';

/**
 * localStorage can throw on access (disabled cookies, private mode, quota). Fall back to a
 * process-lifetime store so the board still works, it just does not survive a reload.
 */
function backingStore(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    const probe = '__porto_notes_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
    };
  }
}

const store = backingStore();

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Accept a stored/seeded record only if it has a usable integer id. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return null;
  const createdAt = asString(raw.createdAt);
  return {
    id,
    title: asString(raw.title),
    body: asString(raw.body),
    avatar: asString(raw.avatar),
    createdAt: Number.isNaN(Date.parse(createdAt)) ? new Date(0).toISOString() : createdAt,
  };
}

function parseNotes(value: string | null): Note[] | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(toNote).filter((note): note is Note => note !== null);
  } catch {
    return null;
  }
}

/** The seed notes from fixtures.json, as a fresh array. */
export function seedNotes(): Note[] {
  return (seed as unknown[]).map(toNote).filter((note): note is Note => note !== null);
}

/** Saved notes, or the seed data on first load (nothing saved yet, or unreadable). */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = store.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  return parseNotes(stored) ?? seedNotes();
}

export function saveNotes(notes: Note[]): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Full or unavailable storage must not break adding a note.
  }
}
