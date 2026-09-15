/** Persistence: notes live in localStorage, seeded from the shipped fixtures on first load. */
import fixtures from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

/** localStorage throws when storage is disabled or full; the board still has to work. */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = record['id'];
  const title = record['title'];
  const body = record['body'];
  const avatar = record['avatar'];
  const createdAt = record['createdAt'];
  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  return {
    id,
    title,
    body,
    avatar: typeof avatar === 'string' ? avatar : '',
    createdAt: typeof createdAt === 'string' ? createdAt : new Date(0).toISOString(),
  };
}

function seed(): Note[] {
  const notes: Note[] = [];
  for (const entry of fixtures) {
    const note = toNote(entry);
    if (note !== null) notes.push(note);
  }
  return notes;
}

/** The saved notes, or the seeded board when nothing usable is stored yet. */
export function loadNotes(): Note[] {
  const raw = readRaw();
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const notes: Note[] = [];
        for (const entry of parsed) {
          const note = toNote(entry);
          if (note !== null) notes.push(note);
        }
        return notes;
      }
    } catch {
      // Corrupt storage falls through to the seed rather than leaving an empty board.
    }
  }
  const seeded = seed();
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // A full or unavailable store must not break adding a note in this session.
  }
}

/** Note ids are integers and new notes continue the sequence. */
export function nextId(notes: readonly Note[]): number {
  let highest = 0;
  for (const note of notes) {
    if (Number.isInteger(note.id) && note.id > highest) highest = note.id;
  }
  return highest + 1;
}
