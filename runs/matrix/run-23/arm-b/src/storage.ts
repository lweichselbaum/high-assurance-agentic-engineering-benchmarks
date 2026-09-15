/** Persistence. The board lives in localStorage; on first load it is seeded from fixtures.json. */
import seedData from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Partial<Record<keyof Note, unknown>>;
  return (
    typeof note.id === 'number' &&
    Number.isInteger(note.id) &&
    typeof note.title === 'string' &&
    typeof note.body === 'string' &&
    typeof note.avatar === 'string' &&
    typeof note.createdAt === 'string'
  );
}

function seedNotes(): Note[] {
  return (seedData as unknown[]).filter(isNote).map((note) => ({ ...note }));
}

/** Loads the saved board, or seeds it when nothing has been saved yet. */
export function loadNotes(): Note[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // A blocked localStorage is not fatal — the board just starts from the seed each time.
    raw = null;
  }

  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      // An empty saved array is a real state (everything filtered out by hand), not a missing one.
      if (Array.isArray(parsed)) return parsed.filter(isNote);
    } catch {
      // Corrupt storage falls through to the seed rather than leaving an empty board.
    }
  }

  const seeded = seedNotes();
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Full or unavailable storage must not break adding a note in this session.
  }
}

/** Ids are integers that continue the sequence. */
export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => (note.id > max ? note.id : max), 0) + 1;
}
