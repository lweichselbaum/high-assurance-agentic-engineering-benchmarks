import seed from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes:v1';

/** Newest-first: by creation time, with the id as a stable tie-break. */
export function newestFirst(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/** The saved board, or the seed notes on first load. */
export function loadNotes(): Note[] {
  const stored = readStored();
  if (stored && stored.length > 0) return stored;
  const seeded = (seed as Note[]).map((note) => ({ ...note }));
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* a full or unavailable localStorage must not break the board */
  }
}

export interface NoteDraft {
  title: string;
  body: string;
  avatar: string;
}

/** Builds the next note: ids continue the sequence, and it always sorts newest. */
export function createNote(existing: readonly Note[], draft: NoteDraft): Note {
  return {
    id: existing.reduce((max, note) => Math.max(max, note.id), 0) + 1,
    title: draft.title,
    body: draft.body,
    avatar: draft.avatar,
    createdAt: nextTimestamp(existing),
  };
}

/**
 * Now, unless the newest note is somehow already newer (a lagging clock, an edited export) — the
 * feed is ordered by this field, so it has to keep increasing for "newest-first" to mean anything.
 */
function nextTimestamp(existing: readonly Note[]): string {
  const newest = existing.reduce((max, note) => Math.max(max, Date.parse(note.createdAt) || 0), 0);
  return new Date(Math.max(Date.now(), newest + 1000)).toISOString();
}

function readStored(): Note[] | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(parseNote).filter((note): note is Note => note !== null);
  } catch {
    return null;
  }
}

/** Anything in localStorage is untrusted input; keep only what has the shape of a note. */
function parseNote(value: unknown): Note | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  return {
    id,
    title: asString(record['title']),
    body: asString(record['body']),
    avatar: asString(record['avatar']),
    createdAt: asString(record['createdAt']),
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
