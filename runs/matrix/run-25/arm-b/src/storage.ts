/** Persistence: notes live in localStorage, seeded from the shipped fixtures on first load. */
import seedData from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Accepts only records that look like notes; anything else in storage is ignored. */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = Number(record['id']);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    title: asString(record['title']),
    body: asString(record['body']),
    avatar: asString(record['avatar']),
    createdAt: asString(record['createdAt']),
  };
}

function toNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  for (const entry of value) {
    const note = toNote(entry);
    if (note !== null) notes.push(note);
  }
  return notes;
}

/** The seed board: the notes from fixtures.json, used when nothing has been saved yet. */
export function seedNotes(): Note[] {
  return toNotes(seedData);
}

/** Reads the saved notes, seeding the board the first time the app is opened. */
export function loadNotes(): Note[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); fall back to the seed.
    return seedNotes();
  }
  if (raw === null) {
    const seeded = seedNotes();
    saveNotes(seeded);
    return seeded;
  }
  try {
    return toNotes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // A full or unavailable quota must not break the board; the in-memory notes still render.
  }
}
