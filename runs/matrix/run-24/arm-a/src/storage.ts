// Note model, localStorage persistence and the first-run seed.

import seed from './fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes.notes.v1';

/**
 * Loads the board. On first run — nothing stored yet, or stored data we cannot make
 * sense of — the board is seeded from the shipped fixtures.
 *
 * Stored notes are treated as untrusted input: they may have been written by an older
 * version of the app, hand-edited, or corrupted. Every field is coerced to the shape
 * the rest of the app expects.
 */
export function loadNotes(): Note[] {
  const raw = read(STORAGE_KEY);
  if (raw !== null) {
    const notes = parseNotes(raw);
    if (notes !== null) return notes;
  }
  const seeded = coerceNotes(seed);
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Storage full, or blocked by the browser: the board still works for this session.
  }
}

/** Ids are integers and new notes continue the sequence. */
export function nextId(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}

/** Newest first, with the id as a stable tie-break for notes sharing a timestamp. */
export function byNewestFirst(a: Note, b: Note): number {
  const diff = time(b.createdAt) - time(a.createdAt);
  return diff !== 0 ? diff : b.id - a.id;
}

function parseNotes(raw: string): Note[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? coerceNotes(parsed) : null;
  } catch {
    return null;
  }
}

function coerceNotes(input: unknown[]): Note[] {
  const notes: Note[] = [];
  let fallbackId = 1;
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = Number(record.id);
    notes.push({
      id: Number.isSafeInteger(id) && id > 0 ? id : fallbackId,
      title: str(record.title),
      body: str(record.body),
      avatar: str(record.avatar),
      createdAt: str(record.createdAt) || new Date(0).toISOString(),
    });
    fallbackId = nextId(notes);
  }
  return notes;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function time(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
