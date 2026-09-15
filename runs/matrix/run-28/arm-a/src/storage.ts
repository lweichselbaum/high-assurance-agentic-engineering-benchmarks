import seed from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

/**
 * Anything read back from localStorage is untrusted input -- another script, an
 * extension or a stale version could have written it -- so every note is checked
 * field by field and anything malformed is dropped.
 */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id)) return null;
  const title = typeof raw.title === 'string' ? raw.title : '';
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (!title && !body) return null;
  return {
    id,
    title,
    body,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

function parseNotes(text: string): Note[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const notes: Note[] = [];
  const seen = new Set<number>();
  for (const entry of parsed) {
    const note = toNote(entry);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      notes.push(note);
    }
  }
  return notes;
}

/** The seed board, used on first load when nothing has been saved yet. */
export function seedNotes(): Note[] {
  return (parseNotes(JSON.stringify(seed)) ?? []).map((note) => ({ ...note }));
}

export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): fall back to seed.
    return seedNotes();
  }
  if (stored === null) return seedNotes();
  const notes = parseNotes(stored);
  return notes === null ? seedNotes() : notes;
}

export function saveNotes(notes: Note[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota or blocked storage: the board still works for this session.
  }
}

/** Newest first, with the id as a stable tie-break for notes added in the same tick. */
export function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (Number.isFinite(byDate) && byDate !== 0) return byDate;
    return b.id - a.id;
  });
}

export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
