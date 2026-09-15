/** Note model, seeding and localStorage persistence. */
import seed from './fixtures.json';

export interface Note {
  id: number;
  title: string;
  /** Raw source: text plus the inline tags the author typed. */
  body: string;
  /** Avatar URL as typed; validated at render time. */
  avatar: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes/v1';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Accept a stored record only if it has a usable id; fill in the rest. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'number' ? Math.trunc(raw.id) : Number.NaN;
  if (!Number.isFinite(id)) return null;
  const createdAt = asString(raw.createdAt);
  return {
    id,
    title: asString(raw.title),
    body: asString(raw.body),
    avatar: asString(raw.avatar),
    createdAt: createdAt || new Date(0).toISOString(),
  };
}

function seedNotes(): Note[] {
  return (seed as unknown[]).map(toNote).filter((note): note is Note => note !== null);
}

/**
 * Notes for this board. An absent key means a first load, which seeds from the
 * fixtures; an explicitly stored empty list stays empty. Anything unreadable
 * (another origin's key, hand-edited JSON) falls back to the seed.
 */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return seedNotes(); // private mode / storage disabled: run from memory
  }

  if (stored === null) {
    const notes = seedNotes();
    saveNotes(notes);
    return notes;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('stored notes are not a list');
    return parsed.map(toNote).filter((note): note is Note => note !== null);
  } catch {
    const notes = seedNotes();
    saveNotes(notes);
    return notes;
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota or disabled storage: the board still works for this session.
  }
}

/** Ids are integers that continue the seeded sequence. */
export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}

/**
 * A timestamp for a new note that is never older than the newest existing one,
 * so "newest first" holds even if the device clock lags behind the seed data.
 */
export function nextCreatedAt(notes: Note[]): string {
  const newest = notes.reduce((max, note) => {
    const time = Date.parse(note.createdAt);
    return Number.isFinite(time) ? Math.max(max, time) : max;
  }, 0);
  return new Date(Math.max(Date.now(), newest + 1000)).toISOString();
}

/** Newest first: by creation time, ties broken by the id sequence. */
export function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const at = Date.parse(a.createdAt);
    const bt = Date.parse(b.createdAt);
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
    return b.id - a.id;
  });
}
