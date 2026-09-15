import seed from './fixtures.json';
import type { Note } from './types';

export const STORAGE_KEY = 'porto-notes:v1';

/**
 * Coerce one stored/seeded record into a Note. Storage is editable by anything running
 * on the origin, so nothing read back is trusted to have the right shape.
 */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

function toNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    const note = toNote(entry);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      notes.push(note);
    }
  }
  return notes;
}

export function seedNotes(): Note[] {
  return toNotes(seed);
}

/** Saved notes, or the seed board on a first visit. */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); fall back to the seed.
  }
  if (stored === null) return seedNotes();
  try {
    const parsed: unknown = JSON.parse(stored);
    // An empty saved board is a real state — every note was removed — so keep it.
    return Array.isArray(parsed) ? toNotes(parsed) : seedNotes();
  } catch {
    return seedNotes();
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota or blocked storage: the board still works for this session.
  }
}

/** Ids are integers that continue the existing sequence. */
export function nextId(notes: Note[]): number {
  let max = 0;
  for (const note of notes) if (note.id > max) max = note.id;
  return max + 1;
}
