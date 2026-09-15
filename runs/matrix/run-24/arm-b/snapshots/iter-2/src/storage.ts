import seed from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes.v1';

/** The board as it looks on a first visit, before anything is saved. */
export const SEED_NOTES: readonly Note[] = seed;

function asNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = raw['id'];
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  return {
    id,
    title: typeof raw['title'] === 'string' ? raw['title'] : '',
    body: typeof raw['body'] === 'string' ? raw['body'] : '',
    avatar: typeof raw['avatar'] === 'string' ? raw['avatar'] : '',
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : new Date(0).toISOString(),
  };
}

/**
 * The saved notes, or the seed board on a first load. Anything unreadable in storage is
 * treated as "nothing saved yet" rather than as a fatal error.
 */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const notes = parsed.map(asNote).filter((note): note is Note => note !== null);
        if (notes.length > 0) return notes;
      }
    } catch {
      /* fall through to the seed */
    }
  }

  const seeded = SEED_NOTES.map((note) => ({ ...note }));
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* persistence is best effort; the board still works for this session */
  }
}

/** New notes continue the id sequence. */
export function nextNoteId(notes: readonly Note[]): number {
  return notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1;
}

/**
 * The timestamp for a new note. Clamped to just after the newest existing note so that
 * "newest first" holds even if the clock is behind the seed data.
 */
export function nextCreatedAt(notes: readonly Note[]): string {
  const latest = notes.reduce((newest, note) => {
    const time = Date.parse(note.createdAt);
    return Number.isNaN(time) ? newest : Math.max(newest, time);
  }, Number.NEGATIVE_INFINITY);
  const now = Date.now();
  return new Date(latest === Number.NEGATIVE_INFINITY ? now : Math.max(now, latest + 1)).toISOString();
}
