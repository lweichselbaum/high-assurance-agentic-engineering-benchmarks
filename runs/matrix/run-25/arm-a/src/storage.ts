import seed from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes:v1';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Anything coming back out of localStorage is untrusted input — another tab, an
 * older version of the app or a hand-edited value could have put it there — so
 * every note is normalised to the shape the rest of the app expects.
 */
function toNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
  if (!Number.isSafeInteger(id)) return null;
  const createdAt = asString(raw.createdAt);
  return {
    id,
    title: asString(raw.title),
    body: asString(raw.body),
    avatar: asString(raw.avatar),
    createdAt: Number.isNaN(Date.parse(createdAt)) ? new Date(0).toISOString() : createdAt,
  };
}

function seedNotes(): Note[] {
  return (seed as unknown[]).map(toNote).filter((n): n is Note => n !== null);
}

/** Loads saved notes, seeding from the fixtures on a first visit. */
export function loadNotes(): Note[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): seed instead.
    return seedNotes();
  }
  if (stored === null) return seedNotes();
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return seedNotes();
    return parsed.map(toNote).filter((n): n is Note => n !== null);
  } catch {
    return seedNotes();
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // A full or unavailable store must not break adding a note in this session.
  }
}

/** New note ids continue the sequence rather than reusing a deleted one. */
export function nextNoteId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}
